# Governance / 举报与申诉体系 — Static Design Audit

日期：2026-10-07
范围：只调查。**未修改任何源码，未 commit，未做 Motion。**
方法：DB → Entity → Mapper → Service → API → 权限 → Route → UI 全链路实读；
治理相关文件在工作区**零改动**（`git status` 中 moderation/report/appeal/governance 命中数为 0），
所以下面读到的就是当前已提交基线。

---

## 〇 结论先行（骨架判定）

**局部修（偏"拆掉重接"），不是保留，也不是推倒。**
后端治理域本身不是一个空壳：7 张表、6 个实体、6 个 mapper、一个 413 行的
`ModerationService`、一个真正的措施执行器，状态机是有骨架的。
但产品层是**断裂**的：

1. **用户侧没有任何入口能到达举报/申诉**（导航、用户菜单、内容页全部没有）。
   整个治理子系统是一座**只能靠手敲 URL 才能进入的孤岛**。
2. 举报表单要求用户**手输被举报内容的 UUID**（`objectId` 是自由文本框）。
   产品语义是"发现违规内容 → 举报"，实现语义是"知道那个内容的主键 → 填进去"。
3. 后端存在两个**可证实的正确性缺陷**（评论恢复写入死状态；申诉状态与 DDL/标签三方不一致）。

---

## 一 真实 Governance Domain Model

### 1.1 七张表（`V017__moderation.sql`，未被后续迁移改动）

| 表 | 职责 | 关键约束 |
|---|---|---|
| `report` | 用户举报 | `PK id`；`idx_report_status(status,created_at)`；**无 (reporter,object) 唯一约束** |
| `moderation_case` | 治理案件，1 举报 = 1 案件 | `UNIQUE uk_moderation_case_report(report_id)` |
| `moderation_decision` | 案件裁决 | `UNIQUE uk_moderation_decision_case(case_id)` —— **一案只能裁一次** |
| `moderation_measure` | 裁决落地的措施 | `idx_decision_id`；**无唯一约束** |
| `appeal` | 申诉 | `idx_appeal_case`；**无 (case,appellant) 唯一约束** |
| `report_supplement` | 举报补充材料（V033） | `idx(report_id,created_at)` |
| `topic_merge_record`（V030） | 话题合并审计 | 属 topic 治理，与本域正交，仅登记 |

**生产者/消费者逐条追证：**

- `report` ← 生产者唯一：`ModerationService.submitReport`（用户侧 `POST /api/v1/reports`）。
  消费者：`listMyReports` / `getMyReport`（用户）、`listReportsForAdmin`（管理）、
  `decideCase`（读 objectType/objectId 派发措施）。
- `moderation_case` ← 生产者唯一：`submitReport` 内**同事务**插入 `status=OPEN`。
  消费者：管理端队列、`decideCase`。
- `moderation_decision` ← 生产者唯一：`decideCase`。消费者：`submitAppeal` 反查、`findLatestByCaseId`。
- `moderation_measure` ← 生产者唯一：`decideCase`（`UPHELD` 时插一条 `HIDE_CONTENT`）。
  消费者：`ModerationMeasureExecutor.apply/revoke`、用户详情页 `measureId`。
- `appeal` ← 生产者唯一：`submitAppeal`。消费者：管理端申诉队列、用户申诉列表。
- `report_supplement` ← 生产者：`addReportSupplement`。消费者：`listByReportId`
  —— **但该 mapper 方法在整个后端没有任何调用方**，且用户详情页读的是
  `UserReportDetailView`（不含 supplements）。**补充材料写进去，用户和管理员都读不到。**

**结论**：域模型是真的（不是 enum 假象），但 `report_supplement` 是一条**断头链路**。

### 1.2 与"通知"的关系

举报/申诉**不产生任何 notification**（全后端唯一 `setCategory` 调用点是 FOLLOW）。
`NewReportPage` 的文案写着「处理结果会独立通知」—— **这句是 UI 自述，后端无 producer，属于谎言**。

---

## 二 举报对象范围（objectType）

### 2.1 前端可供选择的类型

`NewReportPage.tsx:33`：
```ts
const OBJECT_TYPES = ["ARTICLE", "COMMENT", "MOMENT", "USER", "SERIES"] as const;
```

### 2.2 后端接受范围

`submitReport` 只做 `blank` 校验后 `toUpperCase()` —— **没有任何类型白名单**。
任意字符串（含 `"FOO"`、`"../etc"`）都会被写入 `report.object_type`。

### 2.3 每种类型实际能不能"被治理"（措施执行器 switch，`ModerationMeasureExecutor:62-90`）

| objectType | `HIDE_CONTENT` 实际效果 | 评估 |
|---|---|---|
| `ARTICLE` | `moderation_status = HIDDEN`，公开查询过滤（`ArticleMapper:34`） | ✅ 真的隐藏 + 搜索索引同步 |
| `MOMENT` | `status = HIDDEN`，公开查询过滤（`MomentMapper:15` `PUBLISHED`） | ✅ 真的隐藏 |
| `COMMENT` | `status = HIDDEN`，公开查询过滤（`CommentMapper:17` `VISIBLE`） | ⚠️ 隐藏有效，**恢复失效**（见 §七） |
| `USER` | `default:` 空分支 = **什么都不做** | ❌ 举报"用户"，查实后无任何制裁落地 |
| `SERIES` | `default:` 空分支 = **什么都不做** | ❌ 举报"系列"，查实后系列照常公开可读 |

`syncSearchIndex` 只处理 `ARTICLE/SERIES/MOMENT`（`SearchIndexService:75-78`），
`COMMENT`/`USER` 是 no-op。

### 2.4 校验缺口（逐条）

- **已删除/不存在的对象可被举报**：`submitReport` 不查目标是否存在。举报一个不存在的
  `ARTICLE` id → 报告创建成功、案件 OPEN、措施执行时 `selectById` 返回 null → 静默无操作，
  但案件照常进入 `CLOSED`。**管理员会"处理"一个不存在的对象并把案件标为已处理。**
- **自举报**：不拦截。用户可以举报自己的文章。
- **重复举报**：`report` 无唯一约束，同一用户对同一对象可无限提交，每次生成新案件。
- **撤回**：不存在。举报一旦提交，用户无法撤回。
- **是否立即隐藏**：不是。举报纯属"线索记录"，对象在管理员裁决前保持公开。
  （这一点与 `NewReportPage` 文案「举报是线索」是一致的，属于设计选择而非缺陷。）

---

## 三 举报状态机（真实）

### 3.1 后端可写状态（全库 grep 实证）

```
report:              SUBMITTED  →  CLOSED
moderation_case:     OPEN       →  CLOSED     （OPEN_CASE_STATUSES 还含 TRIAGED/INVESTIGATING，但无人写入）
moderation_decision: UPHELD | DISMISSED
moderation_measure:  HIDE_CONTENT | RESTORE_CONTENT
```

`decideCase` 里 `report.setStatus("CLOSED")` 在 uphold 与 dismiss 两个分支**都执行**。
所以**"认定违规"与"驳回"在 report 层面得到同一个状态**，用户无法从 report 状态区分结果。

### 3.2 状态 vs 标签 vs 动作的原子性

`decideCase` 是 `@Transactional`，decision→measure→report→case 在同一事务内更新，
**原子性本身没问题**。`ModerationMeasureExecutor.apply` 也被 `@Transactional` 包住 ——
但它是**在 decideCase 事务内被调用的**（`measureExecutor.apply(measure)`），
而 `apply` 自己又开了事务（默认 `REQUIRED` → 加入外层事务），所以是同事务，正确。

### 3.3 前端标签

`moderation.types.ts:94-98` 的 `REPORT_STATUS_LABELS` 只映射 `SUBMITTED/TRIAGED/CLOSED`，
未知值原样回显。**这是正确的做法**（Legacy 的 `PENDING→处理中` 映射是凭空的，文件顶部注释
已明确警告）。唯一小瑕疵：`TRIAGED→已受理` 是一个后端从不写入的状态，属于"防御性多余"。

### 3.4 管理员前端的状态显示

`governance-status.vue:82` `pendingCount` 用
`!['DECIDED','CLOSED','DISMISSED','REJECTED'].includes(status)` 判"待处理"，
`moderation/index.vue:12` 用 `status === 'OPEN'` 判"待处理" —— **两处口径不同**，
在两个不同页面上会给出不一致的待处理数（虽然当前因共用队列接口而结果巧合相同）。

---

## 四 申诉状态机（真实）

### 4.1 三方不一致（可证实的缺陷）

| 来源 | 写入/声明的状态 |
|---|---|
| `V017` DDL 注释 | `PENDING/REVIEWED` |
| `ModerationService:176` 创建 | `SUBMITTED` |
| `ModerationService:347,349` 裁决 | `DECIDED`（两个分支都写同一个值） |
| `decideAppealQueue:336` 守卫接受 | `SUBMITTED / PENDING / REVIEWING` |
| 前端 `APPEAL_STATUS_LABELS:101` | `SUBMITTED→已提交, DECIDED→已裁定` |

**DDL 声明的 `PENDING/REVIEWED` 和后端实际写入的 `SUBMITTED/DECIDED` 完全是两套词表。**

### 4.2 申诉链路完整性

- 申诉目标：**不是举报，是"已作出的治理措施"**（`moderation_measure`）。
  单条申诉通过 `measureId` 或 `caseId`（取该 case 最新 measure）解析。
- 允许状态：`SUBMITTED/PENDING/REVIEWING` 可被裁决。
- **单次申诉：后端不限制。** `appeal` 表无唯一约束，同一 case 可提交任意多条申诉。
- **截止期限：不存在。** 无时间窗。
- **结果记录：有，但退化。** `submitAppeal` 不记录同意/驳回的理由；
  `decideAppealQueue` 无论 approve 还是 reject 都写 `status=DECIDED`，
  **且都不写 `moderation_decision`**，所以申诉的裁决结论**在数据里不存在**。
  用户看自己的申诉，`AppealDetailView` 只有 `{id,caseId,body,status,createdAt}` ——
  **看不到申诉是被批准还是被驳回**。
- **与原决定的关联**：`appeal.case_id` → `moderation_case`，**没有指向原
  `moderation_decision` 的外键**，所以"这条申诉针对哪次裁决"在数据上不成立。
- **自动恢复**：只有 `APPROVED/UPHOLD/MODIFY` 会 `measureExecutor.revoke(measure)`。
  驳回（`REJECTED` 等）不动措施。恢复逻辑本身受 §七 缺陷影响。

**判定：申诉是一个"能提交、能列表、能被管理员点两下改状态"的表单，
但不是一个闭环** —— 结论不可读、不可归档、不可追溯。

---

## 五 用户侧完整路径

| 路由 | 页面 | 真实性 |
|---|---|---|
| `/reports` | `MyReportsPage` | 真实，调 `GET /me/reports` |
| `/reports/new` | `NewReportPage` | 真实，调 `POST /reports`，需手输 objectId |
| `/reports/:reportId` | `ReportDetailPage` | 真实，含补充说明；**读不到已有补充材料** |
| `/appeals` | `MyAppealsPage` | 真实 |
| `/appeals/new` | `NewAppealPage` | 真实，但**只能从 report detail 带参进入** |
| `/appeals/:appealId` | `AppealDetailPage` | 真实 |

六个路由**全部包在 `RequireAuth` 内**（`routes.tsx:857-902`），权限壳正确。

### 5.1 核心断点：零入口

- `PRIMARY_NAV`（`AppLayout.tsx:90-96`）：首页/发现/话题/系列/星系/动态/指南 —— **无治理项**。
- 页脚（`AppLayout.tsx:525-541`）：公告/活动/创作者/指南 —— **无治理项**。
- `UserMenu`（`components/shared/UserMenu.tsx`）：我的内容/收藏夹/书架/…/设置 —— **无治理项**。
- 全站搜索 `to="/reports"` / `to="/appeals"`：**命中全部落在 moderation 页面内部**
  （MyReports↔MyAppeals 互相跳转、detail 返回列表等）。

→ 用户唯一的进入方式是在地址栏敲 `/reports`。**从产品上讲，举报与申诉不存在。**

### 5.2 举报表单的可用性

`NewReportPage` 的「对象 ID」是 `placeholder="被举报内容的 ID"` 的自由文本框。
用户在文章页点"举报"时手里**没有**这个 ID。要完成一次真实举报，用户必须：
打开文章 → 从 URL 或开发者工具里取出 UUID → 回到 `/reports/new` → 手选类型 → 粘贴 ID。
**没有任何内容页（文章/动态/评论）渲染举报按钮**（全站 `onReport/ReportButton/openReport` 命中为 0）。

---

## 六 管理员侧完整路径

### 6.1 管理端控制器

- `AdminModerationController`：`GET /moderation/cases`（只返回 `status=OPEN`）、
  `POST /moderation/cases/{caseId}/decide`。
- `AdminModerationQueueController`：`/moderation/reports`、`/moderation/appeals`
  （GET，含 status/limit 过滤；limit clamp 到 1..200）、
  `POST /moderation/reports/{id}/decide`、`POST /moderation/appeals/{id}/decide`。

### 6.2 管理端前端

- `views/community/moderation/index.vue`（举报处理工作台）：
  列表 + 详情 + 处理时间线 + 认定违规/驳回。时间线是**纯前端根据 `status` 拼的两行**，
  不是真实事件流（这一点在文案上没有伪装成"历史记录"，可接受）。
- `views/community/governance-status.vue`（举报队列 / 申诉队列 / 群聊治理三合一）：
  同一个组件按 `route.path` 后缀切换三套数据源。
- 路由：`community/moderation`（治理案件）、`.../reports`、`.../appeals`，
  以及 `community/reports`、`community/appeals` 的重定向。**管理端入口存在且可达。**

### 6.3 管理员侧的缺口

- **无审核员身份展示**：`ModerationCaseView` 不含 `assignedTo`；管理员看不出是谁处理的。
- **无审核日志**：`moderation_decision` 有 `decided_by/decided_at`，但管理端 UI 不展示。
- **批量操作**：不存在。
- **重复处理/竞态**：`decideCase` 有 `OPEN_CASE_STATUSES` 守卫 + `uk_..._case` 唯一约束，
  双重保护到位，**这里做得是对的**。
- **管理员自处理**：无任何拦截，管理员可处理与自己相关的举报。

---

## 七 Correctness / 权限问题（按严重度）

### P0-1 评论恢复写入死状态（`ModerationMeasureExecutor:120`）

- 评论创建 → `status = 'VISIBLE'`（`SocialService:162`）
- 公开读取 → `status = 'VISIBLE'`（`CommentMapper:17,24,30,48`）
- 隐藏 → `status = 'HIDDEN'` ✅
- **恢复 → `status = 'ACTIVE'`** ❌ —— 全库对 comment 读写 `ACTIVE` 仅此一处，**没有任何查询读 `ACTIVE`**

**后果**：一次"隐藏评论 → 用户申诉 → 管理员批准"之后，评论被写入 `ACTIVE`，
从此**永久不出现在任何地方**（作者评论列表、对象评论列表、计数全部过滤 `VISIBLE`）。
申诉"成功"的净效果是把评论从"可恢复的隐藏"变成"永久消失"。
DDL 注释也只承认 `VISIBLE/HIDDEN/DELETED`，`ACTIVE` 不在词表内。

### P0-2 申诉结论不可读

见 §4.1 / §4.2：申诉裁决不落 `moderation_decision`，approve/reject 都写 `DECIDED`，
用户 DTO 无结论字段。**"申诉结果是什么"这个问题在当前数据模型下无法回答。**

### P1-1 举报/申诉结果都不通知

用户侧文案承诺「处理结果会独立通知」，但治理域**不产生 notification**。
用户只能靠自己反复打开 `/reports` 刷新。

### P1-2 `report_supplement` 断头

`ReportSupplementMapper.listByReportId` 无调用方；用户详情页不读它。
用户"补充说明"提交成功（且返回 200），但**下一次打开页面就再也看不到**。

### P1-3 举报目标无存在性校验

见 §2.4。举报不存在的对象会正常走完整个流程并把案件标为已处理。

### P2-1 objectType 无白名单

后端接受任意字符串；`USER`/`SERIES` 查实后无措施落地（`default:` 空分支）。

### P2-2 无重复举报约束 / 无自举报拦截 / 无撤回

### 关于 `HTTP 200 + body.code=401`

**已复核，不是漏洞。** 管理端 `Result` 信封在全项目一致（moderation / operations / 其他），
未登录时返回 200 + `{"code":401,"message":"请先登录"}`。
这**不**构成越权，也**不**是治理域特有的问题。明确排除，不重复上一轮的误判。

---

## 八 真实数据规模

`xingyu_hub_test` 与 `xingyu_hub` **两库全部为 0 行**：

```
report.total = 0      moderation_case = 0      moderation_decision = 0
moderation_measure = 0      appeal = 0      report_supplement = 0
```

且**没有任何 status / objectType 分布**可言。

**含义**：治理域从未被真实使用过。因此：
- 所有状态机结论都来自**代码路径**，不是来自观测到的数据；
- 本轮未创建 fixture（用户要求不新增、且这是静态审计）；
- 若后续要做视觉验收，fixture 必须走真实业务路径创建，并标注
  **「fixture 验证 ≠ 真实业务数据」**，用完清理。

---

## 九 1440 / 390 Static Layout

**本轮不做浏览器实测**（静态审计，且治理域无数据、无入口，实测页面只能看空态）。
基于代码的静态判断：

- 用户侧六页全部复用 `section-gap` + `rounded-lg border bg-card p-5` 的正文宽度容器，
  与公告详情同族，未见 1152px 大壳包窄正文的问题。
- `NewReportPage` / `NewAppealPage` 表单用 `flex flex-col gap-4`，390 下不挤压。
- `ReportDetailPage` 的 `dl` 用 `flex flex-col`（非两列网格），390 友好。
- 管理端 `governance-status.vue` 有 `@media (max-width: 720px)` 把 header 转纵向。
- 管理端 `moderation/index.vue` 是双栏工作台，`@media (max-width: 1050px)` 降为单栏，
  `600px` 再收窄 —— 390 下可用但信息密度高（表格改行式）。

**未做**：真实 1440/390 截图与 DOM 量测。原因：本轮为静态审计且域内无数据，
在无真实内容时实测只能验证空态骨架，价值有限；**如需验收应在修复后配合 fixture 一起做。**

---

## 十 Top 5 问题

1. **零入口** —— 举报/申诉在产品里不可达，只能手敲 URL。
2. **举报表单要手输 UUID** —— 与"发现内容就举报"的产品语义断裂。
3. **评论恢复写入 `ACTIVE` 死状态** —— 申诉批准反而让评论永久消失。
4. **申诉不是闭环** —— 结论不落库、用户读不到、管理端不可追溯。
5. **结果是静默的** —— 无通知、无补充材料回读，用户无从得知进展。

---

## 十一 主动反证（5 条断言逐一证伪）

| 断言 | 结论 | 证据 |
|---|---|---|
| "提交成功"是否真的进入可处理队列？ | **部分成立** | 后端确实同事务建 `moderation_case(OPEN)` ✅。但管理员侧 `GET /moderation/cases` 只返回 OPEN，`governance-status.vue` 走的是 `/moderation/reports`（无状态过滤，含全部）。**队列可达但用户侧入口为 0** → 从用户视角，提交进去的线索没有任何人会被引导去看。 |
| "处理中"是否只是 UI 文案？ | **该文案不存在于 V2** | V2 只映射 `SUBMITTED/TRIAGED/CLOSED`，且 `TRIAGED/处理中` 后端从不写入。Legacy 的 `PENDING→处理中` 已被明确标注为凭空映射。所以不是"假文案"，而是**这一状态根本不会被展示**。 |
| "申诉成功"是否真的恢复对象？ | **对 ARTICLE/MOMENT 成立，对 COMMENT 是反效果** | `revoke` → `restoreTarget`。ARTICLE→NORMAL ✅、MOMENT→PUBLISHED ✅（且原状态确为 HIDDEN 才动）、**COMMENT→ACTIVE ❌（无任何查询读该值）**。 |
| "只能看自己的举报"是否服务端保证？ | **成立** | `getMyReport` / `getMyAppeal` 都做 `user.getId().equals(...)` 校验，否则 404（**不是 403，刻意不泄露存在性**）✅。`listMyReports` 按 `reporter_id` 过滤 ✅。 |
| "对象被隐藏"是否真的从 Search/Home/Topic 等处消失？ | **ARTICLE 成立，MOMENT 成立，COMMENT 部分成立，USER/SERIES 不成立** | 文章 `moderation_status='HIDDEN'` 被公开查询过滤 + 索引移除 ✅；动态 `status='HIDDEN'` 与公开查询过滤一致 ✅；评论隐藏有效但恢复失效 ⚠️；`USER`/`SERIES` 走 `default:` 空分支，**隐藏措施对它们完全无效** ❌。 |

---

## 十二 明确未处理（本轮不越界）

AI 自动审核、风险评分、举报排行榜、用户信用分、举报分类树、举报奖励、自动封禁、
复杂治理看板、Motion、路由重构、后端模型扩展、通知 producer、schema 变更 —— **全部未做**。

## 十三 本轮零改动声明

未修改任何源码，未新增/删除文件（除本报告），未 commit，未执行任何 DDL/DML。
`xingyu_hub_test` / `xingyu_hub` 治理域仍为 0 行。

# Governance Contract Recovery（2026-10-07）

> 阶段：Governance Phase 8（Contract Recovery）。
> 前序：`2026-10-07-governance-static-design-audit.md`（只调查，判定「局部修/偏拆掉重接」）。
> 本轮范围（用户原话）：「7 表 / 6 实体 / ModerationCase / Decision / Measure 的领域骨架保留，
> 不推倒重写。把『发现违规 → 举报 → 管理处理 → 用户看结果 → 被处理方申诉 → 决定真实生效』
> 接成一个可信闭环。不 commit、不做 Motion，不扩复杂治理能力。」
> **Static Design 不抢跑**：1440/390 视觉验收留到下一阶段。

---

## 0. 一句话结论

治理闭环**已连通且可证伪**：11 条需求全部落地，P0 级缺陷修复，跨模块可见性用真实消费入口证明，
并**额外发现并修复了一个此前未知的既有产品缺陷**（游客首页 500）。后端 23/23、前端 100/100、
`tsc` 0 error，测试库零残留。

---

## 1. 两个 P0 状态机缺陷（需求 1）

### P0-1 评论 restore 写错状态 —— 已修并反证

- **缺陷**：`ModerationMeasureExecutor` 恢复评论时写 `ACTIVE`，而全库读路径只认 `VISIBLE`
  （`CommentMapper` 全部公开查询过滤 `VISIBLE`）。后果：申诉批准后评论**永久消失**。
- **修复**：`ModerationMeasureExecutor.java:117–131` 改为 `setStatus("VISIBLE")`，附长注释说明理由。
- **反证**：把 `VISIBLE` 改回 `ACTIVE`，`GovernanceContractRecoveryIntegrationTest` 立即变红
  （`expected: <VISIBLE> but was: <ACTIVE>`）。回归用例同时断言"不仅是字段变了"——
  `GET /api/v1/moments?limit=50` 列表重新包含、索引回归。

### P0-2 Appeal 结果契约 —— 已修并反证

- **缺陷**：approve / reject 都写 `DECIDED`，结论不落库、用户 DTO 读不到、
  数据库无法回答"批准还是驳回"。三方词表不一致（DDL 注释 `PENDING/REVIEWED` vs 实写 `SUBMITTED/DECIDED`）。
- **修复**（V046 `appeal_outcome_contract.sql` + Java/Mapper/DTO/UI 单一词表）：
  - 状态机：`PENDING → APPROVED | REJECTED`（终局）。
  - 新增持久化字段：`outcome`、`decided_by`、`decided_at`、`decision_note`。
  - `decideAppealQueue` 走 `lockById`（`SELECT ... FOR UPDATE`）+ `PENDING` 守卫 + 落结论，
    且与 overturn/restore **同一事务**。
  - 结构化回答四问：是否待处理（status）／最终 APPROVED|REJECTED（outcome）／
    谁处理（decided_by）／何时（decided_at）／说明（decision_note）。
- **反证**：`rejectedAppealPersistsRejectedOutcomeAndKeepsObjectHidden` 直接证明
  驳回落 `REJECTED` 而非与批准同为 `DECIDED`；对象仍 `HIDDEN`。

---

## 2. 举报对象范围（需求 2）—— 服务端白名单

- 用户侧官方只支持 `ARTICLE / MOMENT / COMMENT`。
- `ModerationService.REPORTABLE_OBJECT_TYPES` 白名单；`submitReport` 直接拒绝其它类型
  （`USER`/`SERIES`/`GALAXY`/任意串 → **HTTP 400**）。
- 理由：`USER`/`SERIES` 在 `ModerationMeasureExecutor` 是 `default:` 空分支 →
  会产生"举报成功却什么也不会发生"的假闭环。
- **反证**：`unsupportedObjectTypesAreRejectedServerSide`（4 个非法类型全 400）。

---

## 3. 举报从对象上下文发起（需求 3）

- **前端**：新增轻量 `ReportLink` 组件（Flag 图标 + 「举报」，低权重、并入现有次要操作区），
  挂到 Article / Moment / Comment 三处；自带 `?objectType=&objectId=`；自己的内容 `hidden`。
- `NewReportPage` **重写**为上下文驱动：读 `useSearchParams` → 调 `reportsApi.previewTarget`。
  **无 UUID/类型输入框**。缺上下文 → 「请从需要举报的内容页面发起举报」+ 安全返回路径。
- **服务端** `previewReportTarget` 重新校验：白名单／对象存在／非自举报；
  标题/作者**由服务端解析**（ARTICLE 走 published→formal revision；MOMENT 走最新 revision；
  COMMENT 取 body），**绝不信任前端传入的显示信息**。
- **反证**：`reportingANonExistentObjectIsRejected`（404）、`cannotReportOwnContent`（409）、
  前端 `new-report-page.test.tsx` 14 例（含"无 UUID 输入"回归）。

---

## 4. 重复举报最小诚实规则（需求 4）

- 同一用户 + 同一对象的**未终结**举报（`SUBMITTED`/`TRIAGED`）只允许一条：
  复用既有记录返回，不新建。
- **并发**：V047 加**部分唯一约束**（MySQL 8 用 STORED GENERATED COLUMN `active_key`
  + UNIQUE；NULL 允许多值）保证并发唯一；代码侧 `findActiveByReporterAndObject`
  先查、`DataIntegrityViolationException` 兜底。
- **反证**：`duplicateActiveReportReturnsTheExistingOneInsteadOfCreatingASecond`
  （两次提交返回同一 id，DB 计数恒为 1）。

---

## 5. 申诉产品对象与权限（需求 5）

- Appeal = **被措施实际影响的内容 owner** 对案件处置的异议，**不是举报人的二次投诉**。
- 校验：只有真正被 measure 影响的 owner 能建（举报人 → **404，不泄露存在性**）；
  无实际措施的案件不能申诉（**400**）；仍待处理的 Report 不能申诉；终局申诉不能重复处理。
- 一案至多一条申诉：服务端一次性保证（`findByCaseId`）。
- APPROVED → 推翻措施、真实恢复 + 落结论；REJECTED → 原措施保持 + 落结论。
- **反证**：`onlyAffectedOwnerCanAppealAndReporterCannot`、
  `caseWithoutAnyMeasureCannotBeAppealed`、`terminalAppealCannotBeDecidedTwice`。

---

## 6. Report Supplement 闭环（需求 6）

- 确认前端**确有**"补充说明"提交入口 → 读链必须闭环。
- 修复断头读链：`supplementViews(reportId)` 接进 `getMyReport`（用户详情）与
  `listReportsForAdmin`（管理侧），按真实 `createdAt` 升序；owner 权限服务端保证。
- 前端 `ReportDetailPage` 渲染已持久化的 supplements；原"补充说明"字段改名「举报说明」避免歧义。
- **反证**：`report-detail-page.test.tsx` 新增 2 例（有序渲染 / 空则不显示列表）。

---

## 7. 处理结果不发 Notification（需求 7）

- 治理域**没有** notification producer（全后端唯一 `setCategory` 是 FOLLOW）。
- 删除 `NewReportPage` 里「处理结果会独立通知」虚假文案。
- 替换为诚实路径：在「我的举报」看处理状态，在「我的申诉」看申诉结果。
- **反证**：全仓 grep 无残留（唯一命中是 auth 审核页的邮件通知，属另一域且真实存在）。

---

## 8. 治理接回产品（需求 8）

- **未**造「治理中心」大首页。
- `UserMenu` 增「治理」分组：我的举报（`/reports`）、我的申诉（`/appeals`），
  **刻意不叫"治理中心"**（注释写明理由）。
- `/reports` ↔ `/appeals` 已有互链；`PRIMARY_NAV` **未**新增。
- **修复 Guide 虚假文案**：`V021` 种子「举报与申诉机制可在治理中心查看」→
  **V048** forward 迁移改为指向真实「我的举报」/「我的申诉」。

---

## 9. 管理侧原子性与可证伪（需求 9）

- `decideCase` / `decideAppealQueue` 都先 `lockById`（`SELECT ... FOR UPDATE`）再判状态，
  复用项目既有 `ConversationMapper` 行锁先例，**未**另造 lockVersion 体系。
- 终局状态的第二次处理 → `CONFLICT`；不重复写 Decision、不重复执行 Measure。
- **响应形态说明**：admin 端点走 `GlobalExceptionHandler`（basePackages 覆盖 admin 包）→
  `ContractException` 变为 **HTTP 200 + `Result.fail`（body.code=500）**，这是项目既有 admin
  信封约定（admin SPA 的 `request.ts` 正是靠 `res.code !== 200` 判失败），**不是**鉴权/状态机失效。
- **反证**：`terminalAppealCannotBeDecidedTwice` 断言 HTTP 200 + `body.code != 200`
  + status/outcome 不变 + **measure 计数不变**。

---

## 10. 跨模块可见性 —— 用真实消费入口证明（需求 10）

`GovernanceCrossModuleVisibilityIntegrationTest`（**4/4**）：

| 对象 | 隐藏 → 公开入口失效 | 恢复 → 回归 | 索引 |
|---|---|---|---|
| MOMENT | `/api/v1/moments`、`/api/v1/home` 均不再出现 | 重新出现 | 移除/回归，无幽灵行 |
| COMMENT | （评论本就不在索引） | 恢复为 **VISIBLE** | **绝不产生** search_document |
| ARTICLE | 非作者公开详情 **404**、`/home` discoveries 消失 | 详情可读 | 移除/回归 |

- 走**真实业务链路**：ARTICLE 经「草稿→提交→管理员审核通过」发布，再经「举报→案件裁定」隐藏，
  最后经「申诉→批准」恢复 —— 不写裸 SQL 造状态。
- **刻意不碰 SERIES**：章节可见性是独立未定档债务，治理测试不得顺手替它决定。

### ⚠️ 本轮发现的**既有产品缺陷**（超出治理范围，但被本测试触发）

**游客首页 HTTP 500**：`HomeFeedEnrichmentService.enrich:195`

```java
CommunityProfile profile = profileByOwner.get(ownerByKey.get(entry.getKey()));
```

`resolveProfiles` 在无可解析 owner 时返回**不可变** `Map.of()`；`Map.of().get(null)`
抛 `NullPointerException`（`Objects.requireNonNull`）而非返回 null。
→ **只要有一条 owner 解析不到的索引行，整页游客首页 500**。

- **已修**：owner 为 null 时跳过 profile 查询，降级为逐行空 Presentation。
- **已加回归守卫**：`HomeFeedEnrichmentIntegrationTest.unresolvableOwner…`。
- **归因（先反证）**：库里 5 条幽灵 MOMENT 索引行（随机 UUID，非本轮 fixture；已用
  `NOT EXISTS moment` 证明**先于本轮就存在**）→ 该 500 **不依赖治理域即可触发**，属既有缺陷。
  根因是别的测试清理 `DELETE FROM moment` 时**不清 `search_document`**。

---

## 11. 反证 9 项（需求 11）

| 反证 | 覆盖 | 结论 |
|---|---|---|
| 手动 URL 举报不支持的对象 | 白名单 → 400 | ✅ |
| 举报自己的内容 | → 409 | ✅ |
| 猜 id 看他人 Report / Appeal | 新增 2 例 IDOR → 404（自己读 OK） | ✅ |
| 两管理员同时处理（重复执行） | FOR UPDATE 行锁 + 终局守卫 | ✅ |
| Appeal APPROVED 后真恢复 | PUBLISHED + 列表/详情/索引回归 | ✅ |
| Appeal REJECTED 后仍隐藏 | HIDDEN 保持 | ✅ |
| 评论 restore 真回 VISIBLE | 断言 VISIBLE（非 ACTIVE） | ✅ |
| Search / Home 与治理一致 | MOMENT/ARTICLE 的 `/home` + 索引 | ✅ |
| UI 残留"会通知你"/"治理中心" | 前端测试 + 全仓 grep | ✅ |

---

## 12. 验证证据（未实际验证的一律不写"通过"）

| 测试 | 结果 |
|---|---|
| `GovernanceContractRecoveryIntegrationTest` | **11/11** |
| `GovernanceCrossModuleVisibilityIntegrationTest` | **4/4** |
| `HomeFeedEnrichmentIntegrationTest` | **4/4** |
| `SearchIndexPipelineIntegrationTest` | **4/4** |
| 前端 moderation + user-menu + rules | **9 files / 100 tests** |
| `tsc --noEmit` | 0 error |

**测试库残留复检**：`govrec`/`govvis` 用户 0、helper 表 0、孤儿 MOMENT/ARTICLE 索引行 0。

---

## 13. 变更文件清单

**后端（main）**
- `ModerationMeasureExecutor.java`（P0-1）
- `ModerationService.java`（白名单、重复举报、previewReportTarget、supplement 读链、decideCase/decideAppealQueue 锁）
- `HomeFeedEnrichmentService.java`（**null-owner 降级修复**）
- `CommunityModerationController.java`（`GET /reports/target`）
- DTO：`UserReportDetailView`、`ReportAdminView`、`ReportTargetView`(新)、`AppealDetailView`、`AppealAdminView`
- Entity/Mapper：`Appeal`、`AppealMapper`、`ModerationCaseMapper`、`ReportMapper`

**后端（migrations）**
- `V046__appeal_outcome_contract.sql`（原 P0-2）
- `V047__governance_uniqueness.sql`（原 重复举报约束）
- `V048__rules_copy_points_to_real_report_appeal_paths.sql`（**本轮新增**，修"治理中心"文案）

**前端**
- 新增 `features/moderation/components/ReportLink.tsx` + test
- 重写 `NewReportPage.tsx` + test；`ReportDetailPage.tsx`、`AppealDetailPage.tsx`、`MyAppealsPage.tsx` + tests
- `UserMenu.tsx` + test；`MomentDetailPage.tsx`、`CommentSection.tsx`、`ArticleDetailPage.tsx` 挂 ReportLink
- `moderation.types.ts`、`moderation.api.ts`

**测试（新/改）**
- `GovernanceContractRecoveryIntegrationTest.java`（11）
- `GovernanceCrossModuleVisibilityIntegrationTest.java`（4，新）
- `HomeFeedEnrichmentIntegrationTest.java`（+1 nil-owner 守卫）

---

## 14. 明确的债务 / 下一阶段

1. **静态验收（下一阶段，本轮不抢跑）**：以官方业务链路造标注 fixture，
   对 5 个界面做 1440/390 验收：举报表单 / 我的举报 / Report detail / 我的申诉 / Appeal detail。
   静态原则：这是**用户状态查询 UI**，非后台看板；无大 Hero、无宇宙装饰、无复杂时间线、
   无治理统计卡。信息顺序：对象 → 当前状态 → 原因 → 处理结果 → 时间。
2. **SERIES 章节可见性**：独立未定档债务，本阶段刻意未动。
3. **USER → 账号处罚 / SERIES → 归档可见性**：未来以**独立定义**扩展，不在本轮。
4. **通知**：治理域不发通知是本轮刻意的定档，不是遗漏。

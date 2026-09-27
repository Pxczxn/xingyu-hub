# Legacy `xingyu-web` 差异清点（Task #4 前置）

> 清点日期：2026-09-27 · 基线：`xingyu-web-next` @ `948c0a6`
> 目的：决定 Legacy 如何处置前，先弄清 **V2 到底还缺什么**。
> 方法：路由 diff（`app/**/page.tsx` vs `routes.tsx`）+ 逐页 API 引用数统计 + 活体端点探测 + 抽样读源码。

## 结论先行

**Legacy 绝不能直接删。** 它还有 **约 25 个功能大类、约 88 条路由**没进 V2。

但**后端几乎全都已就绪** —— 探测到的接口返回 `401`（存在但需登录）而非 `404`。
所以缺口是**纯前端**：V2 还没为这些功能写页面，而不是后端没实现。

→ 这决定了 Task #4 的性质：**不是「删 Legacy」，而是「继续按 Phase 往 V2 搬，搬完再删」**。

---

## 一、V2 已覆盖（可以放心）

| 域 | V2 路由 |
|---|---|
| 首页/发现/搜索/话题 | `/`、`/discover`、`/search`、`/topics`、`/topics/:slug` |
| 文章 | `/articles/:articleId` |
| 个人主页 | `/u/:username`、`/me` |
| 创作台 | `/studio`、`/studio/content/:articleId` |
| 系列（创作） | `/studio/series`、`/new`、`/:id/edit`、`/:id/articles` |
| 系列（公开） | `/series`、`/series/:seriesId`、`/series/:seriesId/read` |
| 星系（公开） | `/galaxies`、`/:slug`、`/:slug/members`、`/:slug/content` |
| 动态 | `/moments`、`/moments/:id` |
| 收藏夹/书架 | `/me/collections`、`/me/collections/:id`、`/collections/:id`、`/me/bookshelf` |
| 设置 | `/settings/profile`、`/privacy`、`/sessions`、`/blocks`、`/api-tokens` |
| 引导 | `/onboarding` + 4 个别名 |
| 静态信息 | `/announcements`、`/announcements/:id`、`/guide`、`/guide/:slug`、`/rules` |
| 认证 | `/login`、`/register`、`/register/pending-audit`、`/verify-email`、`/forgot-password`、`/reset-password`、`/force-change-password` |

---

## 二、V2 缺失（按优先级分档）

### 🔴 P0 — 用户高频、且后端已就绪

| 功能 | Legacy 路由 | 后端 | 说明 |
|---|---|---|---|
| **私信 / 消息中心** | `messages` 下 **20+ 条** | ✅ 401 | 最大的一块。会话、群聊、文件、邀请、搜索、已保存 |
| **关注关系** | `/me/following`、`/me/followers` | ✅ 401 | 社交核心；`followUser`/`unfollowUser` 也已有 → **已迁（Phase 2I-1，`5605dd9`）** |
| **通知中心** | (无独立页，Header 内) | ✅ 401 | `/api/v1/notifications`；V2 Header 的 `MessageCircle` 是 **placeholder** → **已迁（Phase 2I-2）**，见下方勘误 |
| **关注动态 / 我的动态** | `/me/moments` | ✅ 401 | 2D 只做了公开 `/moments`，个人维度没做 → **已迁（Phase 2I-5）**，另补 `GET /me/insights` |
| **我的互动**（赞/评论） | `/me/likes`、`/me/comments` | ✅ 401 | 「我留下的痕迹」→ **已迁（Phase 2J-1）** |
| ~~阅读历史~~ `/me/history` | `/me/history` | ❌ **无后端路由** | 仅存在于 Legacy 的 `screen-registry.ts` 标签里；探针 **500**（无 handler），**不做** — 见 §三·补3 |

### 🟠 P1 — 内容生态补全

| 功能 | Legacy 路由 | 后端 | 说明 |
|---|---|---|---|
| **活动 Events** | `events` 下 **8 条**（含报名/提交/结果/排行） | ✅ **200（公开可读！）** | 唯一探测到 **200** 的，说明是公开功能，优先级应上调 |
| **榜单** | `/rankings` | ⚪ **无独立后端** | 页面是 `getDiscover`+`getGalaxies`+`getTopics`+`listSeries` 的**前端拼装**（已核实，4 处引用全是复用） |
| **分类** | `/categories` | ⚪ **无独立后端** | 仅 `getDiscover`+`getTopics` 拼装 |
| **精选** | `/features` | ⚪ **无独立后端** | `getDiscover`+`getSuggestedUsers`+`getTopics`+`listSeries` 拼装 |
| **创作者** | `/creators` | ✅ 复用已有 | `getProfile`/`getTopicCreators`/`getUserWorks`/`followUser`/`unfollowUser`（探针均 200/401，存在） |
| **举报 / 申诉** | `reports` 下 4 条、`appeals` | ✅ 401 | 读在 `/me/reports`·`/me/appeals`，**写在资源根** `/reports`·`/appeals` → **已迁（Phase 2J-2）**，见 §三·补4 |
| **帮助中心** | `/help`、`/help/:slug` | ✅ 复用 `/guide` | `getGuidePages` 与 `/guide` **同一数据源** → 大概率**应并入 guide，不单独做** |

> 这三条 ⚪「无独立后端」是本次核实出的**重要修正**：`rankings`/`categories`/`features`
> 不是「有后端没前端」，而是**纯前端聚合页**。做它们不需要任何后端改动，
> 但也意味着**它们没有"官方数据源"**——搬过去会改掉现在 `/discover` 的定位，**建议先不搬，或直接并进 `/discover`**。

### 🟡 P2 — 创作台深化

| 功能 | Legacy 路由 | 说明 |
|---|---|---|
| 数据分析 | `/studio/analytics` | 创作台仪表盘 |
| 素材库 | `/studio/assets` | |
| 协作 | `/studio/collaboration`、`/accept` | |
| 版本历史 | `/studio/content/:id/versions` | |
| 投稿管理 | `/studio/submissions/:id` | |
| 创作台设置 | `/studio/settings` | |
| 动态发布 | `/studio/moments/new` | ~~2D 有 `MomentDetailPage` 但**没有发布页**~~ → **勘误见 §三·补2**：发布表单**已在 `MomentsPage` 内**，无需独立页 |

### 🔵 P3 — 个人成长 / 杂项

`/me/badges`、`/me/growth`、`/me/interests`、`/me/requests`、`/me/groups`、
`/account/status`、`/content/:type/:id/status`、`/share`、`/spaces/:slug`、
`/comments/:id`、`/feedback/recommendations`、`/collections/public`

### ⚪ P4 — 系统页（低价值，可最后做或不做）
`/system/error`、`/forbidden`、`/maintenance`、`/not-found`、`/offline`、`/rate-limited`

### 📌 设置页的细化子路由（V2 目前是单页承载）
Legacy 把设置拆得很细：`/settings/security/*`（5 条）、`/settings/privacy/*`（3 条）、
`/settings/data/*`（3 条）、`/settings/notifications`、`/preferences` 等。
V2 用 5 个页面覆盖主干 + `SettingsLayout`。**这属于「设计取舍」而非「功能缺失」**，
但要确认 Legacy 的子项（尤其 `data/export`、`data/delete-account`、`security/email`）是否必需。

---

## 三、必须提醒的两个风险

1. **Header 里有假功能**。`AppLayout` 的注释自己写着
   `Message/notification panels are deliberately NOT implemented this round`。
   那个 `MessageCircle` 图标（现在被用作「动态」导航）和通知入口，**实际没有对应功能**。
   在 Legacy 还在时这不是问题；**一旦删掉 Legacy，通知/私信就彻底没有入口了**。

   > **部分已修（Phase 2I-2）**：通知入口已变成真实链接并带未读数徽标。
   > 私信仍缺，且 **V2 已刻意不渲染消息图标**——没有目的地的图标比没图标更糟。

2. **`/me/moments` 确实缺失**；但「**不能发动态**」这半句是**错的**，见 §三·补2。
   `/me/moments`（个人动态历史）→ **已迁（Phase 2I-5）**。

---

## 三·补2 · Phase 2I-5 动态发布的两条勘误（源码 + 实测确认，2026-09-27）

清点时把「`/studio/moments/new` 不在 V2」读成了「V2 不能发动态」，**这是错的**：

| 原推断 | 实际情况 | 后果 |
|---|---|---|
| V2 只能看动态、不能发动态 | **发布早就实现了**。`MomentsPage.tsx` 内嵌发布表单 → `momentsApi.create({body})` → `navigate(/moments/{id})`；`MomentDetailPage` 已含编辑（PATCH）与删除（POST /trash），并已处理 30 分钟编辑窗口的 409 | 「不能发动态」是**假缺口**，差点照它开工写一个重复的发布页 |
| `POST /studio/moments/new` 才是发布路径 | **Legacy 的 `/studio/moments/new` 不是后端路由**，只是 Legacy 自己的一个页面壳 | 不需要为它建 V2 页面；发布动作已由 `/moments` 承载 |

**动态写链路（源码确认，`CommunityMomentController @RequestMapping("/moments")`）**：
`POST /moments`（`{body}`，**无草稿态**，创建即 `PUBLISHED`）、`PATCH /moments/{id}`（非作者 404；非 PUBLISHED 409；超窗口 409）、
`POST /moments/{id}/trash`（软删，返回 View **而非 204**）。
`CommunityMeController` **有一整套平行的** `/me/moments`（GET/PATCH/POST trash）——**两套都真实存在**，前端选用 `/moments` 那套。

⚠️ **探针教训（导致上面那条误判的直接原因）**：探 `POST /api/v1/me/moments` 得到 **405 Method Not Allowed**，据此推断「路由不存在」是**无效推理**——同一路径的 **`GET` 返回 401**（存在且需登录）。**405 只能说明"该方法未绑定"，不能说明"路由缺失"**；`404` 也常是业务语义（`GET /moments/{id}` 对 TRASHED 也返 404）而非路由不存在。判定路由存在性请**对同一路径逐个方法探**，或直接读 controller 源码。

---

## 三·补3 · Phase 2J-1 「我的互动」契约与 `/me/history` 的证伪（源码 + 实测，2026-09-27）

P0 表里「我的互动（赞/评论/历史）」三项，**只有两项该做**。

### 1. `/me/history` 不存在 —— 它是 Legacy 的标签，不是功能

判据（三条独立证据）：

| 证据 | 结果 |
|---|---|
| 全后端 grep `me/history`、`HistoryView`、`ViewHistory` | **0 命中**（无 controller、无 DTO、无 service） |
| 全后端 grep `listByAuthorId` 等历史类查询 | 只有 comment / moment / event-submission 的作者查询，**没有浏览历史表** |
| 活体探针 `GET /api/v1/me/history` | **500**（无 handler，且未落入鉴权白名单） |

它唯一的出处是 Legacy `lib/screen-registry.ts` 的一行标签
（`["阅读历史", "/me/history"]`）—— 那是**屏幕清单**，不是路由实现。
Legacy 也从未调用过它。

> **不做。** 若将来要做「阅读历史」，那需要**后端先建表 + 建端点**，
> 属于新功能而非迁移。V2 刻意不建这个页面：一个必然 500 的页面就是伪完成。

### 2. `/me/likes` 与 `/me/comments` 契约（已迁）

`CommunityMeController @RequestMapping("/me")`：

| 端点 | 返回 | 说明 |
|---|---|---|
| `GET /me/likes?limit=20` | `MyLikeView[]` **裸数组** | 无 cursor、无 total → **前端无法分页** |
| `GET /me/comments?limit=20` | `MyCommentView[]` **裸数组** | 同上 |

四个会改变 UI 诚实度的细节：

- **`MyLikeView` 没有 `id`** —— 复合键是 `objectType` + `objectId`，
  React key 必须用两者拼接，否则同 id 不同类型的行会被合并。
- **`title` / `objectTitle` 服务端会回落成 `objectId`**
  （`document == null ? getObjectId() : getTitle()`）。
  一个长得像 UUID 的标题是**真实数据**，不能替换成好看的占位文案。
- **评论 SQL 过滤 `status = 'VISIBLE'`** —— 用户写过但后来被隐藏的评论**不会出现**。
  所以文案**不能写「全部评论」**：缺行不等于用户没写过。
- **点赞表没有 status 列** —— 取消点赞是 `DELETE` 行，所以这个列表恒等于
  「**此刻**喜欢的内容」，不是「喜欢过的历史」。文案不能暗示历史。

链接一律走共享的 `contentHref`（`components/shared/ContentCard.tsx`）：
它只把 ARTICLE / SERIES / MOMENT 解析成真实路由，**其余一律降级到 `/discover`**，
绝不猜 `/u/:id`。原始 `objectType` 会同时显示在行内，让未映射的类型**可见**
而不是静默跳到错的地方。

> 评论行链接的是**被评论的内容**，不是评论本身。
> `MyCommentView.id` 是评论 id（Legacy 有 `/comments/:id`），但 V2 没有该路由，
> 链到那里就是死链。

### 3. 教训 · 再次确认「405/500 ≠ 路由存在」的读法

这次是 `/me/history` 返 **500**（而不是 404/405）。
500 的成因是**没有 handler 且未匹配到鉴权白名单**，属于框架层兜底，
所以它和 404 一样**不能**用来判断「路由是否存在」的反面 ——
真正的判据始终是**读 controller 源码**。探针只用来确认「活着的那条是不是我理解的样子」。
（与 §三·补2 的 `405 ≠ 404` 是同一条纪律的两个落点。）

---



清点时按 Legacy 的调用推断的三个前提，写码前逐一核对后发现**都不准确**：

| 原推断 | 实际情况 | 后果 |
|---|---|---|
| 通知列表返回 `PageResult` | **裸数组** `List<NotificationView>` | 读 `.items` 会得 `undefined` → 白屏。注意这与 2I-1 的关注列表**恰好相反** |
| DTO 有 `targetRoute` | **没有**。全后端 grep `getTargetRoute`/`targetRoute` **0 命中**；DTO 只有 6 个字段 | Legacy 的深链是**纯前端幻觉**。V2 不建模该字段，改用按 category 推导的兜底目的地；无安全目的地时渲染成纯文本，**不做死链** |
| 通知种类很多 | 生产端只有 `FOLLOW` 一种（全后端 `setCategory` 仅 1 处） | UI 的 category 映射必须是**包含式**且未知值原样回显，否则后端加新种类就会渲染成空行 |

另有三点运营事实：

- **`/notifications` 并非迁移而是新建**。Legacy 自己已把该路径 `redirects.ts` → `/`，
  通知只存在于头部悬浮面板。V2 的 `/notifications` 是新页面。
- **不要把它加进 `LEGACY_REDIRECTS`**：该表被 `routes.test.tsx` 的
  「恰好五条」断言钉死，且 Legacy 侧该路径本就废弃。
- **标记已读有意不照搬 Legacy 的乐观更新**。Legacy 在 PATCH 失败时仍把行置为已读；
  V2 保持失败即不改状态（诚实优先），仅提示错误。

---

## 三·补4 · Phase 2J-2 「举报 / 申诉」契约与 Legacy 的错误状态映射（源码 + 实测，2026-09-27）

### 4.1 读写在不同 Controller，且路径不同（本仓库第二次出现该模式）

| 动作 | 方法 | 路径 | Controller |
|---|---|---|---|
| 列我的举报 | GET | `/me/reports` | `CommunityMeController @RequestMapping("/me")` |
| 看举报详情 | GET | `/me/reports/{reportId}` | 同上 |
| 追加补充说明 | POST | `/me/reports/{reportId}/supplements` | 同上 |
| 列我的申诉 | GET | `/me/appeals?limit=20` | 同上 |
| 看申诉详情 | GET | `/me/appeals/{appealId}` | 同上 |
| **提交举报** | POST | **`/reports`** | `CommunityModerationController @RequestMapping("/reports")` |
| **提交申诉** | POST | **`/appeals`** | `CommunityAppealController @RequestMapping("/appeals")` |

**写在资源根、读在 `/me/*`**。V2 的路由因此挂在 `/reports`、`/appeals`（**不是** `/me/reports`），
与 Legacy 的真实页面路径一致（`xingyu-web/app/me/reports`、`app/me/appeals` 是**空目录**）。

### 4.2 ⚠️ Legacy 的状态标签映射是错的 —— 不要复制

Legacy `app/reports/page.tsx` 映射：

```
PENDING / UNDER_REVIEW / RESOLVED / CLOSED
```

但全后端 `setStatus` 穷举后，**实际只会写入**：

| 实体 | 真实状态 |
|---|---|
| report | `SUBMITTED` → `CLOSED` |
| case | `OPEN` → `CLOSED`（守卫接受 `SUBMITTED`/`TRIAGED`） |
| appeal | `SUBMITTED` → `DECIDED` |

也就是说 Legacy 的 4 个标签里有 **3 个永远不会命中**，会把真实状态原样渲染成英文枚举。
V2 只映射可发生的值（`SUBMITTED`→已提交、`TRIAGED`→已受理、`CLOSED`→已关闭；
`SUBMITTED`→已提交、`DECIDED`→已裁定），**未知值原样回显**，并写测试
`never renders Legacy's invented labels` 钉住该结论。

### 4.3 DTO 的可空字段决定了 UI 的三处「拒绝伪完成」

- `UserReportDetailView` 的 `caseId` / `caseStatus` / `measureId` **都可为空**。
  `submitReport` 同事务会开一个 `case(OPEN)`，所以**新建的举报一定有 `caseId`**；
  可空路径是给历史数据准备的。
- 因此 V2 做了三处收敛，而不是渲染必然报错的控件：
  1. `caseId` 为空 → **整个「关联案件」块不渲染**；
  2. `measureId` 为空 → **不渲染申诉链接**，改为说明文案
     「尚未对该案件作出处置，暂无可申诉的措施。」（后端 `submitAppeal` 解析不到 measure 会直接拒）；
  3. `NewAppealPage` 在 `caseId`/`measureId` 都缺失时 → **不渲染表单**，改渲染空态 + 指路 `/reports`。
- 补充说明表单仅在 report 为 `SUBMITTED`/`TRIAGED` 时显示（服务端 `ModerationService:322` 同样只在
  这两个状态下接受），`CLOSED` 时不给输入框。

### 4.4 `AppealDetailView` 没有 `caseStatus`

申诉 DTO 只有 `{id, caseId, body, status, createdAt}`。V2 **不显示案件状态**，
只展示 `caseId` 本身，不声称知道案件进展 —— 避免用前端推断代替后端事实。

### 4.5 `GET /me/reports` 没有 `limit` 参数

与 `/me/likes`、`/me/comments`（都有 `limit`）不同，`listMyReports` 方法**没有 `@RequestParam`**。
V2 的 `reportsApi.listMine()` 因此**不接受参数**；`appealsApi.listMine(limit = 20)` 才带。

---

## 四、建议的处置路径（供决策）

既然缺口是**前端未搬**而非**后端未实现**：

```
保留 xingyu-web  →  继续按 Phase 分批搬（P0 → P1 → P2）  →  全部覆盖后再删 Legacy
```

不建议现在删除或归档，理由：
- 删了 = 这 25 个功能**当场从产品上消失**（不是"暂时没有页面"，而是"没有实现"）。
- 归档到 `archive/` 也有代价：仓库仍背着 15000 文件，且**双前端维护成本还在**。

**建议下一步**：把上面的 P0 拆成 Phase 2I/2J，优先做
**「私信 → 关注关系 → 通知中心」**（这三块构成完整的社交闭环），
再动 Events（后端已公开可读，性价比高）。

**实际推进顺序（用户 2026-09-27 指定「按功能顺序迁移」）：**

| Phase | 内容 | 状态 |
|---|---|---|
| 2I-1 | 关注关系 `/me/following`、`/me/followers` | ✅ `5605dd9` |
| 2I-2 | 通知中心 `/notifications` + Header 真实入口 | ✅ 本次 |
| 2I-3 | 私信 / 消息中心（20+ 端点，最大一块；写码前需四源确认 + 范围裁剪） | ⬜ 下一个 |
| 2I-4 | 活动 Events（后端 200 公开可读）+ 动态发布 | ⬜ |

**优先级修正**（核实后）：
- **Events 应上调到 P0** —— 唯一确认公开可读（200）的缺口，且用户侧可见度高。
- **`/creators` 可低成本先做** —— 全部复用已有接口，无新后端。
- **`/rankings`、`/categories`、`/features`、`/help` 建议不做或并入现有页** ——
  前三个是前端拼装（无独立数据源），`/help` 与 `/guide` 同源。
  **不要为了"路由对齐"而搬它们**，那只会造出四个和 `/discover`、`/guide` 语义重叠的页面。


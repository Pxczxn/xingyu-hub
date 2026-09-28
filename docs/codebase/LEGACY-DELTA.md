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
| **活动 Events** | `events` 下 **8 条**（含报名/提交/结果/排行） | ✅ **200（公开可读！）** | → **已迁（Phase 2I-4，`6172aaa`）**：API 域 + 4 页面（`/events`、`/events/:eventId`、`/events/:eventId/submit`、`/me/events`）。**⚠️ 本行曾长期标为"待办"，是过期信息** —— 见 §三·补5 |
| **榜单** | `/rankings` | ⚪ **无独立后端** | 页面是 `getDiscover`+`getGalaxies`+`getTopics`+`listSeries` 的**前端拼装**（已核实，4 处引用全是复用） |
| **分类** | `/categories` | ⚪ **无独立后端** | 仅 `getDiscover`+`getTopics` 拼装 |
| **精选** | `/features` | ⚪ **无独立后端** | `getDiscover`+`getSuggestedUsers`+`getTopics`+`listSeries` 拼装 |
| **创作者** | `/creators` | ✅ 复用已有 | `getProfile`/`getTopicCreators`/`getUserWorks`/`followUser`/`unfollowUser` → **已迁（Phase 2K-1）**，零后端改动，见 §三·补6 |
| **举报 / 申诉** | `reports` 下 4 条、`appeals` | ✅ 401 | 读在 `/me/reports`·`/me/appeals`，**写在资源根** `/reports`·`/appeals` → **已迁（Phase 2J-2）**，见 §三·补4 |
| **帮助中心** | `/help`、`/help/:slug` | ✅ 复用 `/guide` | **✅ 已核实（Phase 2L，2026-09-28）：结论是不做** —— 与 `/guide` 同一数据源 `getGuidePages()`，且 `/help` 是**严格更弱**的版本。见 §三·补8 |

> 这三条 ⚪「无独立后端」是本次核实出的**重要修正**：`rankings`/`categories`/`features`
> 不是「有后端没前端」，而是**纯前端聚合页**。做它们不需要任何后端改动，
> 但也意味着**它们没有"官方数据源"**——搬过去会改掉现在 `/discover` 的定位，**建议先不搬，或直接并进 `/discover`**。

### 🟡 P2 — 创作台深化

| 功能 | Legacy 路由 | 说明 |
|---|---|---|
| 数据分析 | `/studio/analytics` | → **已迁（Phase 2L）**：复用已有 `meInsightsApi`（`GET /me/insights`），零新 API。**修正 Legacy 的失败模式**（失败时渲染 `—`，与真实 0 无法区分）→ 见 §三·补9 |
| 素材库 | `/studio/assets` | **✅ 已核实（Phase 2N，2026-09-28）：结论是不做** —— 45 行，只调 `listMyArticles()` + `listMySeries()`，与现有 `/studio/series` + 投稿列表**同源且严格更弱**（`meta` 直接印 `item.status` 原始枚举不翻译，无操作/无筛选/无空态区分）→ 见 §三·补11 |
| 协作 | `/studio/collaboration`、`/accept` | → **已迁（Phase 2M）**，但 **后端是「空心功能」**：`acceptInvite` **0 写操作**、无关系表、无读取方，**接受邀请不产生任何协作权限**。两页照做，文案**实测声明该边界**；并修掉 Legacy 的 `/u/:username/works` 死链 → 见 §三·补10 |
| 版本历史 | `/studio/content/:id/versions` | → **已迁（Phase 2L）**：`listRevisions` + `restoreRevision`。**修正 Legacy 的三处错误文案**（把「发布版本」谎称「自动保存」等）→ 见 §三·补9 |
| 投稿管理 | `/studio/submissions/:id` | → **已迁 + 增强（Phase 2K-2）**：列表 `/studio/submissions` + 详情 `/studio/submissions/:submissionId`。**「撤回投稿」是新增功能而非迁移** —— Legacy 定义了 `withdrawReviewSubmission` 却 **0 处调用**（死代码），详情页是只读的。见 §三·补7 |
| 创作台设置 | `/studio/settings` | **✅ 已核实（Phase 2N，2026-09-28）：结论是不做** —— 40 行静态壳、**0 次 API 调用**、无表单无状态；三条「设置」两条是坏的（「创作空间分类」`href` **指向自己**，「精选展示」指向 `/studio/content` 而那是编辑器单篇路由 → 404）→ 见 §三·补11 |
| 创作空间分类 | ~~无~~ `/studio/categories` | → **已迁（Phase 2N）**：**这不是迁移，是补一个从未做过的页面**。后端 `CommunityCreationSpaceController` 有**完整 CRUD**（`/api/v1/me/creation-space/categories`，含乐观锁 + slug 校验 + 归档），Legacy **从未为它做过页面**（只在 redirects 里把它指向空的 `/studio/settings`）→ 见 §三·补11 |
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

## 三·补5 · ⚠️ 本文档的 P1「活动」行曾是过期信息（2026-09-27 实测，代价：一次错误的开工）

**事实**：活动（Events）在 **Phase 2I-4（`6172aaa`）** 就已完整迁移完毕，包括：

| 已交付 | 路径 |
|---|---|
| API 域 | `src/api/events/`（`events.types.ts` / `events.api.ts` / **`events.picker.ts`**） |
| 页面 | `src/features/events/pages/` 4 个：`EventsPage`、`EventDetailPage`、`EventSubmitPage`、`MyEventsPage` |
| 路由 | `/events`、`/events/:eventId`（公开可读）、`/events/:eventId/submit`、`/me/events` |
| 测试 | 6 个测试文件（含 `events.types.test.ts` 22 项、`events.picker.test.ts` 18 项） |

而本文档 P1 表格直到本轮之前仍把活动标为待办且写「优先级应上调」。

**代价**：我据此开工，重写了 `events.types.ts` / `events.api.ts` / `events.api.test.ts`
三个**已存在且已提交**的文件，覆盖了 `6172aaa` 的实现。多亏 `git status` 显示这三个文件是
`M`（修改）而不是 `??`（新增），才发现它们是已跟踪文件 —— 否则会静默覆盖。
已用 `git checkout --` 完整恢复，恢复后 `src/api/events/` **53 项测试全绿**。

### 教训：**开工前必须先用 `git ls-files` 确认"这个模块是否已经存在"**

```bash
# 任何"要新建一个模块"的动作之前，先跑这一条：
git ls-files | grep -iE "<模块名>"
```

如果命中已跟踪文件，**这个功能大概率已经实现了** —— 先读它，再决定做什么。

配套判据（按可靠性排序）：

1. **`git ls-files` / `git log -- <path>`** —— 最权威，直接说明有无历史实现；
2. **`git status --short <dir>`** —— 看目标是 `M`（已跟踪，有原版可恢复）还是 `??`（真新增）；
   在**写入前**跑，能救命；
3. **读 `docs/codebase/LEGACY-DELTA.md` 的"已迁"标注 + 对照 `git log`** ——
   但**本文档可能与代码脱节**，不能单独作为依据。

⚠️ **`LEGACY-DELTA.md` 是认知快照，不是实时状态。** 判断"某功能有没有迁"时，
它只能用来**缩小候选范围**，**最终必须由代码本身裁决**（`git ls-files` + 读实现）。
本轮就是只信了文档、没查代码。

### 同类错误已第四次发生（历史记录）

| 轮次 | 差点/实际做了什么 | 真相 |
|---|---|---|
| 2I-4b | 以为"V2 不能发动态"，准备写发布页 | 发布早已在 `MomentsPage` 内 |
| 2I-5 | 同上（承前） | 同上 |
| 2J-1 | 以为 `/me/history` 是待迁页面 | 仅存在于 Legacy `screen-registry.ts` 标签，后端 0 命中 |
| **2K-1** | **重写了整个 events API 域** | **Phase 2I-4 已迁完，文件已提交** |

**四次的共同根因：拿二手信息（文档 / 屏幕清单 / 目录名）当事实，没查一手代码。**

---

## 三·补6 · Phase 2K-1 `/creators`：一个"永远为空"的页面（源码 + 真实数据实测，2026-09-27）

### 6.1 它是纯前端聚合页，零后端改动

`/creators` **没有对应的后端端点**。V2 复用了已迁的 topics/users API，扇出形状与 Legacy 一致：

```
GET /topics                        → 取前 8 个专题
GET /topics/{slug}/creators        → 每专题前 8 位作者
GET /users/{username}              → 装饰（头像、following）
GET /users/{username}/works        → 装饰（最新公开作品）
```

因此**本阶段新增 0 条后端调用**。

### 6.2 ⚠️ 真实数据下这个页面是空的 —— 而且不能归咎于筛选

`listCreators`（`TopicService:203`）的实现是：

```java
return articleTopicMapper.listTopOwners(topic.getId(), limit)...
```

即**从 `article_topic` 关联「已发布文章」的作者**。实测（2026-09-27，本地 7779）：

| 专题 slug | `/creators` 返回 |
|---|---|
| ai / announcement / design / general / life / opensource / reading / startup | **全部 `[]`（共 0 位）** |

**8 个专题全部返回空数组。** 所以这个页面在**当前数据下必然渲染空态**，
且原因**不是**用户筛选，而是**专题下还没有已发布内容**。

V2 因此把空态拆成两条**措辞不同**的分支：

| 条件 | 文案 | 含义 |
|---|---|---|
| `creators.length === 0` | 「暂无可推荐的作者 / 已收录的专题下暂时还没有已发布的内容」 | 数据层面就没有 |
| 其余（筛选/搜索后为空） | 「暂无匹配作者 / 调整专题或关键词后再试」 | 是用户自己的筛选造成的 |

**如果把这两条合并，就会把"社区还没内容"说成"你的筛选没匹配上"** —— 那是在骗用户。
浏览器验收专门断言了「真实数据下渲染的是前者、且不含后者」。

### 6.3 筛选与搜索是纯客户端的，UI 必须说明

没有服务端创作者搜索。筛选 chips 只能作用于**已扇出的那 8 个专题**，
搜索也只匹配**已收录的作者**。页面因此渲染一条 scope note：
「本页收录来自前 N 个专题的作者；筛选与搜索仅作用于已收录的作者，**不是全站搜索**。」

### 6.4 修正 Legacy 的乐观更新（与 2C 通知已读同一条纪律）

Legacy 的 `toggleFollow` **先翻转按钮、再发请求，失败不回滚**：

```tsx
try { await communityApi.followUser(...); setCreators(rows => rows.map(... !following ...)) }
catch { setError("关注操作未完成…") }   // ← 按钮已经翻转了，且不会翻回来
```

V2 改为**只在请求成功后才翻转**，失败保留原状态并提示。测试 `keeps the previous state and
surfaces an error when follow fails` 钉住这一点。

### 6.5 `following` 未知时不渲染按钮

`following` 来自装饰性的 `GET /users/{username}`，该请求可能失败。
此时 `profile.following` 为 `undefined` —— V2 **不渲染关注按钮**，
因为一个状态可能反着的开关比没有开关更糟。测试覆盖该分支。

---

## 三·补7 · Phase 2K-2 投稿审核：把 Legacy 的「死代码」变成真功能（2026-09-27）

### 7.1 三端点先做活体确认（路径是真的）

```
GET  /api/v1/me/submissions?limit=20        -> 401 AUTH_REQUIRED   ✅ 存在，需身份
GET  /api/v1/me/submissions/s1              -> 401 AUTH_REQUIRED   ✅ 存在，需身份
POST /api/v1/me/submissions/s1/withdraw     -> 401 AUTH_REQUIRED   ✅ 存在，需身份
GET  /api/v1/moments                        -> 200 []              （对照，证明探针通）
```

⚠️ **探针必须带 `/api/v1` 前缀**。本轮第一次探针漏了前缀，结果 `/me/submissions` 返回
**HTML（SPA fallback 的 index.html，200）**、`/me/submissions/s1/withdraw` 返回 **405**
—— 差点据此写出「路径不存在」或「方法未绑定」的错误结论。
真因：后端只对 **`/api/*`** 返回 JSON（未匹配 → Spring 404 JSON），其余路径一律回落到前端 `index.html`。

> **判据**：探针返回 HTML 而非 JSON ⇒ **前缀写错了**，不是路由不存在。
> 405 也可能是这个原因造成的假象。**先确认前缀，再解读状态码。**

### 7.2 状态机：去后端穷举 `setStatus`，共 5 个值

`ReviewService` 里所有 `setStatus`：

| 位置 | 写入值 | 触发 |
|---|---|---|
| `line 78` | `"PENDING"` | 用户提交 |
| `line 163` | `"WITHDRAWN"` | 用户撤回 |
| `line 203` | `normalizeDecision(...)` | 管理员裁定，只允许 `APPROVED` / `REJECTED` / `RETURNED` |

→ 状态集 = **`PENDING` / `APPROVED` / `REJECTED` / `RETURNED` / `WITHDRAWN`**。

**这次 Legacy 的映射是对的**（与 §三·补4 举报那次的错误映射相反）。
**结论：不要一刀切假设 Legacy 对或错，必须逐案去后端穷举。**

`STATUS_META` 的未知值处理沿用 §三·补4 纪律：**原样回显状态码**，
描述文案给 `"当前状态暂无法识别。"` —— **不借用别的状态的文案**。

### 7.3 ⚠️ 撤回是**新功能**，不是迁移

Legacy `community.api.ts` 里有：

```ts
export async function withdrawReviewSubmission(id: string): Promise<{ id: string; status: string }> {
  return apiRequest(...);   // 后端实际返回 ReviewSubmission 实体，不是 {id,status}
}
```

两个问题叠加：
1. **返回类型声明错误**（后端返实体，字段远多于 `{id,status}`）；
2. **全 Legacy grep 0 处调用** —— 纯死代码，所以 Legacy 详情页**根本没有撤回按钮**。

V2 把后端一直支持、前端从未接通的能力**真正做出来**：
- **只对 `PENDING` 显示按钮**（后端 `withdraw` 对非 PENDING 抛 `CONFLICT`），
  其余状态**隐藏**而不是渲染一个点了必失败的禁用按钮；
- 确认框写明**副作用**：「撤回后稿件会回到可编辑状态」——
  `withdraw` 会**同时把底层文章推回 `EDITORIAL_DRAFT`**，这是用户可见的影响，必须提前讲；
- 成功后**应用服务端返回的 `status`**，不 refetch（后端返回的就是权威值）。

### 7.4 ⚠️ `detail` 可能是 `undefined` —— 一个"点了没反应"的真 bug

**症状**：撤回失败时 alert 完全不出现在 DOM 里。探针输出极其反直觉：

```
PROBE confirm button found: true
PROBE withdraw args: [["s1"]]      ← 请求确实发出去了
PROBE alert count: 0               ← 但没有任何提示
```

**根因**：

```tsx
setActionError(error.problem.detail);   // ❌ detail 为 undefined
```

`setActionError(undefined)` 在 React 看来**与初始值 `null` 不等价但同属"无更新"路径**，
状态比较判定为无变化 ⇒ 整块 `{actionError ? <p role="alert">…` **不渲染**。
用户看到的现象是：点了「确认撤回」，弹框消失，**然后什么都没有** —— 比报错更糟。

**修法**：抽 `describeError(error, fallback)`，**始终在 `problem.detail` 之下垫一层兜底**：

```tsx
function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.problem.detail?.trim() || fallback;
  return fallback;
}
```

**⚠️ 活体探针补充了一个关键事实**：真实 401 响应的 `detail` 是**非空字符串**（`"请先登录"`）。
所以这个 bug **只在部分错误路径（无 body / body 缺 `detail`）才会复现** ——
这正是它能在测试里潜伏的原因，也是为什么**不能只依赖单元测试**，要配 DOM 探针看真实渲染。

### 7.5 前端路由是 `/studio/*`，API 是 `/me/*`

Legacy 把投稿放在 `/studio/submissions/{id}`，后端在 `/me/submissions*`。
V2 **保留这个 split**（studio 是写作者找自己投稿的地方），并在路由注释里写死原因 ——
否则后人很容易"顺手对齐"成 `/me/submissions` 而改坏。路由测试专门钉住这一点：
`/me/submissions` 必须落到 404 `NotFound`。

### 7.6 游客态验收（14/14）

游客能验的只有守门这一层，但恰好是最容易出伪功能的地方：

| 断言 | 为什么重要 |
|---|---|
| 两条路由都把游客弹到登录页 | 「未登录」不能伪装成「没有投稿」 |
| 游客页**不出现**「暂无投稿记录」 | 空列表文案意味着"你确实没有投稿"，是错误陈述 |
| 游客页**不出现**「投稿不存在或无权查看」 | 同上，404 文案对游客是误导 |
| `returnTo` 保真（详情 → `/studio/submissions/s1`） | 登录后要回原页，不是首页 |
| 登录页无「我的投稿」链接 | 不向游客暴露入口 |
| `/me/submissions` → 404 | 钉住 §7.5 的前端契约 |

---

## 三·补8 · Phase 2L 帮助中心：**核实后决定「不做」**（2026-09-28）

### 8.1 结论先行

`/help` + `/help/:slug` 的处理方式是 **不迁移、也不新建页面**。
它是一个**已被 `/guide` 完全覆盖**的冗余入口。这不是偷懒，是核实后的结论 —— 证据如下。

### 8.2 证据一：同一数据源

```tsx
// Legacy xingyu-web/app/help/page.tsx
const { data: pages } = useAsyncData(() => communityApi.getGuidePages(), []);
// Legacy xingyu-web/app/guide/page.tsx
const { data }       = useAsyncData(() => communityApi.getGuidePages(), []);   // ← 同一个调用
```

两个页面消费**完全相同的** `getGuidePages()`，`PageHero` 的差异只有文案
（「帮助中心」/「使用指南」）。**没有 `getHelpPages` 这种东西** —— `/help` 不是独立数据源。

### 8.3 证据二：`/help` 是**严格更弱**的版本

| 能力 | Legacy `/help` | Legacy `/guide` |
|---|---|---|
| 列表 | ✅ 纯文本 `<ul>` | ✅ 卡片网格 + `summary` 摘要 |
| **搜索** | ❌ 无 | ✅ 有（按 `title` + `summary` 过滤） |
| 空态区分 | ❌ 只有「暂无帮助内容」 | ✅ 区分「无匹配」与「指南发布后会展示」 |
| 联系支持 | ❌ 无 | ✅ 有（footer 引导到 `/feedback/recommendations`） |

所以 `/help` 相对 `/guide` **一项能力都不多**。

### 8.4 证据三：`/help` 自己的链接指向 `/guide`

```tsx
// Legacy app/help/page.tsx —— 注意 href 是 /guide，不是 /help
<Link href={`/guide/${page.slug}`}>{page.title}</Link>
```

**列表项的详情链接指向 `/guide/{slug}`**。也就是说 `/help` 实质上只是
`/guide` 的一个**别名着陆页**，连它自己都承认详情页归 `/guide` 管。

### 8.5 证据四：`/help/:slug` 是个 23 行的静态壳

`app/help/[slug]/page.tsx` 是 23 行硬编码文案（「开始探索星语」「遇到问题怎么办？」），
**不读 slug、不取数据**。即 Legacy 里 `/help/:slug` 在任何 slug 下渲染的都是同一段文字。
它唯一的链接是「返回帮助中心」→ `/help`（自指）。

### 8.6 V2 现状：`/guide` 已完整，且已含反查入口

V2 `GuideIndexPage`（`/guide`）已具备：列表、空态、以及
**「社区规则」链接**（`Link to="/rules"`）。`GuideDetailPage`（`/guide/:slug`）已在。

→ **一个 `/help` 用户能得到的信息，`/guide` 全部覆盖，且更多。**
仅缺一个「/help → /guide」的重定向，但 V2 不承担 Legacy 的 URL 兼容义务
（用户从未提出该要求），所以**连重定向也不加**。

### 8.7 与 §三·补5 的关系（"不要为了路由对齐而搬"）

本决策是 §四末尾那条纪律的**第一个正式应用**：

> `/rankings`、`/categories`、`/features`、`/help` 建议不做或并入现有页 ——
> **不要为了"路由对齐"而搬它们**，那只会造出语义重叠的页面。

当时对 `/help` 写的是「大概率应并入」；本轮**核实并坐实**了这个判断。
两处的差异值得记住：**「大概率」只是推测，「已核实」才是结论** ——
补8 的四条证据（同源 / 更弱 / 自指 / 静态壳）就是把它从推测变成结论的东西。

---

## 三·补9 · Phase 2L 版本历史 + 数据分析：两处 Legacy 的「漂亮谎话」（2026-09-28）

### 9.1 版本历史：把「发布版本」谎称为「自动保存」

Legacy `app/studio/content/[articleId]/versions/page.tsx`：

- 标题叫「**草稿恢复点**」；
- 每一行都标「**自动保存**」；
- 页脚写着「**自动保存每 3 分钟生成一次草稿版本**」。

**这三句全是假的。** 后端 `ArticleService.listRevisions` 读的是
**`formalRevisionMapper.listByArticleId`** —— FORMAL（正式）版本，由**文章发布**时写入。
一篇只保存过、从未发布的草稿，版本历史是**空的**。

后果：用户会以为存在每 3 分钟一次的自动快照，从而**放心地不备份**。这是"看起来更贴心"的谎话，
比直接说"暂无版本"有害得多。

V2 的措辞：
- 标题「**历史版本**」；
- 每行「**发布版本 · 第 N 版**」；
- 空态**解释原因**：「历史版本在文章发布时生成。这篇文章还没有发布过，所以还没有可恢复的版本。」

测试用 `expect(body).not.toContain("自动保存")` 与 `not.toContain("每 3 分钟")` 钉死。

### 9.2 版本历史的两处附带修正

**其一：Legacy 的分支永远不会命中。**

```tsx
{revision.visibility === "PUBLISHED" ? "发布前版本" : "自动保存"}
```

`Visibility` 的真实取值是 `PUBLIC` / `UNLISTED` / `PRIVATE`（见 `articles.types.ts`），
**从不含 `PUBLISHED`** → 这个三元**恒走 else**，那一行代码是死的。
V2 不复刻一个永远走不到的分支，改为正经渲染 `visibilityLabel()`。

**其二：Legacy 的「版本预览」展示的是当前草稿，不是选中的版本。**

Legacy 把 `draft.body`（**当前草稿正文**）渲染在「版本预览」面板里，而面板上方的标题
却是**选中版本**的标题 —— 两者根本不是一个东西。用户点第二个版本，看到的正文还是当前的。

真相是 `ArticleRevisionView` **压根没有 body 字段**（只有 id / revisionNumber / title /
summary / visibility / frozenAt）。V2 因此**只展示版本真正定格的内容**，并明说：

> 版本记录只保存发布时定格的标题、摘要与可见性；**正文不会在这里提供预览**。

### 9.3 恢复版本的状态门禁（去后端读，不猜）

`ArticleService.restoreRevision` 第一件事是 `if (!ArticleStateSupport.canEditDraft(article)) throw 409`。
`canEditDraft` = **ACTIVE lifecycle** + **NORMAL moderation** + **非 IN_REVIEW**。

→ 「已发布」**不等于**「不可编辑」：PUBLISHED 文章正常可回滚（这正是本页的核心用途），
而**排队审核中的（IN_REVIEW）不行**。所以 V2 的按钮可见性：
`PUBLISHED` ✅ / `DRAFT` ✅ / `IN_REVIEW` ❌ / 状态未知 ❌。

被禁用时**说明原因**（`restoreBlockedReason`），而不是静默隐藏按钮 ——
"为什么不能点"比"什么都没有"更有用。

**另一个容易漏的副作用**：`restoreRevision` 会 **`lockVersion + 1`**。
所以任何持有旧 `lockVersion` 的编辑器实例，其下一次保存都会被乐观锁拒绝。
这写进了 API 注释。

### 9.4 数据分析：失败与「0」长得一模一样

Legacy 的 `analytics/page.tsx` 是 42 行的壳，只有两个状态：`insights` 与 `!insights`。
于是：

```tsx
<StatCard label="获得喜欢" value={insights?.likeCount ?? "—"} />
```

**请求失败 → `—`；正在加载 → `—`；真实的 0 → `0`。**
失败与加载**视觉上无法区分**，而 `—` 又极容易被读成"还没有数据"。
用户永远不知道是"我确实是 0"还是"系统根本没查到"。

V2 把三态显式拆开（loading / error / ready），失败时**明说**：

> 暂时无法读取你的创作数据，因此这里不显示任何数字。请稍后重试。

并且**失败时不渲染计数器区块**（测试断言 `queryByLabelText("创作数据")` 为空），
从结构上杜绝「读不到」被渲染成「0」。

**顺带**：`InsightsView` 有 **6 个**计数器，Legacy 只展示 3 个
（articleCount / likeCount / commentCount），静默丢弃了 draftCount / followerCount / followingCount。
V2 全部展示 —— 接口已经返回了，丢掉没有理由。

### 9.5 「不要为了路由对齐而造死链」

Legacy 的 analytics 页没有任何跳转链接。V2 想加「我的稿件」，但核实后发现
**`/studio/content` 这个列表路由并不存在**（只有 `/studio/content/:articleId`）。
于是**不加这个链接**，并在代码注释里写死原因 —— 否则它就是一个稳定的 404。
写了一条测试遍历所有 `<a href>`，断言不存在 `/studio/content`。

这是 §三·补8 那条纪律（不要为对齐而搬）在**页内链接**粒度上的同一条：
**能渲染出来 ≠ 指向存在的东西。**

---

## 三·补10 · Phase 2M 协作邀请：后端是个**空心功能**（2026-09-28）

### 10.1 核实结论（源码级）

`CommunityCollaborationController`（`@RequestMapping("/collaboration")`）暴露两个端点，
写入口在 `CommunityMeController`。三个端点对应三件事：

| 端点 | 身份 | 实际行为 |
|---|---|---|
| `POST /me/collaboration-invites` | 需登录 | **真写**：`inviteMapper.insert(invite)` 插入一条邀请行 |
| `GET /collaboration/invites/resolve` | **公开** | 只读查询，返回邀请人资料 |
| `POST /collaboration/invites/accept` | 需登录 | **零写操作** |

决定性证据 —— `CollaborationService` **全类唯一的写操作**就是创建邀请时的
`inviteMapper.insert(invite)`。`acceptInvite` 只做三件事：

1. 校验 token（失效 → `NOT_FOUND "邀请已失效或不存在"`）；
2. 拒绝自邀（本人 → `CONFLICT "不能接受自己的邀请"`）；
3. 返回**邀请人**的资料。

**它不写入接受者、不写入时间、不建立任何关系。**

数据库侧同样印证（`sql/V024__remaining_features.sql`）：

- `collaboration_invite` 表**没有** `accepted_by` / `accepted_at` 列；
- 全库**没有** `collaborator` / `space_member` 之类的成员表；
- 全后端**没有任何地方**读「谁接受了邀请」。

结论：**接受邀请后，双方都不获得任何权限。**
这条邀请链接目前是「一条带已读回执的消息」，**不是一份授权**。

### 10.2 处理方式：两页都做，但文案实测声明边界

用户决策（2026-09-28）：**「连『接受邀请』页面一起做，但按钮文案与成功页如实写明：
目前仅确认邀请，尚未产生协作权。」**

落地为：

- **`/studio/collaboration`**（创建）— 表单 + 生成**绝对**链接 + 复制；
  能力边界提示放在**表单上方**（发出去之前就该读到），并在结果卡片里**再重复一次**。
- **`/studio/collaboration/accept?token=`**（确认）— resolve（公开）→ 三态；
  成功页标题是 **「已确认 X 的邀请」**，配 `ACCEPTANCE_BOUNDARY_NOTE`。

`ACCEPTANCE_BOUNDARY_NOTE` 作为**单一导出常量**，创建页与接受页共用（成功页也重复展示），
测试直接断言这个字符串 —— 文字一旦被改软，测试立刻失败。

### 10.3 修掉 Legacy 的两处谎话 + 一个死链

Legacy 的接受成功页写的是 **「已接受协作邀请」**，配一个「查看协作空间」按钮 ——
在 0 写操作的后端之上，这句话读起来就是「你现在是协作者了」。
这和 §三·补9 的「自动保存」是**同一类错误**：界面承诺了后端没有的东西。

第二处是**死链**：Legacy 跳 `/u/{username}/works`，但 **V2 只有 `/u/:username`**
（`UserProfilePage`，**已经内含「公开作品」区**，自己会调 `getUserWorks`）。
照搬就会在一次成功的「协作」之后再送用户一个稳定的 404。

V2 的做法：

- 文案：**「已确认邀请」**，不是「已加入协作」；
- 链接：**`/u/:username`**，把「看作品」交给那个页面自己已经有的区块；
- username 缺失时（见 10.4）**隐藏按钮**，而不是渲染 `/u/undefined`。

### 10.4 两个必须防的响应形状坑

1. **`resolveInvite` / `acceptInvite` 用 `Map.of(...)` 构造返回** —— `Map.of` **不接受 null**，
   所以 `inviterUsername` / `inviterDisplayName` 可能**整个键缺失**（不是 null）。
   于是类型里除 `valid` 外**全部可选**，`inviterDisplayName()` 走
   `displayName → username → "一位创作者"` 三级回退，**绝不渲染空串或 undefined**。
2. **`valid: false` 是 HTTP 200**，不是错误。必须先 `resolve` 再判 `valid`，
   否则会把「链接失效」（正常业务答案）当成「网络挂了」（我们的问题）——
   两者的用户指引完全不同。

另外：note 的 null 被后端映射成 `""`，所以「没有备注」在线上是**空字符串**而不是 null，
判空必须用 `?.trim()`。

### 10.5 未验证项 + 一个实测发现的既有后端缺陷

**登录态下走完「创建 → 复制 → 打开 → 确认」全流程**未在真实浏览器实测 ——
确认按钮需要真实登录态，而登录本身需要**人工验证码**。游客侧验收 5/5 通过。

⚠️ **实测修正（重要）**：`POST /collaboration/invites/accept` 对游客返回的是 **500**，
**不是 401**（本节早前草稿写的是 401，已按探针结果更正）。根因在
`CommunityCollaborationController:30`：它在调用 service 之前先求值
`CommunityAuthContext.requireUser()`，游客时 ThreadLocal 为空 →
`IllegalStateException` 未被映射为 401 → 落成 `INTERNAL_ERROR`。

这与同批 `POST /me/*`（`CommunityMeController`，游客稳定 401）**行为不一致**。
不影响本次实现（两页都是 `RequireAuth`，游客到不了页面；页面遇 500 走通用错误降级），
但属于**应当修**的既有缺陷 —— 统一由鉴权拦截器在 Controller 之前拒绝匿名请求。

同一文件另有一处**潜在 NPE**：`resolveInvite` / `acceptInvite` 的
`"inviterDisplayName", profile == null ? null : profile.getDisplayName()`
—— `profile` 存在但 `displayName` 为 null 时 `Map.of(...)` 会抛 NPE（500）。
它只处理了「没有档案」，漏了「有档案但字段为空」。本次未触发，未修，一并记录。

### 10.6 附带发现：后端 405 的响应形状**不是** RFC9457

同批探针里，对 `GET /me/creation-space/categories/{id}`（方法未绑定）返回的是
**Spring 默认错误体**：

```json
{"timestamp":"...","status":405,"error":"Method Not Allowed","path":"..."}
```

**没有** `type` / `title` / `detail` / `code`。而业务异常走的是标准 `ProblemDetails`。
所以前端 `toProblemDetails()` 在这个分支上会退化成 `{ type:"about:blank", title:"Request failed",
status:405, detail:<statusText>, code:"UNKNOWN" }` —— 能跑，但**这不是我们要的形状**。
记录备查；当前没有页面依赖 405 的文案。

---

## 三·补11 · Phase 2N：两个「假缺口」+ 一个**从未被做过的功能**（2026-09-28）

### 11.1 判定：`/studio/settings` 与 `/studio/assets` 都**不做**

这两条在上一版清单里还挂着「⬜」，本轮按 §三·补8 的四问核实，**双双命中假缺口**。

**`/studio/settings`（创作设置）— 证据：**

| # | 证据 | 实测 |
|---|---|---|
| 1 | **无数据源** | `grep -cE "useAsyncData\|communityApi\.\|fetch\("` → **0**。没有表单、没有设置项、没有状态 |
| 2 | **自指** | 第一条「创作空间分类」的 `href="/studio/settings"` —— **指向当前页自己** |
| 3 | **另一条是死链** | 「精选展示」`href="/studio/content"`，而那是**编辑器单篇**路由（`/studio/content/:articleId`），裸路径在 V2 必 404 |
| 4 | **它声称管的东西两个都不成立** | 「创作空间分类」后端确有 CRUD 但本页没接（见 11.2）；「精选展示」= `/studio/content` 本身 |

**40 行，纯静态壳。** 三条「设置」里**两条是坏的**，一条指向自己。
搬过来只会新增一个点不动的页面。

**`/studio/assets`（素材库）— 证据：**

| # | 证据 | 实测 |
|---|---|---|
| 1 | **同源** | 只调 `communityApi.listMyArticles()` + `listMySeries()`，与 `/studio/series` 和投稿列表**同一批端点**（注意 `assets` 在 `community-api.ts` 里**零新增方法**，纯复用） |
| 2 | **严格更弱** | `meta` 直接印 `item.status` **原始枚举**（`DRAFT`/`PUBLISHED`）不做翻译；无操作、无筛选、无排序、无空态区分 |
| 3 | **能力已有归属** | 系列在 `/studio/series`，稿件在 `/studio/submissions` —— 两个页面都比它强 |
| 4 | **V2 侧无需补** | 45 行 |

判定：**不建页、不加重定向。**

### 11.2 但是：挖到一个**真缺口** —— 创作空间分类

核实 `/studio/settings` 那条自指链接时，去后端查「创作空间分类」到底有没有能力，
结果是**有，而且是完整的**：`CommunityCreationSpaceController`
（`@RequestMapping("/me/creation-space")`）提供四个端点：

| 端点 | 行为 |
|---|---|
| `GET /categories` | 列当前用户创作空间下的分类 |
| `POST /categories` | 新建（`name` 必填，`slug` 空则由 `name` 派生） |
| `PATCH /categories/{id}` | 改名 / 改状态（**乐观锁**） |
| `DELETE /categories/{id}` | **真的删行** |

而 **Legacy 从未为它做过页面**：`app/studio/categories/` 是个**空目录**（没有 `page.tsx`），
重定向表把 `/studio/categories` 指向空的 `/studio/settings`。

⇒ 这是一个**独立于前四类的新形态**：功能后端完整、前端**从未存在**。
不是「Legacy 有 V2 没有」，而是「**谁都没有**」。所以 2N 的交付**不是迁移，是补建**。

### 11.3 实现要点：按真实契约设计，不按对称性设计

四个被契约逼出来的决定：

1. **归档 ≠ 删除，是两个操作。** `update` 能把 `status` 改成 `ARCHIVED`；
   `delete` 真的 `deleteById`。两者后果完全不同 ⇒ 两个按钮、两套文案、
   删除走 `role="alertdialog"` 二次确认并明写**「无法撤销」**，同时**指引用户改用「归档」**。
   测试断言确认框里出现「无法撤销」与「归档」。
2. **`update` 必须回传 `lockVersion`。** 服务端直接读 body 里的它，
   **缺省按 0 处理** —— 漏传会把每次更新变成假 409。API 测试专门断言
   `lockVersion` 是一个**显式数字**，且 `0` 与「未提供」可区分。
3. **409 / 404 之后必须重读列表，不给「重试」。** 这两者都意味着客户端副本已过期，
   用同一个陈旧版本重试**必然以同样方式失败**。`shouldReloadAfterFailure()` 把这条
   规则做成纯函数并单测（500 返回 false —— 那种情况重试是有意义的）。
4. **不做排序控件。** `sortOrder` **是只读的**：`create` 硬编码 0、`update` 忽略该字段。
   页面上没有任何上移/下移/拖动入口，测试反向断言不存在这类按钮。

另外两条**有意不做**的：
- **别名不可改**：API 允许改 `slug`，但产品里还没有任何地方展示分类的 slug，
  提供「改别名」就是个**看不出效果**的控件 → 只展示、不提供编辑。
- **别名预览显示真实路径**：`/u/{username}/works/{slug}`（V2 真实路由形态），
  用户名未知时降级为 `/works/{slug}`，不编造路径。

### 11.4 「空间不存在」不是「分类为空」

`requireSpaceForUser` 在用户没有创作空间时抛 `NOT_FOUND "创作空间不存在"`。
分类全部挂在空间下，所以这个 404 **不是空列表**，而是**前置条件缺失**。
页面用**独立的一态**（`page-state-empty` + 「创作空间尚未建立」）与真正的空态
（「还没有分类」）区分，测试断言两者的文案**互不包含**。
把「我们读不到」渲染成「你没有」，正是 §三·补9 那条纪律的同一件事。

### 11.5 本地校验镜像服务端

`deriveSlug` / `validateSlug` 逐字对齐服务端的 `normalizeSlug` 与 `SLUG_PATTERN`
（`^[a-z0-9-]{2,64}$`）。**有意不"顺手增强"**：服务端不做字符清理，
客户端也不做 —— 否则用户会在客户端通过、被服务端拒绝，看到一条无法理解的错误。

这条在测试里**自己撞到过**：用 CJK 名称「散文」测「服务端别名冲突」，
结果派生出的 slug `散文` 先被本地校验拦下、压根没发出请求。
**这是正确行为，不是 bug** —— 于是把该用例改成用能通过本地校验的名称，
并**新增一条**用例断言 CJK 名称在本地就被拦下（`createCategory` 未被调用）。

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
| 2I-2 | 通知中心 `/notifications` + Header 真实入口 | ✅ |
| 2I-3 | 私信 / 消息中心（20+ 端点，最大一块；写码前需四源确认 + 范围裁剪） | ✅ |
| 2I-4 | 活动 Events（后端 200 公开可读）+ 动态发布 | ✅ `6172aaa` |
| 2J-1 | 举报（读写 split `/reports` + `/me/reports`） | ✅ |
| 2J-2 | 举报/申诉 6 页面 + 路由 + 导航 | ✅ `73fd0af` |
| 2K-1 | 推荐作者 `/creators`（纯前端聚合，零后端改动） | ✅ `2e691b2` |
| 2K-2 | 投稿审核 `/studio/submissions*` + **新增撤回功能** | ✅ `bf92ffb` |
| 2L | 帮助中心核实（**结论：不做**，并入 `/guide`） | ✅ 见 §三·补8 |
| 2L | 版本历史 `/studio/content/:id/versions` + 数据分析 `/studio/analytics` | ✅ `eb43cd1` |
| 2M | 协作邀请 `/studio/collaboration` + `/accept`（**核实后端为空心功能，文案声明边界**） | ✅ `7efa0cb` |
| 2N | `/studio/settings` + `/studio/assets` 核实（**结论：两个都不做**，均命中假缺口） | ✅ 见 §三·补11 |
| 2N | 创作空间分类 `/studio/categories`（**非迁移：后端 CRUD 完整但 Legacy 从未做页面**） | ✅ 本次 |

**优先级修正**（核实后）：
- **Events 应上调到 P0** —— 唯一确认公开可读（200）的缺口，且用户侧可见度高。
- **`/creators` 可低成本先做** —— 全部复用已有接口，无新后端。
- **`/rankings`、`/categories`、`/features`、`/help` 建议不做或并入现有页** ——
  前三个是前端拼装（无独立数据源），`/help` 与 `/guide` 同源。
  **不要为了"路由对齐"而搬它们**，那只会造出四个和 `/discover`、`/guide` 语义重叠的页面。


# Legacy `xingyu-web` 差异清点（Task #4 前置）

> **状态（2026-09-28 更新）**：本文写作时的 `xingyu-web/` 已归档为
> `archive/xingyu-web-legacy/`（见 `archive/README.md`）。文中所有 `xingyu-web/...`
> 路径在阅读时按 `archive/xingyu-web-legacy/...` 理解。本文是**当时的结论快照**，
> 未逐行回改路径，以保留决策时的原始证据。

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

| 路由 | 后端 | 说明 |
|---|---|---|
| `/me/badges` | ✅ 401（固定五枚） | → **已迁（Phase 3A）**：修正 Legacy 的「隐藏徽章」承诺与凭空「星语探索者」等级 → 见 §三·补12 |
| `/me/growth` | ✅ 401 | → **已迁（Phase 3B）**：五路聚合，**每区块独立三态**（Legacy 的 `&&` 守卫会让失败区块静默消失）→ 见 §三·补14 |
| `/me/interests` | ❌ 游客 **500**（真缺陷） | → **已迁（Phase 3D）**：`/explore/me` 缺 `required = false` 导致 500，**不是「需登录」语义**；`PUT` 是**破坏性全覆盖** → 见 §三·补16 |
| `/me/requests` | ✅ 401 | → **已迁（Phase 3C）**：仅「我提交的入群申请」（Legacy 标题「关系请求」大于实际内容）；**不做** owner 审批队列 → 见 §三·补15 |
| `/me/groups` | ✅ 401（读同源 `/messages`） | → **已迁（Phase 3E）**：同源但**仍是真缺口**（群聊视图 + 唯一创建入口）；`POST /messages/group` **真实存在**且只吃 `title` → 见 §三·补17 |

其余（`/account/status`、`/content/:type/:id/status`、`/share`、`/spaces/:slug`、
`/comments/:id`、`/feedback/recommendations`、`/collections/public`）**已逐条核实（Phase 3F）**：
**只有 `/feedback/recommendations` 是真缺口（已交付）**，其余 6 条为前端拼装/静态壳/
或 Legacy 自身也未实现的路由 —— 见 §三·补18 §18.5。

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

> **不做 `/me/history` 这个路径。** V2 刻意不建这个页面：一个必然 500 的页面就是伪完成。

### 1b. ⚠️⚠️ 上方结论的**重要限定**（2026-09-28 补测，Phase 3A 期间发现）

**上面三条证据只证伪了 `/me/history` 这个字符串，没有证伪「阅读历史」这个功能 —— 而后者是存在的。**

补测发现：**真正的端点是 `GET /api/v1/me/reading-history`**（`CommunityMeController:201` →
`ReadingService.readingHistory`），活体探针返回 **401 AUTH_REQUIRED**（存在、需登录），
与 `/me/history` 的 500 形成鲜明对比。

决定性证据：**Legacy 的 `getHistory()` 调用的就是 `/api/v1/me/reading-history`**
（`xingyu-web/lib/community-api.ts:940`）。也就是说：
- Legacy 页面 `app/me/growth/page.tsx` 里那个 `getHistory()` **是能跑的**；
- 我此前看的「Legacy 标签 `/me/history`」是 `screen-registry.ts` 里的**另一个字符串**，
  两者只是名字相似，**不是同一个东西**。

**错误是怎么发生的（值得记住）：** 我先 grep 了「history」相关的一批字符串，
命中的是 `screen-registry.ts` 的标签（`/me/history`），于是拿**这个**去探针 → 500 →
得出结论「阅读历史没有后端」。但**真正的消费者（`getHistory`）调的是另一个路径**，
我**没有去读 `getHistory` 的实现**就下了结论。

> **纪律：判定「某功能有无后端」时，必须从「前端实际调用了什么」出发**
> （读 `community-api.ts` 里的函数体），而不是从「标签/清单里写了什么路径」出发。
> 清单是**候选**，调用点才是**事实**。用清单里的字符串去探针，探到的 500
> 只说明那个字符串不对，不说明功能不存在。

**对 P3 `/me/growth` 的影响**：`/me/growth` 的 `getHistory()` **可以照搬**，
不需要「重新设计以规避缺失的阅读历史」。原先「growth 有雷」的判断是**错的**。
后端的 `ReadingService.readingHistory` 复用 `continueReading`（`series_reader_state` +
`readingHistoryEnabled` 开关），与 `MeHomeView.continueReading` 同源。

配套：`POST /me/reading-progress` 记录进度；`GET /me/bookshelf` 是订阅系列（已在 V2，Phase 2C）。
`readingHistoryEnabled` 开关为 false 时后端返回**空列表**（不是错误）—— UI 需把
「用户关掉了记录」与「确实没读过」区分开，或至少不对空列表做过度解读。


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

## 三·补12 · Phase 3A 徽章成就：一个**固定五枚**的集合，和 Legacy 的两句漂亮话（2026-09-28）

### 12.1 契约：集合是**封闭**的，`earned` 是**每次重算**的

`GET /api/v1/me/badges`（`CommunityMeController:397` → `MeEngagementService.badges`）
返回**裸数组** `BadgeView[]`，`record BadgeView(String id, String title, String description, boolean earned)`。
活体探针 **401 AUTH_REQUIRED**。

`badges()` 无分支地 `add` 了**恰好五条**：

| id | 标题 | 判定条件（服务端实时计算） |
|---|---|---|
| `onboard` | 入门完成 | `onboardingService.get(user).isCompleted()` |
| `first-post` | 初次创作 | `articleCount >= 1` |
| `prolific` | 勤耕不辍 | `articleCount >= 5` |
| `social` | 社区之星 | `followers >= 10` |
| `profile` | 名片完善 | `profile.bio` 非空白 |

两个由此推出的硬结论：

1. **集合不增长** —— 服务端永远只有这五条，没有「隐藏徽章」，也不会新增种类
   （除非改后端）。所以**空态对登录用户不可达**，而「还有更多等你发现」是**做不到的承诺**。
2. **`earned` 不是持久化的荣誉**，而是**每次请求现算**（读文章数 / 粉丝数 / 引导状态 / bio）。
   条件不成立就会**退回未点亮**（例如文章数掉回 5 以下）。
   → UI **不能说「已获得」**（暗示可保有的奖杯），只能说**「当前已点亮」**。

### 12.2 修掉 Legacy 的两句漂亮话

**其一：「更多隐藏徽章等待你去发现」（页脚）。**
服务端只有五枚。这句话承诺的是**不存在的内容** —— 与 §三·补9 的「自动保存」、
§三·补10 的「已接受协作邀请」是同一类错误：**界面承诺了后端没有的东西**。
V2 不写这句；测试断言正文**不含「隐藏徽章」**。

**其二：一张凭空的「星语探索者」等级卡。**
Legacy 在顶部渲染了一张等级卡：固定标题「星语探索者」+ `earned.length` 徽章数。
**后端没有任何「等级」概念** —— 那个称号是硬编码的字符串，且**永不随进度变化**。
一个恒定的头衔配一个真实的数字，读起来就像两者都是真的。
V2 **不造等级**；测试断言正文不含「星语探索者」与「等级」。

另外 Legacy 的 `earned` 计数文案写的是「已获得 N 枚」—— 按 12.1 第 2 条，这是过度声称，
V2 改为**「当前已点亮 N 枚」**，并在页头说明**徽章由行为实时判定**。

### 12.3 有意保留的：未点亮徽章**保留服务端的条件文案**

未点亮徽章的 `description` 就是**用户该做什么**（「粉丝达到 10」）。
Legacy 在 `description` 为空时才垫兜底，这一点是对的 ——
**绝不把条件替换成更温和的散文**，那等于把门槛藏起来。
V2 沿用，并在测试里钉住「粉丝达到 10」「拥有 5 篇以上文章」确实出现在页面上。

### 12.4 未知徽章**原样渲染**，不静默丢弃

`hasUnknownBadges()` 只用来决定**是否显示一条说明**，**绝不用来过滤列表**。
后端若新增第六枚徽章，我们的映射表不认识它 —— 但**丢掉一行**比**显示一行不认识的**
更糟（用户会以为自己少了一枚）。

### 12.5 顺序：点亮在前，但**不提供排序控件**

`sortForDisplay` 把已点亮的提到前面，**每组内保留服务端顺序**（服务端顺序近似难度阶梯）。
不提供任何排序 UI —— 没有「按获取时间排序」可言，因为**没有获取时间**（12.1 第 2 条）。

### 12.6 ⚠️ 顺带修正 §三·补3：「阅读历史」**是存在的**（见 §1b）

核实 P3 时发现 §三·补3 的结论**不准确**：`/me/history` 确实不存在（500），
但**真正的端点是 `/me/reading-history`**，它**存在且需登录**（401），
且 **Legacy 的 `getHistory()` 调用的正是它**。

→ 由此，原先对 P3 `/me/growth` 的「有雷」判断**是错的**：
`getHistory()` 可以照搬。错误成因与纪律见 §1b。

---

## 三·补13 · P3 剩余项的契约底稿（2026-09-28）

核实 3A 时把 P3 其余项一并摸了底。以下为**读源码得出**的契约事实，
供后续 Phase 直接使用（避免重蹈补3「用清单字符串去探针」的覆辙）。

| 页面 | 端点 | 关键事实 |
|---|---|---|
| `/me/badges` | — | ✅ **已交付（Phase 3A）**，见 §三·补12 |
| `/me/growth` | `getHistory()`→`/me/reading-history`、`getMyComments(10)`、`getMyBadges()`、`getMyInsights()`、`getHome()` | ✅ **已交付（Phase 3B）**，见 §三·补14。契约事实：`pendingActions` 无 `id` 且 href 指向 V2 不存在的 `/studio/reviewing` |
| `/me/interests` | `GET /explore/map`（公开，探针 **200**）+ `GET /explore/me` + `updateMyExplore` | ✅ **已交付（Phase 3D）**，见 §三·补16。**结论：`/explore/me` 游客 500 是后端真缺陷**（控制器 `@RequestHeader("satoken")` 漏写 `required = false` → `MissingRequestHeaderException` 被兜底成 500），非「需登录」。另：`PUT` 是**破坏性全覆盖**（先删光关联行） |
| `/me/requests` | `GET /me/group-join-requests?limit=20`（401） | 真正返回的是 **`MyGroupJoinRequestView`**，**含** `conversationTitle` 与 `resolvedAt`（`ConversationService:169` 现查会话标题）。⚠️ **不要看 `GroupJoinRequestView`** —— 那是群主侧审核用的另一个 DTO，**没有**这两个字段，会误导你砍掉页面功能 |
| `/me/groups` | `GET /messages`（401，裸数组）+ `POST /messages/group` | ✅ **已交付（Phase 3E）**，见 §三·补17。**结论：同源但真缺口**（邮箱无法回答「我的群聊」，且创建入口是这页独有）。⚠️ **`POST /messages/group` 真实存在**，只吃 `{title}`、硬编码 `joinMode=OPEN`、只建 1 个 OWNER 成员 —— **没有邀请人列表**。`/messages/:conversationId` **兼容 GROUP**（会话页先 DIRECT 再回退 GROUP） |

状态值（`ConversationService` 穷举）：群聊入群申请只有 **`PENDING` → `APPROVED` / `REJECTED`**，
故 Legacy 的三标签映射（待处理/已通过/已拒绝）**恰好正确**，与 §三·补4
（举报映射 4 个里错 3 个）形成对照 —— **同一作者的两个页面，一个对、一个错，必须逐个核。**

---

## 三·补14 · Phase 3B 成长记录：**五路并行读取**，与「区块静默消失」（2026-09-28）

### 14.1 页面形态：聚合 5 个独立读

`/me/growth` 是**只读聚合页**，五路数据互不依赖：

| 区块 | 来源 | 归属 |
|---|---|---|
| 创作数据（6 计数器） | `meInsightsApi.get()` → `/me/insights` | 复用（原属 `/me/moments` 面） |
| 徽章 | `badgesApi.list()` | 复用（Phase 3A） |
| 最近阅读 | `readingHistoryApi.list()` → **`/me/reading-history`** | **本 Phase 新增**（此前无 client） |
| 最近评论 | `myCommentsApi.list(10)` | 复用（原属「我的互动」） |
| 待处理 | `homeApi.getMyHome().pendingActions` | 复用（原属首页面） |

**没有新建任何 API 模块以外的重复实现** —— 四个复用 + 一个新增。

### 14.2 核心修法：**区块失败必须可见**

Legacy 用 `useAsyncData` 并发五路，再用 `insights && (...)`、`badges && (...)` 守卫渲染。
后果：**任一路失败 → 整个区块消失**，而「消失」与「你没有」**完全无法区分** ——
与 §三·补9（数据分析把失败渲染成 `—`）是**同一个失败模式**。

V2 给每个区块**独立的三态**（loading / error / ready），且**失败时明说**：

> 暂时无法读取创作数据，因此这里不显示任何数字。

并且**失败时不渲染计数器**（测试断言 `已发布文章` 不出现在失败态）。
另有测试断言：**一路失败时其余四路仍然渲染** —— 这是拆五态（而非 `Promise.all`）的全部理由。

### 14.3 「阅读历史为空」是**二义**的 —— 不能只报一种原因

后端 `ReadingService.continueReading` 开头：

```java
if (user == null || !clientSettingsService.isReadingHistoryEnabled(user)) return List.of();
```

即 **用户关掉开关** 与 **确实没读过** 返回**同一个空列表**。
→ 文案必须**同时**说明两种可能，不能替用户选一种：

> 没有阅读记录。可能是还没有读过内容，也可能是在设置里关闭了阅读历史记录。

这也是**不做「全部阅读记录」入口**的原因（`readingHistory` 复用 `continueReading`，
两者同源，再建一页只是同一份数据的第二个入口）。

### 14.4 ⚠️ 修掉一个**潜伏的类型错误**：`PendingAction.id` 并不存在

V2 的 `home.types.ts` 曾把 `PendingAction` 声明为：

```ts
export type PendingAction = { id: string; kind: string; title: string; href?: string };
```

**两处与后端不符**（后端 `record PendingActionView(String type, String title, String href)`）：

| V2 声明 | 实际 | 后果 |
|---|---|---|
| `id: string` **必填** | **根本没有这个字段** | 若拿它当 React key → `key={undefined}` |
| `kind` | 字段名是 **`type`** | 永远读不到值 |

**为什么一直没炸**：`pendingActions` 此前**全仓库无人消费**（只有 24 个路由测试把它 mock 成 `[]`）。
这次的 growth 页是**第一个真正的消费者** —— 一上手就会踩到。
已改正为 `{ type, title, href? }` 并写入注释。

> **教训：`id` 是"想当然"最容易加错的字段。** 声明一个后端没有的 id，
> 单元测试永远不会发现（mock 自己说了算），**只有第一次真实消费才暴露**。
> 判断 DTO 字段一律**去读后端 record**，不要从"一般实体都有 id"外推。

### 14.5 ⚠️ 服务端的 `href` 指向 **V2 不存在的路由**

后端 `HomeService:84` 是 `pendingActions` 的**唯一生产者**，且**硬编码**：

```java
pendingActions.add(new PendingActionView("REVIEW", "文章审核中", "/studio/reviewing"));
```

**V2 没有 `/studio/reviewing`。** 照搬渲染 `<Link to={action.href}>` 就是
「在一条真实的待办提示之后，送用户一个稳定的 404」—— 与 §三·补10 的
`/u/:username/works` 死链是**同一类错误**。

V2 的处理：`resolvePendingHref()` 走**已知路由白名单**（**不是** "以 `/studio` 开头"前缀判断），
不在白名单内 → **渲染成纯文本 + 说明**：

> 该入口在本站尚未开放，可到创作中心查看。

**提示仍然可见**（丢掉它会隐藏一个真实的待办），只是**不可点向 404**。
测试断言：`/studio/reviewing` **不产生 `<a>`**，而 `/studio/submissions`（白名单内）**产生**。

### 14.6 去重：服务端**每条待审文章**产生**一行相同**的 `REVIEW`

`HomeService:79-89` 是 `for (article : listByOwnerId(user))`，
**每命中一篇在审文章就 add 一条一模一样的 `("REVIEW","文章审核中","/studio/reviewing")`**。
→ 5 篇在审 = 5 行**完全无法区分**的「文章审核中」。

V2 去重并**显示条数**（「3 项」），否则用户分不清"是 5 篇在审"还是"渲染坏了"。
另：**因为 `PendingActionView` 没有 id**，React key 只能由 (type|title|href|index) 推导 ——
这也正是 14.4 那个类型错误的现实后果。

### 14.7 有意做的与有意不做的

**做**：
- 六条 `insights` 计数器**全展示**（同 §三·补9：接口返回了就没理由丢）。
- 三个去向链接：`/me/badges`（全部徽章）、`/studio/analytics`（创作数据）、`/me/likes`。

**不做**：
- **不给 `/me/growth` 造"等级/进度条"** —— 后端无等级概念（同 §三·补12）。
- **不做阅读历史分页**：`readingHistory` 忽略 `cursor` 且 `nextCursor` 恒为 `null`，
  唯一的加宽手段是**调大 `limit`**（服务端上限 100）。造一个游标式「加载更多」
  就是在描述一个不存在的契约。API 层测试**断言不发送 `cursor`**。

### 14.8 未验证项

- **登录态下四个区块的真实渲染未实测**（登录需人工图形验证码）。
  区块的三态逻辑由 13 条页面测试覆盖（含「一路失败、其余存活」与两条 href 分支）。
- `pendingActions` 在**真实数据**上的去重效果未实测 —— 本机库没有在审文章，
  真实响应大概率是空数组（这也是该区块在真机上多半不出现的原因）。

---

## 三·补15 · Phase 3C 关系请求：一个**标题比内容大**的页面，和「入群申请」的双 DTO 陷阱（2026-09-28）

**页面**：`/me/requests` → `GroupJoinRequestsPage`（`src/features/me-growth/pages/`）。

### 15.1 Legacy 的页面标题骗了我一次（标题 ≠ 内容）

Legacy 该页标题叫「**关系请求**」，读起来像是一个通用关系收件箱：关注申请、
好友申请、群邀请……全都该在这儿。**后端一条都不存在。**

把页面正文读到底，Legacy 自己就承认了范围：

> 「关注为开放模式；此处展示你发起的群聊入群申请」

也就是说页面只能显示 **`GET /api/v1/me/group-join-requests`** 一个来源 ——
**调用方自己提交的入群申请**。三条硬事实决定了这个边界：

1. **关注是开放模式**。`JoinMode.OPEN` 下 `follow` 是直接写入，**没有审批环节**，
   所以后端**根本不存在**「关注申请」这个实体。更没有 `/me/follow-requests`。
2. **`/me/group-join-requests` 只有「我提交的」这一个语义**。
   owner 侧的待审队列是**另一个端点**（`/messages/group/{id}/join-requests`）+ 另两个写端点。
3. **后端没有任何 `friend` / 好友概念**。用户之间只有 follow、block、DM 会话。

→ **V2 的处置**：保留「关系请求」这个名字（与 Legacy 路由/导航对齐），
但**在页面头部第一行就把范围说清**：「这里显示你发起的群聊入群申请。
关注是开放模式，不需要申请，所以不会出现在这里。」
**绝不**为了凑标题而编造「关注申请」区块或「好友」区块 —— 那是§三·补9 禁止的虚构态。

### 15.2 `MyGroupJoinRequestView` ≠ `GroupJoinRequestView` —— 最容易踩的坑

同一份"入群申请"数据，后端有**两个不同的 record**，字段集不一样：

| | `MyGroupJoinRequestView`（我提交的） | `GroupJoinRequestView`（owner 看的） |
|---|---|---|
| 端点 | `GET /me/group-join-requests` | `GET /messages/group/{id}/join-requests` |
| 群标题 | ✅ `conversationTitle` | 不需要（owner 知道自己的群） |
| 处理时间 | ✅ `resolvedAt` | ❌ 无 |
| 申请人 | ❌ 无（就是我自己） | ✅ 申请人信息 |

**V2 用的是 `MyGroupJoinRequestView`**，字段（从 `ConversationService` 的组装点读到）：

```ts
interface MyGroupJoinRequest {
  id: number;
  conversationId: string;
  conversationTitle: string | null;   // 仅当会话行已消失时为 null
  joinMode: "OPEN" | "APPROVAL";
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  resolvedAt: string | null;
}
```

**为什么这是个坑**：两个类型名字只差一个 `My` 前缀，且都围绕"入群申请"。
按 `GroupJoinRequestView` 去写（找申请人、找不到 `resolvedAt`）会静默错位。
→ 类型文件里的 doc comment **显式对比**两者，防止后人合并。

### 15.3 `conversationTitle === null` 是**真实状态**，必须如实报，不许装饰

`conversationTitle` 为 null 的**唯一原因**是会话行已经没了（`ConversationService:177`
在会话查不到时不设标题）。此时：

- **不链接**该行（点进去必然 404）；
- 显示「**该群聊已不存在**」，而不是编一个「群聊」当标题。

这是继承 §三·补9 的规则：**缺失态要如实显示，不能伪装成正常态**。
编一个「群聊」名字会让用户以为申请还挂着、群还在 —— 那是在说谎。

### 15.4 没有「去处理」按钮 —— 因为那是 owner 的活儿，V2 不做

页面**刻意不提供**任何审批操作。owner 侧的 approve/reject 写端点
（`POST /messages/group/{id}/join-requests/{reqId}/approve` 等）**本 Phase 不交付**，
所以放一个「去处理」按钮 = 造一个**永远报错的控件**（§三·补11 的假缺口定义）。

在 `messages.api.test.ts` 里**加了一条守卫断言**：这些群管理写端点
**必须保持在 `messagesApi` 表面之外**。等到真的要做 owner 侧了，
那条断言会失败 —— 这正是我们想要的**提醒**，而不是静默漂移。

### 15.5 契约核对清单（全部从调用点/后端 record 读出，非文档）

| 项 | 值 | 依据 |
|---|---|---|
| 端点 | `GET /api/v1/me/group-join-requests?limit=N` | 调用点 |
| 返回 | **裸数组**（非 PageResultView） | 调用点 `.then(list => ...)` |
| 默认 limit | `20`（`GROUP_JOIN_REQUEST_LIMIT`） | 调用点常量 |
| 上限 | `100`（`GROUP_JOIN_REQUEST_MAX_LIMIT`） | 服务端 clamp |
| 分页 | **无游标** —— 只有 limit，无 `nextCursor` | 契约 |
| 状态枚举 | `PENDING` → `APPROVED` \| `REJECTED` | 后端 enum |
| joinMode | `OPEN` \| `APPROVAL` | 后端 enum |

→ 与阅读历史同理：**唯一加宽手段是调大 limit**，所以页面**不做"加载更多"**，
只如实标注「最多显示 20 条最近记录」。造游标式分页 = 描述不存在的契约。

### 15.6 `requestConversationHref` 的目标是 `/messages/:conversationId`（V2 真能开群聊）

Legacy 链到 `/messages/group/{conversationId}` —— 那个形状**在 Legacy 里也没路由**。
V2 的 `/messages/:conversationId` 对 **GROUP 会话同样可用**（先试 DIRECT，
404 再回退 GROUP），所以这里的「查看群聊」是**真链接**，不是装饰。

### 15.7 交付与验证

| 文件 | 说明 |
|---|---|
| `src/api/messages/messages.types.ts` | `MyGroupJoinRequest` + 状态/模式常量 + limit 常量 |
| `src/api/messages/messages.api.ts` | `listMyGroupJoinRequests(limit?)` |
| `src/api/messages/messages.api.test.ts` | +5 条；并**新增群管理写端点的缺席守卫** |
| `src/features/me-growth/group-join-requests.ts` | 纯逻辑：状态标签、`groupIsGone`、`splitByPending`、href 解析… |
| `src/features/me-growth/group-join-requests.test.ts` | 21 条 |
| `src/features/me-growth/pages/GroupJoinRequestsPage.tsx` | 页面（待处理/历史两段） |
| `src/features/me-growth/pages/group-join-requests-page.test.tsx` | 14 条 |
| `src/router/me-requests-routes.test.tsx` | 路由守卫 + 未登录**不发请求** + 一条真实渲染 |

- **全量**：164 文件 / **1696 测试全绿**；`tsc --noEmit` 0 错；`npm run build` 通过。
- **未验证**：登录态真机渲染（图形验证码人工环节）。三态与「群已不存在」分支由
  14 条页面测试覆盖（含 null 标题不链接、状态标签、两段分组）。

### 15.8 不做（明确边界）

- ❌ **owner 侧审批队列**（另一个端点 + 写操作，V2 不交付）。
- ❌ **「关注申请」区块** —— 后端无此实体，关注是开放的。
- ❌ **游标分页 / 加载更多** —— 契约里没有。
- ❌ **为 null 标题编造群名** —— 如实写「该群聊已不存在」且不链接。

---

## 三·补16 · Phase 3D 我的探索：一个**真实的 500**（不是「需登录」），和一个**破坏性全覆盖写**（2026-09-28）

**页面**：`/me/interests` → `ExplorationInterestsPage`。

### 16.1 先回答 §三·补13 的待核问题：`/explore/me` 游客 500 是**真 bug**

补13 留的问题是「缺 401 映射，还是真错」。**答案是前者，且是一个具体缺陷。**

`CommunityExploreController:56`：

```java
@GetMapping("/me")
public UserExploreView myExploration(@RequestHeader("satoken") String token) {   // ← 没有 required = false
    return explorationService.getUserExploration(requireUser(token));            // ← 这句本该抛 401
}
```

`@RequestHeader("satoken")` **默认 `required = true`**。游客不带该头时，Spring 在**进入方法体之前**
就抛 `MissingRequestHeaderException` —— 所以 `requireUser()`（它**确实**会抛
`ContractException(AUTH_REQUIRED)` → 401）**根本没机会执行**。

异常落到 `CommunityApiExceptionHandler`：该类注册了
`FieldContractException` / `ContractException` / `DuplicateKeyException` 三个具体处理器
**和一个 `Exception` 兜底** —— 但**没有** `MissingRequestHeaderException` 的处理器。
于是它被兜底接住 → `INTERNAL_ERROR` → **500**。

**实测（2026-09-28，本机 7779 后端，游客不带 satoken）：**

| 端点 | 结果 | 判定 |
|---|---|---|
| `GET /explore/map` | **200** | 公开，正确 |
| `GET /explore/nav` | **200**（`mode: guest`） | 该控制器**写对了** `required = false` |
| `GET /explore/me` | **500** `INTERNAL_ERROR` | ❌ **缺陷** |
| `GET /me/profile` | **401** `AUTH_REQUIRED` | 别的控制器路径**能**正确映射 401 |

→ 同组、同控制器里 `/explore/nav` 就是 `required = false` 的正确写法；
`/me/profile` 证明 401 映射本身是好的。**这不是「需登录」语义，是这一个端点的注解漏了。**

**修复方向（本轮不动后端，仅记录）**：给 `CommunityApiExceptionHandler` 加一个
`MissingRequestHeaderException` 处理器，映射到 `AUTH_REQUIRED`（401）——
一处修复即覆盖全部 6 个硬性 `@RequestHeader("satoken")` 端点
（`CommunityExploreController` 的 `myExploration`/`updateMyExploration`/`applyDomain`
+ `CommunityMeController` 的 `sessions`/`revokeOne`/`revokeOthers`）。

**前端的处置**：该路由是 `RequireAuth`，正常流程下**总会**带上 satoken，
所以这个 500 只在「会话中途失效」时出现。此时页面显示
「**登录状态已过期，请重新登录**」——**这是我们自己按 401 语义写的兜底文案，
不是把 500 伪装成登录问题**。测试里专门钉了一条：
「非 401 的 500 **不得**渲染『去登录』链接」，以免后人图省事把 500 也算进登录分支。

### 16.2 ⚠️ `PUT /explore/me` 是**破坏性全覆盖**，不是合并

`ExplorationService.updateUserExploration`（`:138` 起）的动作顺序：

1. **`userExploreDomainMapper.deleteByUserId(user.getId())`** —— 先删光该用户**所有**关联行；
2. 再按 payload 的 `domainIds` 重新插入（**只接受 `domainType == "SYSTEM"`**，其余静默 `continue`）；
3. 对已有 personal 行：名字**不在** `customLabels` 里 → `status = "ARCHIVED"`；
   在 → 从待建集合移除；
4. `customLabels` 里剩下的一律**新建**一行（**新 id**），并挂关联行。

由此推出三条**必须**遵守的前端规则：

- **永远发完整状态，绝不发增量** —— 发增量 = 静默清空其余。
- **无变化时根本不发 PUT**（`isDirty`）—— 否则「点一下保存」会
  archive 再 recreate 用户的所有 personal 行。
- **保存后必须用响应重新播种** —— personal 标签是**新 id**，
  不能沿用旧 id。

`isDirty` 的比较规则也做了区分，测试钉住：**domain 顺序无关**（集合语义），
**label 顺序有关**（顺序是用户可见的，且服务端 `sortOrder` 保留它）。

### 16.3 官方领域只取**叶子**，根节点不作可选

写接口接受任何 `SYSTEM` 领域 id，但 Legacy 只把 `children` 铺成可选项。
根节点是分类标题（「技术」「设计」），把根当兴趣会得到比后端设计粒度**粗得多**的选项。
→ 跟随 Legacy 只取叶子。**没有子节点的根不自我提升为叶子**，
而是由 `hasSelectableDomains` 报告「无可选领域」，页面据此**说明原因**而不是渲染空白区块。

### 16.4 `personal` 与 `customLabels` 的**双重出现**问题

一个 personal 标签**同时**出现在：
- `domains[]`（因为它**也有**关联行，`:186-192`），且 `personal: true`；
- `customLabels[]`（服务端自己 `personal.stream().map(name)` 派生，`:130`）。

→ 若不筛掉，它会**渲染两次**，而且可能被当成「官方勾选项」勾上。
`selectedOfficialIds()` **显式过滤 `personal`**，测试专门钉了这条。

### 16.5 不复制 Legacy 的 `/discover?domain=all` 跳转

Legacy 保存后 `router.push('/discover?domain=all&sort=featured')`。
但 V2 的 `/api/v1/discover` **不认** `domain`/`sort`（Phase 1A 已实测），
跳过去只会**宣传一个不存在的筛选**。→ 留在原页并确认「已保存」。

### 16.6 交付与验证

| 文件 | 说明 |
|---|---|
| `src/api/exploration/exploration.types.ts` | `ExploreDomain` / `UserExplore` / 上限常量 / `slugifyLabel` |
| `src/api/exploration/exploration.api.ts` | `getMap`（公开）/ `getMine` / `updateMine`（PUT） |
| `src/api/exploration/exploration.api.test.ts` | 10 条，含「**失败必须传播**，不得吞成空数组」 |
| `src/features/me-growth/exploration-interests.ts` | 铺平 / 选中 / 标签校验 / `isDirty` … |
| `src/features/me-growth/exploration-interests.test.ts` | 33 条 |
| `src/features/me-growth/pages/ExplorationInterestsPage.tsx` | 页面 |
| `src/features/me-growth/pages/exploration-interests-page.test.tsx` | 21 条 |
| `src/router/me-interests-routes.test.tsx` | 3 条（含未登录**不发任何读**） |

- **未验证**：登录态真机保存（图形验证码人工环节）。写路径的语义
  （完整状态、跳过无变化、保存后重播种）由 21 条页面测试覆盖。
- **不做**：域申请（`POST /explore/domain-applications` 是**另一个**功能，
  本页只管自己的偏好）；`/discover` 假筛选跳转。

---

## 三·补17 · Phase 3E 我的群聊：**「同源」但仍是真缺口**，与 Legacy 两个不存在的路由（2026-09-28）

**页面**：`/me/groups` → `MyGroupsPage`。

### 17.1 先回答「同源是不是假缺口」：**不是**

补13 的疑虑是「`/me/groups` 同源 `/messages`，语义不等价」。核实后结论：

- **读**确实同源：`GET /messages` 是**裸数组**，DIRECT 和 GROUP **混在一起**，**没有** group-only 端点。
- **但缺口是真的**，两个理由：
  1. 邮箱**无法**回答「我的群聊有哪些」——它把 DIRECT 混进来且不提供拆分；页面做的就是**群聊维度的视图**。
  2. **创建群聊**是这一页独有的能力，邮箱没有入口。

→ 所以它不是一个「为了路由对齐而搬」的页面，而是**群聊作用域的视图 + 唯一的创建入口**。

### 17.2 ⚠️ `POST /messages/group`（创建群聊）**是真实存在的**

这条是本次核实**推翻假设**的地方。`CommunityMessageController:67`：

```java
@PostMapping("/group")
public ConversationView createGroup(@RequestBody Map<String, String> body) { ... }
```

`ConversationService.createGroup`（`:225-241`）**只读 `title`**：

- 空标题 → `FieldContractException("title", "群聊标题不能为空")`（400）；
- `joinMode` **硬编码 `OPEN`**；
- 只插入**一行**成员（调用者，`OWNER`）。

**⚠️ 没有任何邀请人列表 —— 新建的群永远只有 1 个成员。**
→ 页面上**刻意不做**「邀请成员」输入框：接口会**静默忽略**它。
（成员后续在群聊里加。其余 admin 能力 settings / announcement / members / leave
虽然后端也有，本 Phase **不交付**，因此拥有群主身份的行**只显示角色标签、不给任何管理按钮**。）

**探针勘误**（记录一下，因为差点被误导）：`POST /messages/groups`（复数）返 **500**，
`POST /messages` 返 **405** —— 这两个**都不是**正确路径，不要据此判断「没有创建能力」。
正确路径是**单数** `/messages/group`。

### 17.3 Legacy 的两个链接**都指向它自己没定义的路由**

| Legacy 链接 | Legacy 是否真的有这个路由 |
|---|---|
| `/messages/groups/new`（创建） | ❌ **不存在**（`app/messages/groups/new/page.tsx` 在，但 `/messages/groups/{id}` 动态段缺失，链接形状自相矛盾） |
| `/messages/group/{id}`（每行） | ❌ **不存在** |

→ V2 的处置：
- 创建做成**页内内联表单**（不需要新路由，也就不可能再出现「链接指向不存在路由」）；
- 行链接到 **`/messages/:conversationId`** —— V2 对 GROUP **真的能开**
  （会话页先试 `getDirect`，404 再回退 `getGroup`；已在 `ConversationThreadPage:89-104` 确认）。
  测试钉住 href **必须**是 `/messages/<id>` 且**不含** `/messages/group/`。

### 17.4 角色 / 加入模式：未知值**原样回显**，不猜

`roleLabel` / `joinModeNote` 对已知枚举给中文，对 `null`/`undefined` 返 `null`（**不显示**），
对**未知值原样回显**（例如 `"MODERATOR"` → `"MODERATOR"`）。
`canAdminister` 与后端 `requireOwnerOrAdmin` 对齐：**只认 `OWNER` / `ADMIN`**。
`filterGroups` **保留服务端顺序**（mapper 已按 `updated_at DESC` 排好，不重排）。

### 17.5 交付与验证

| 文件 | 说明 |
|---|---|
| `src/api/messages/messages.api.ts` | **+`createGroup(title)`** → `POST /messages/group` |
| `src/api/messages/messages.api.test.ts` | 表面断言**故意更新**（+`createGroup`）；admin 写端点缺席守卫**扩展**；+3 条 createGroup 形状测试 |
| `src/features/me-growth/my-groups.ts` | 过滤 / 标题兜底 / 角色 / 加入模式 / 标题校验 / href |
| `src/features/me-growth/my-groups.test.ts` | 25 条 |
| `src/features/me-growth/pages/MyGroupsPage.tsx` | 页面（内联创建表单） |
| `src/features/me-growth/pages/my-groups-page.test.tsx` | 18 条 |
| `src/router/me-groups-routes.test.tsx` | 4 条（含未登录**不读邮箱**、href 不被 `/me/*` 吞掉） |

- 全量：**171 文件 / 1813 测试全绿**；`tsc` 0 错；build 通过。
- **未验证**：登录态真机创建群聊（图形验证码人工环节）。
  创建流程（仅发 title、无邀请字段、成功后前插不重取）由 18 条页面测试覆盖。

### 17.6 不做（明确边界）

- ❌ **群管理**（settings / announcement / members / leave / remove-member）—— 后端有，本 Phase 不交付，故**不给按钮**。
- ❌ **邀请成员** —— 创建接口只吃 `title`，没有邀请人列表。
- ❌ **`/messages/group/{id}` 路由** —— Legacy 的形状，V2 不需要（统一走 `/messages/:id`）。
- ❌ **group-only 读端点** —— 后端没有；客户端过滤是**事实**，注释里已写明。

---

## 三·补18 · Phase 3F 推荐反馈 + 「尚未核实」清单的**逐条定性**（2026-09-28）

**页面**：`/feedback/recommendations` → `RecommendationFeedbackPage`。

### 18.1 它**不是**假缺口 —— 是一读一写都真实存在的页面

补11 的「不做」列表里有几个是**同源且更弱**（素材库、创作台设置），
推荐反馈**不属于**那一类。`RecommendationFeedbackService` 是完整的真实读写：

| 项 | 值 | 依据 |
|---|---|---|
| 读 | `GET /me/recommendation-feedback?limit=20` | 控制器 `:386` |
| 写 | `POST /me/recommendation-feedback`，body `{body}` | 控制器 `:392` |
| 返回 | **裸数组**（非 PageResultView）；无游标 | `listMine` |
| 上限 | `Math.min(Math.max(limit,1),50)` → **50 封顶** | `listMine` |
| 校验 | 空/纯空白 → 400 `body: 反馈内容不能为空`；>2000 → 400 | `submit` |
| DTO | `record(id, body, createdAt)` —— **无用户字段**（本就是自己的） | View |
| 探针 | GET **401**、POST **401**（**正确映射**，非 `/explore/me` 那种 500） | 2026-09-28 |

### 18.2 ⚠️ 页面**必须**声明范围，否则一定被误解

`submit` **只读 `body` 一个字段** —— 没有评分、没有目标内容 id、没有分类。
所以这是**针对推荐系统整体**的自由文本，**不是**「这篇推得不准」的投票。

**风险**：用户很可能从某篇文章一路点进来，默认以为在给**那篇**打分。
→ `FEEDBACK_SCOPE_NOTE` 在页头第一句说明「这是对整个推荐系统的整体反馈，
不是针对某一篇文章」，并用**测试**钉住这两句必须存在（防止文案被改掉后无人察觉）。

### 18.3 ⚠️ 后端**没有** DELETE —— 页面不许给删除控件

控制器只有 `@GetMapping` 和 `@PostMapping`，**没有**删除/修改端点。
→ 页面**不提供**任何删除/编辑按钮，并在提交前就**警告**「提交后无法修改或删除」。
否则用户提交完会去找一个**不存在的控件**。测试钉了两条：
「无删除/修改/撤销按钮」+「警告文案存在」。

### 18.4 提交后用**响应**前插，不重取；确认态按 **id** 判定

POST 返回的就是**已入库的行**，所以无需重取。`prependFeedback` **按 id 去重**并
**按真实上限截断**（长会话不会胀过一次刷新能拿到的量）。
`isJustSubmitted` **比 id 不比正文** —— 两条一模一样的抱怨是合法的，
比文本会**误判**。

### 18.5 「尚未核实」清单的**逐条定性**（补上这一格）

原文写「其余……尚未核实」的 7 条，本轮核实如下：

| 路由 | 判定 | 依据 |
|---|---|---|
| `/feedback/recommendations` | ✅ **真缺口 → 本轮已交付** | 见上 |
| `/account/status` | ⚪ **不做** —— 与 `/sessions` + `/me` **同源**；它唯一独有的 `getAccountStatus()` 给出 `status`/`canChangeEmail`/`canChangePassword`/`requiresReAuth`，而 `MeView` 已含 `email`/`emailVerified`/`mustChangePassword` | 端点存在（401），但页面信息**严格更弱** |
| `/collections/public` | ⚪ **不做** —— **自相矛盾**：用 `getMyProfile()` 渲染出**当前用户**的头像/昵称，却叫「公开收藏」；且**严格更弱**于 `/collections/:id`（后者真能打开任意一个人的公开收藏夹）。**只筛自己的 PUBLIC 收藏夹**这一件事，`/me/collections` 已能做 | Legacy `public/page.tsx:17-21` |
| `/share` | ⚪ **不做** —— 6 行**纯静态壳**，**0 次 API 调用**，正文就是「打开发现页，用页面上的分享按钮」+ 一个 `/discover` 链接 | Legacy `share/page.tsx` |
| `/content/:type/:id/status` | ⚪ **不做** —— 页面**确实存在**（`app/content/[objectType]/[objectId]/status/page.tsx`，12 行），但它是 **`/studio/content` 的只读劣化视图**：只取 `listMyArticles()` 里那一行，把 `status` 渲染成时间线；无独立端点、无新数据 | 补19 复核（**本节原写「目录不存在」，是错的**） |
| `/spaces/:slug` | ⚪ **不做** —— 页面**确实存在**（`app/spaces/[spaceSlug]/page.tsx`，301 行，真实调 `getSpaceWorks`），但与 V2 的 `/u/:p` **同源且后者严格更强**：两端返回**同一个 `SpaceWorksView` DTO**；区别只在查询键，而 `space.slug` 被后端**硬编码等于 username**（注册 `space.setSlug(normalizedUsername)`，改名 `space.setSlug(newUsername)`），故两串**恒等**；`/users/{u}/works` 还多了**用户名历史回退** | 补19 复核（**本节原写「目录不存在」，是错的**） |
| `/comments/:id` | ⚪ **不做** —— 页面**确实存在**（`app/comments/[commentId]/page.tsx`，59 行，真实调 `getComment(id)`）；但它是**单条评论的永久链接**，正文就是「评论 + 查看原内容」按钮，而那个按钮指向的正是 V2 `me-activity.types.ts:50` 记录的目的地 —— **V2 的评论行直接链到原内容，与 Legacy 该页的落点一致** | 补19 复核（**本节原写「目录不存在」，是错的**） |

→ 结论：**这 7 条里只有 1 条是真缺口**（已交付），其余 6 条要么是前端拼装/静态壳，
要么是**同源劣化视图**。**又一次印证「清单是候选，调用点才是事实」。**

> ⚠️ **补19 勘误（2026-09-28）**：本表原把 `/content/*`、`/spaces/:slug`、`/comments/:id`
> 三条判为「Legacy `app/` 下无对应 page / 目录不存在」。**三条全是错的** —— 三个 page
> 文件都真实存在。结论（不做）不变，但**理由必须换掉**：真正的理由是「同源劣化 / 落点一致」，
> 而不是「Legacy 没做」。**这是一个新的教训：「目录不存在」这种断言，必须用 `test -f`
> 逐个验，不能顺手写 —— 它和「路径字符串骗人」是同一类错误，只是方向相反。**

### 18.6 交付与验证

| 文件 | 说明 |
|---|---|
| `src/api/recommendation-feedback/recommendation-feedback.types.ts` | DTO + 三个常量（默认 20 / 上限 50 / 长度 2000） |
| `src/api/recommendation-feedback/recommendation-feedback.api.ts` | `list` / `submit` |
| `src/api/recommendation-feedback/recommendation-feedback.api.test.ts` | 9 条（含「**无删除/编辑**」缺席守卫） |
| `src/features/feedback/recommendation-feedback.ts` | 校验 / 计数 / 去重前插 / `clampLimit` / `FEEDBACK_SCOPE_NOTE` |
| `src/features/feedback/recommendation-feedback.test.ts` | 26 条 |
| `src/features/feedback/pages/RecommendationFeedbackPage.tsx` | 页面 |
| `src/features/feedback/pages/recommendation-feedback-page.test.tsx` | 17 条 |
| `src/router/recommendation-feedback-routes.test.tsx` | 3 条（含未登录**不读列表**） |

- 全量：**175 文件 / 1868 测试全绿**；`tsc` 0 错；build 通过。
- 入口放在 **footer**（与 `/guide`、`/rules` 同列），不进主导航 —— 低频动作。
- **未验证**：登录态真机提交（图形验证码人工环节）。

---

## 三·补19 · Phase 3J 全路由 diff：**52 条 Legacy 独有路由的逐条结账**（2026-09-28）

Legacy 已归档到 `archive/xingyu-web-legacy/`。归档不等于「已覆盖」，
所以本轮做了一次**穷尽式路由对账**，作为「合并是否真的完成」的验收。

### 19.1 方法

```bash
# 两侧路由表（Legacy: app/**/page.tsx 的目录路径；V2: routes.tsx 的 path 属性）
# ⚠️ 参数名先归一化：:id / :slug / :articleId → :p
#    否则 :id vs :slug 会制造大量假差异
comm -23 legacy-n.txt v2-n.txt     # Legacy 134 → V2 91：52 条无对应
```

### 19.2 结账表（52 条全部有归属）

| 类别 | 条数 | 处置 | 依据 |
|---|---|---|---|
| **A. 纯重定向**（Legacy 自己就是 `navigate()`） | 3 | ✅ V2 覆盖 | `/settings`→`redirects.tsx`；`/settings/privacy` `/settings/account` 合并进 `/settings/privacy` `/settings/profile` |
| **B. `export { default } from` 别名**（1 行跳转桩） | 5 | ✅ V2 不需要 | `/events/:p/results`、`/reports/:p/submitted`、`/messages/:p/search` 等，指向的页 V2 已有 |
| **C. 空态壳 / 静态壳**（0 API） | 5 | ⚪ 不做 | `/me/empty`、`/messages/empty`、`/share`、`/system/*` |
| **D. 同源劣化视图**（真实页，但 V2 更强） | 4 | ⚪ 不做 | `/spaces/:slug`、`/content/:t/:id/status`、`/comments/:id`、`/collections/public` |
| **E. 已由 V2 另一形状覆盖** | 3 | ✅ 覆盖 | `/me/collections/:p/edit`→`collectionsApi.update`；`/messages/groups/new`→`/me/groups` 内联建群；`/me/history`→`/me/bookshelf` + `/me/comments` |
| **F. 活动专题页**（Legacy 硬编码某届活动） | 5 | ⚪ 不做 | `/events/starry/*`、`/events/future-book/rules` —— 一次性活动，非通用能力 |
| **G. 设置子路由**（V2 用 5 页覆盖主干） | 16 | ⚪ 设计取舍 | 见 §19.3 |
| **H. P4 系统页** | 6 | ⚪ 不做 | `/system/error|forbidden|maintenance|not-found|offline|rate-limited` |
| **I. V2 已有等价物（路径不同）** | 5 | ✅ 覆盖 | `/help*`→`/guide*`；`/rankings`/`/categories`/`/features`→V2 首页聚合 |

**结论：52 条里 0 条真缺口。** 16 条由 V2 覆盖，36 条有明确的「不做」理由。

### 19.3 G 类细化：设置子路由为什么是「取舍」不是「缺失」

关键发现：**`GET/PUT /api/v1/me/client-settings` 是一个无白名单的自由 blob**
（`ClientSettingsService.updateSettings` 只做 merge，不做 key 校验）。
Legacy 把 `notifications` / `preferences` / `appearance` / `searchHistory` 塞进这个 blob 做**双写**
（localStorage + 服务端）。

但**服务端自己只读三个键**：`readingHistoryEnabled`、`searchHistoryEnabled`、
`personalizedRecommendationEnabled`（`ClientSettingsService` 里的三个 `isXxxEnabled`）。
Legacy 写进去的 `notifications` / `preferences` / `appearance` **没有任何服务端逻辑消费**——
它们只是「把一个 JSON 从 A 设备搬到 B 设备」。

→ V2 的判断（`SettingsNav.tsx` 注释已记录）：**这三类偏好没有真正的服务端语义**，
做一个纯搬运的 UI 只会让用户以为「设置了通知」而后端从不发通知。
**这是"漂亮谎话"的镜像**：Legacy 给了开关，开关背面什么都不接。

### 19.4 ⚠️ 本轮抓到的新错误（写进纪律）

**「Legacy `app/` 下无对应 page」这个断言，本轮被证伪 3 次。**

| 路由 | 旧理由（错） | 实际 |
|---|---|---|
| `/spaces/:slug` | 目录不存在 | **301 行真实页**，真调 `getSpaceWorks` |
| `/content/:type/:id/status` | 未实现 | **12 行真实页**，真调 `listMyArticles` |
| `/comments/:id` | 目录不存在 | **59 行真实页**，真调 `getComment` |

三条的**结论**（不做）都对，但**理由全错**。修正后理由见 §18.5 表。

> **教训**：这和我之前踩的「路径字符串骗人」是**同一类错误的反向**。
> 之前是「清单里有 → 以为功能在」；这次是「清单里没有 → 以为页面不在」。
> **两个方向都要用事实验**：
> - 判「有没有后端能力」→ 读**调用点的函数体**
> - 判「有没有页面」→ `test -f` **逐个验文件**，不要凭印象或凭清单缺席下结论

### 19.5 唯一遗留的诚实提醒

`archive/xingyu-web-legacy/public/prototype-assets/` 有 **276 个文件 / 22 MB**，
但它们在 git 里**既不是已跟踪，也不显示为未跟踪** —— 因为 `.gitignore:154` 有一条
**显式的项目策略**：`prototype-assets/`（属「原型 / QA 临时资产」组，与 `mockup/`、
`wireframe/`、`figma/` 同列）。

```
.gitignore:154:prototype-assets/    ← 全部被忽略
git ls-files .../prototype-assets   → 0
find     .../prototype-assets -type f → 276
```

**判定：这是既有的有意排除，不是归档造成的丢失。** 归档用的是 `git mv`，只搬已跟踪文件，
对这份被忽略的目录**既没增也没减**。

#### ⚠️ 但「被忽略」不等于「无价值」——它其实是 Legacy 的**线上渲染资产**

补19 追加核实（源码 + 实跑）：

- **Legacy 引用它 102 处，横跨 48 个文件**（`grep -rn prototype-assets`）。
  内容不是草稿，而是页面**实际渲染的插画**：首页推荐位封面、徽章图、分类行星图、
  活动 hero 图、收藏夹头图、`events.module.css` 的 `url(...)` 背景等。
- **V2 完全不引用它**（`grep -rn prototype-assets xingyu-web-next/` → 0 命中，
  且 `xingyu-web-next/public/` 为空）。所以这**不影响 V2 运行**，
  但意味着**归档的 Legacy 无法仅从 git 复现**：新克隆会得到 276 张坏图。

**副本情况（我原先写「只有这一份」，不准确）**：

```
public/prototype-assets/   276 文件 · .gitignore:154 忽略 · 未跟踪
dist/prototype-assets/     674 文件 · .gitignore:26  dist/ 忽略 · 未跟踪
抽查 cmp → 内容一致（dist 那份额外含构建产物）
```

→ 本机**确有两份**，但**两份都不在版本控制里**，所以「新克隆即复现」仍不成立。

→ **提醒（非缺陷，但需决策）**：若仍需长期保留，应**单独备份或补一次提交**
（须同时放宽 `.gitignore` 两行）。若确认无用，可按 `archive/README.md`
§「如果想彻底删除它」的清单执行 —— **该 README 已在归档时点准确记录此事**，
本节只是补上「Legacy 确实引用它」这一层依赖证据。

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
| 2N | 创作空间分类 `/studio/categories`（**非迁移：后端 CRUD 完整但 Legacy 从未做页面**） | ✅ `82f4740` |
| 3A | 徽章成就 `/me/badges`（修正 Legacy 的「隐藏徽章」与凭空等级；**顺带推翻补3 的阅读历史结论**） | ✅ `8d1de83` |
| 3B | 成长记录 `/me/growth`（五路聚合；**每区块独立三态**；修 `PendingAction.id` 潜伏类型错误 + href 死链） | ✅ 见 §三·补14 |
| 3C | 关系请求 `/me/requests`（**纠正标题 > 内容**；仅「我提交的入群申请」；**不做** owner 审批队列与虚构的关注申请） | ✅ 见 §三·补15 |
| 3D | 我的探索 `/me/interests`（**核实并定性 `/explore/me` 游客 500 = 后端缺陷**；`PUT` 破坏性全覆盖 → 完整状态 + 无变化不发） | ✅ 见 §三·补16 |
| 3E | 我的群聊 `/me/groups`（同源但**真缺口**；**发现 `POST /messages/group` 真实存在**且只吃 `title`；Legacy 两个链接都指向不存在的路由） | ✅ 见 §三·补17 |
| 3F | 推荐反馈 `/feedback/recommendations`（**核实「尚未核实」清单 7 条，只此 1 条是真缺口**；POST 只吃 `body` → 必须声明范围；后端**无 DELETE** → 不给删除控件） | ✅ 见 §三·补18 |

**P3 至此收尾**（3A–3F）：徽章 / 成长 / 关系请求 / 我的探索 / 我的群聊 / 推荐反馈全部交付。
**V2 缺口清单已清空** —— 剩余项全是已核实的「不做」（前端拼装、静态壳、Legacy 自身未实现）。

**优先级修正**（核实后）：
- **Events 应上调到 P0** —— 唯一确认公开可读（200）的缺口，且用户侧可见度高。
- **`/creators` 可低成本先做** —— 全部复用已有接口，无新后端。
- **`/rankings`、`/categories`、`/features`、`/help` 建议不做或并入现有页** ——
  前三个是前端拼装（无独立数据源），`/help` 与 `/guide` 同源。
  **不要为了"路由对齐"而搬它们**，那只会造出四个和 `/discover`、`/guide` 语义重叠的页面。


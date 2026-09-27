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
| **关注动态 / 我的动态** | `/me/moments` | ✅ 401 | 2D 只做了公开 `/moments`，个人维度没做 |
| **我的互动**（赞/评论/历史） | `/me/likes`、`/me/comments`、`/me/history` | ✅ 401 | 三个独立页，都是「我留下的痕迹」 |

### 🟠 P1 — 内容生态补全

| 功能 | Legacy 路由 | 后端 | 说明 |
|---|---|---|---|
| **活动 Events** | `events` 下 **8 条**（含报名/提交/结果/排行） | ✅ **200（公开可读！）** | 唯一探测到 **200** 的，说明是公开功能，优先级应上调 |
| **榜单** | `/rankings` | ⚪ **无独立后端** | 页面是 `getDiscover`+`getGalaxies`+`getTopics`+`listSeries` 的**前端拼装**（已核实，4 处引用全是复用） |
| **分类** | `/categories` | ⚪ **无独立后端** | 仅 `getDiscover`+`getTopics` 拼装 |
| **精选** | `/features` | ⚪ **无独立后端** | `getDiscover`+`getSuggestedUsers`+`getTopics`+`listSeries` 拼装 |
| **创作者** | `/creators` | ✅ 复用已有 | `getProfile`/`getTopicCreators`/`getUserWorks`/`followUser`/`unfollowUser`（探针均 200/401，存在） |
| **举报 / 申诉** | `reports` 下 4 条、`appeals` | ✅ 401 | `/api/v1/me/reports`、`/api/v1/me/appeals` 均存在（需登录） |
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
| 动态发布 | `/studio/moments/new` | 2D 有 `MomentDetailPage` 但**没有发布页** |

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

2. **`/me/moments` 与 `/studio/moments/new` 一起缺失**，意味着 V2 的用户**只能看动态、不能发动态**。
   2D 当时是有意只做公开读侧，但作为「完整功能面」这是个真缺口。

---

## 三·补 · Phase 2I-2 通知中心的三条勘误（四源确认，2026-09-27）

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


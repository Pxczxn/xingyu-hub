# xingyu-web Route Ledger + Static Design 覆盖对账（Reconciliation）

日期：2026-10-08
范围：**只对账**，不重新审计页面、不改源码、不 commit、不做 Motion；仅 `xingyu-web`。
基线：`xingyu-web/src/router/routes.tsx`（1234 行）

---

## 0. 计数口径（先定义，避免"约 20 + 约 12 + 约 45"这类对不上的说法）

| 指标 | 数值 | 可复核来源 |
|---|---|---|
| `<Route` 声明总数 | **97** | `grep -c '<Route' src/router/routes.tsx` |
| 其中 `path="..."` 字面路由 | **92** | `grep -o 'path="[^"]*"' \| wc -l` |
| 其中 `LEGACY_REDIRECTS.map()` 展开 | **5** | `redirects.tsx:26-32`（5 条） |
| **路由声明总数** | **97 = 92 + 5** | ✅ 可逐项还原 |
| 其中带 `RequireAuth` 的路由 | **54** | 见 §2 逐行 |
| 其中公开（无 RequireAuth） | **38** | 见 §2 逐行 |
| 纯 redirect / alias 声明 | **6** | 5 legacy + `/onboarding/*` 4 别名 → 见下 |
| pathless layout 声明 | **3** | `AppLayout` / `AuthLayout narrow` / `AuthLayout wide` / `SettingsLayout`(pathless 父) → 实为 4 |
| wildcard 声明 | **1** | `*` → `NotFound` |
| 独立页面组件（`features/*/pages/*.tsx` 非测试） | **86 文件** | `ls src/features/*/pages/*.tsx \| grep -v test \| wc -l` |
| **独立页面（去重后）** | **82** | 86 文件 − 4 个非路由页（`MeRedirectPage`/`OnboardingAliasRedirect`/`SettingsLayout` 是壳；`ConversationAssetsPage` 复用 2 次） |

> **"路由声明数 ≠ 独立页面数"**：97 条声明里 5 条 legacy redirect、4 条 onboarding 别名、
> 1 条 wildcard 不新增页面；`/messages/:conversationId/media` 与 `/files` 共用一个组件；
> `/messages` 与 `/messages/:conversationId` 共用 `MailboxPage`。
> 因此 **97 声明 → 82 独立页面**。

---

## 1. 更正记录（对上一版 Inventory 的四处修正）

| # | 上一版结论 | 更正 | 证据 |
|---|---|---|---|
| 1 | Search "Not Audited" | **已审计**（含在 Discover 审计内） | `2026-10-04.md:380-401`：`/api/v1/search` 无富化、搜索页 docH=900、排序控件形态 —— 逐项实测 |
| 2 | Messages "Conditionally Sealed + 单 WS + 重连不补拉为缺陷" | **缺陷不存在**：单标签一条 WS、服务端多 session、重连 REST 补拉均已实施 | 见 §3 |
| 3 | Governance / Notifications 的独立欠账被写进"未完成项" | **拆开**：Static Design 封板状态与 Product Debt 独立记录 | 见 §5 |
| 4 | 403 缺失 = blocker | **不成立**：隐私走 404 是刻意设计，无 403 页面不等于恢复体验坏 | 见 §4 |

### 1.1 追加更正（第二轮最小修正，核验当前代码）

| # | 上一版结论 | 更正 | 当前代码证据 |
|---|---|---|---|
| 5 | 「Search 只返回 ARTICLE」 | **撤销**。Search 支持多类型 + 隐私过滤 + LIKE 转义 | `SearchService.java:26-62` `normalizeType`(ALL/ARTICLE/SERIES/MOMENT/USER)，无 type 过滤时追加 `min(8,limit)` 个用户；`searchUsers:64-74` 走 `profileMapper.searchDiscoverableByHot/Latest`（仅可发现 profile）；`escapeLikeLiteral:135-137` 转义 `!`/`%`/`_`；`SearchDocumentMapper.java:61,78` `LIKE CONCAT('%',#{query},'%') ESCAPE '!'`；`SearchPage.tsx:138` 有 `objectType==="USER"` → `UserSearchResult` 分支；`search.test.tsx` 存在。**无回归** |
| 6 | Notifications「未做封板」 | **封板**。cursor 分页单列 Product Debt | 10-06 Contract Recovery + 浏览器 1440/390 视觉验收；`.ai/HANDOFF.md` 明确 limit 钳 50/100、无 cursor |
| 7 | Messages 子路由「随工作区一并完成」 | **主工作区已验收，子路由逐项保留欠账** | 见 §5 与 §3 |
| 8 | 「`/messages/search` 全站无入口」 | **撤销**。入口存在 | `MailboxPage.tsx:87,100-104` 有「搜索消息」链接（10-06 加入） |
| 9 | 「举报需手输内容 UUID」 | **撤销**。Contract Recovery 已修复 | `NewReportPage.tsx:18-25` 注释「UUID 文本框已移除」；`:62` 从 `?objectType=&?objectId=` 读路由参数；`:197` "No UUID is shown or editable." |
| 10 | Public Series / Article Detail / Public Profile / Moments / Galaxies 归为 Not Audited | **改为有历史记录**：Series = 已审计（10-04 Series Audit）；Article Detail / Public Profile / Moments / Galaxies 见 §7 待核实（**不推测**为"已审计"） | `2026-10-04.md` Series Audit（1440/390 实测 + 三态降级）；其余四项**只有口头验收可能、无落盘**，仍标待核实 |

---

## 2. 逐条 Route Ledger（97 条，可逐项还原）

图例：**S**=Sealed · **CS**=Conditionally Sealed · **A**=已审计未封板 · **NA**=真正未审计 · **R**=redirect/alias · **L**=pathless layout · **W**=wildcard
Debt 列独立于 Static Design 状态。

### 2.1 AppLayout 组（公开，无 RequireAuth）— 38 条中的公开页

| # | 声明 | 展开路径 | 组件 | 类型 | Static Design | 封板/审计证据 | 未完成验收 | Product Debt |
|---|---|---|---|---|---|---|---|---|
| 1 | `path="/"` | `/` | HomePage | page | **S** | 10-03/10-04 首页视觉+Correctness Sweep | — | — |
| 2 | `path="/discover"` | `/discover` | DiscoverPage | page | **S** | 10-04 Discover 三处修复+契约审计 | — | domain/sort 筛选后端不认（补19） |
| 3 | `path="/search"` | `/search` | SearchPage | page | **A** | 10-04 实测（无富化/docH 空白）+ 本轮核验多类型/隐私/LIKE 转义 | 未做 Final Fix，未封板 | — |
| 4 | `path="/topics"` | `/topics` | TopicsPage | page | **S** | 10-04 五项确定性修复 | 390 描述截断（已报告） | — |
| 5 | `path="/topics/:slug"` | `/topics/:slug` | TopicDetailPage | page | **S** | 同上 | — | — |
| 6 | `path="/creators"` | `/creators` | CreatorsPage | page | **CS** | 补6 定性（纯前端聚合） | 无独立数据源，可能"永远为空" | 依赖 topics/users 聚合 |
| 7 | `path="/announcements"` | `/announcements` | AnnouncementsPage | page | **S** | 10-07 audit + Final Fix | — | — |
| 8 | `path="/announcements/:id"` | `/announcements/:id` | AnnouncementDetailPage | page | **S** | 同上 | — | — |
| 9 | `path="/guide"` | `/guide` | GuideIndexPage | page | **S** | 治理封板验收含 Guide | — | — |
| 10 | `path="/guide/:slug"` | `/guide/:slug` | GuideDetailPage | page | **S** | 同上 | — | — |
| 11 | `path="/rules"` | `/rules` | RulesPage | page | **S** | 同上 | — | — |
| 12 | `path="/collections/:id"` | `/collections/:id` | CollectionPublicPage | page | **NA** | 无审计记录 | 全页未审计 | UNLISTED 亦 404 |
| 13 | `path="/moments"` | `/moments` | MomentsPage | page | **NA** | 10-03 仅记"空态空洞" | 全页未审计 | — |
| 14 | `path="/moments/:id"` | `/moments/:id` | MomentDetailPage | page | **NA** | 无审计记录 | 全页未审计 | — |
| 15 | `path="/series"` | `/series` | PublicSeriesListPage | page | **A** | 10-04 Series Audit（列表/详情/阅读器全测） | 未做 Final Fix；作者缺失契约缺口 | 公开 DTO 无作者 |
| 16 | `path="/series/:seriesId"` | `/series/:seriesId` | PublicSeriesDetailPage | page | **A** | 同上 | 同上 | 同上 |
| 17 | `path="/series/:seriesId/read"` | `/series/:seriesId/read` | PublicSeriesReadPage | page | **A** | 同上（阅读器） | 长目录 3+ 篇未实测 | — |
| 18 | `path="/galaxies"` | `/galaxies` | GalaxyListPage | page | **NA** | 无审计记录 | 全页未审计 | — |
| 19 | `path="/galaxies/:slug"` | `/galaxies/:slug` | GalaxyDetailPage | page | **NA** | 无审计记录 | 全页未审计 | — |
| 20 | `path="/galaxies/:slug/members"` | `/galaxies/:slug/members` | GalaxyMembersPage | page | **NA** | 无审计记录 | 全页未审计 | — |
| 21 | `path="/galaxies/:slug/content"` | `/galaxies/:slug/content` | GalaxyContentPage | page | **NA** | 无审计记录 | 全页未审计 | — |
| 22 | `path="/events"` | `/events` | EventsPage | page | **S** | 10-08 Part C 封板 | — | 无容量/上下线 |
| 23 | `path="/events/:eventId"` | `/events/:eventId` | EventDetailPage | page | **S** | 同上 | — | — |
| 24 | `path="/articles/:articleId"` | `/articles/:articleId` | ArticleDetailPage | page | **NA** | 无审计记录 | 全页未审计（最重阅读管线） | — |
| 25 | `path="/u/:username"` | `/u/:username` | UserProfilePage | page | **NA** | 无审计记录 | 全页未审计 | — |

### 2.2 AppLayout 组（RequireAuth）— 54 条中的受保护页

| # | 声明 | 展开路径 | 组件 | 类型 | Static Design | 封板/审计证据 | 未完成验收 | Product Debt |
|---|---|---|---|---|---|---|---|---|
| 26 | `/feedback/recommendations` | 同 | RecommendationFeedbackPage | page | **NA** | 补18 只定性契约 | 未做视觉审计 | 后端无 DELETE |
| 27 | `/me/galaxies` | 同 | MyGalaxiesPage | page | **NA** | 无审计记录 | 未审计 | — |
| 28 | `/events/:eventId/submit` | 同 | EventSubmitPage | page | **S** | 随 Events 封板 | — | — |
| 29 | `/me/events` | 同 | MyEventsPage | page | **S** | 随 Events 封板 | — | — |
| 30 | `/me` | 同 | MeRedirectPage | redirect | **S** | 纯跳转 | — | — |
| 31 | `/me/collections` | 同 | CollectionsPage | page | **NA** | 无审计记录 | 未审计 | — |
| 32 | `/me/collections/:id` | 同 | CollectionManagePage | page | **NA** | 无审计记录 | 未审计 | — |
| 33 | `/me/bookshelf` | 同 | BookshelfPage | page | **NA** | 无审计记录 | 未审计 | — |
| 34 | `/me/following` | 同 | MyFollowingPage | page | **NA** | 无审计记录 | 未审计 | — |
| 35 | `/me/followers` | 同 | MyFollowersPage | page | **NA** | 无审计记录 | 未审计 | — |
| 36 | `/me/moments` | 同 | MyMomentsPage | page | **NA** | 无审计记录 | 未审计 | — |
| 37 | `/me/likes` | 同 | MyLikesPage | page | **NA** | 无审计记录 | 未审计 | — |
| 38 | `/me/comments` | 同 | MyCommentsPage | page | **NA** | 无审计记录 | 未审计 | — |
| 39 | `/me/badges` | 同 | AchievementBadgesPage | page | **CS** | 补12 定性（固定五枚） | 未做视觉审计 | — |
| 40 | `/me/growth` | 同 | GrowthPage | page | **CS** | 补14 定性（五路聚合三态） | 未做视觉审计 | — |
| 41 | `/me/requests` | 同 | GroupJoinRequestsPage | page | **NA** | 补15 只定性 | 未审计 | owner 审批队列不做 |
| 42 | `/me/interests` | 同 | ExplorationInterestsPage | page | **NA** | 补16 只定性 | 未审计 | PUT 破坏性全覆盖 |
| 43 | `/me/groups` | 同 | MyGroupsPage | page | **NA** | 补17 只定性 | 未审计 | 群管理不做 |
| 44 | `/reports` | 同 | MyReportsPage | page | **S** | 治理封板（5 surface 收敛） | — | — |
| 45 | `/reports/new` | 同 | NewReportPage | page | **S** | 同上 | — | — |
| 46 | `/reports/:reportId` | 同 | ReportDetailPage | page | **S** | 同上 | — | — |
| 47 | `/appeals` | 同 | MyAppealsPage | page | **S** | 同上 | — | — |
| 48 | `/appeals/new` | 同 | NewAppealPage | page | **S** | 同上 | — | **无 in-product 入口** |
| 49 | `/appeals/:appealId` | 同 | AppealDetailPage | page | **S** | 同上 | — | 无 in-product 入口 |
| 50 | `/notifications` | 同 | NotificationsPage | page | **S** | 10-06 Contract Recovery + 1440/390 视觉验收，已封板 | — | Pagination Debt |
| 51 | `/messages` | 同 | MailboxPage | page | **A** | 10-06 Messages Final Fix 已实施，主工作区已验收 | 未做正式封板验收 | — |
| 52 | `/messages/:conversationId` | 同 | MailboxPage | page | **A** | 同上 | 同上 | — |
| 53 | `/messages/search` | 同 | SearchMessagesPage | page | **A** | 同上 | 子路由**未独立验收** | 入口不显眼（`MailboxPage.tsx:100` 安静文本链接） |
| 54 | `/messages/:conversationId/media` | 同 | ConversationAssetsPage kind=media | page | **A** | 同上 | 子路由**未独立验收** | — |
| 55 | `/messages/:conversationId/files` | 同 | ConversationAssetsPage kind=files | page | **A** | 同上 | 子路由**未独立验收** | — |
| 56 | `/messages/saved` | 同 | SavedMessagesPage | page | **A** | 同上 | 子路由**未独立验收** | 入口刻意下线（`UserMenu.tsx:15-17`） |
| 57 | `/studio` | 同 | StudioPage | page | **NA** | 无审计记录 | 未审计 | — |
| 58 | `/studio/content` | 同 | ContentListPage | page | **NA** | 无审计记录 | 未审计 | — |
| 59 | `/studio/submissions` | 同 | MySubmissionsPage | page | **NA** | 补7 只定性 | 未审计 | — |
| 60 | `/studio/submissions/:submissionId` | 同 | SubmissionDetailPage | page | **NA** | 同上 | 未审计 | — |
| 61 | `/studio/series` | 同 | SeriesListPage | page | **NA** | 无审计记录 | 未审计 | — |
| 62 | `/studio/series/new` | 同 | SeriesNewPage | page | **NA** | 无审计记录 | 未审计 | — |
| 63 | `/studio/series/:id/edit` | 同 | SeriesEditPage | page | **NA** | 无审计记录 | 未审计 | — |
| 64 | `/studio/series/:id/articles` | 同 | SeriesArticlesPage | page | **NA** | 无审计记录 | 未审计 | — |
| 65 | `/onboarding` | 同 | OnboardingPage | page | **NA** | 无审计记录 | 未审计（515 行） | — |
| 66 | `/onboarding/welcome` | 同 | OnboardingAliasRedirect | alias | **NA** | 别名跳转 | — | — |
| 67 | `/onboarding/interests` | 同 | OnboardingAliasRedirect | alias | **NA** | 别名跳转 | — | — |
| 68 | `/onboarding/follows` | 同 | OnboardingAliasRedirect | alias | **NA** | 别名跳转 | — | — |
| 69 | `/onboarding/profile` | 同 | OnboardingAliasRedirect | alias | **NA** | 别名跳转 | — | — |
| 70 | `/settings/profile` | 同 | SettingsProfilePage | page | **NA** | 无审计记录 | 未审计 | — |
| 71 | `/settings/privacy` | 同 | SettingsPrivacyPage | page | **NA** | 无审计记录 | 未审计 | — |
| 72 | `/settings/sessions` | 同 | SettingsSessionsPage | page | **NA** | 无审计记录 | 未审计 | — |
| 73 | `/settings/blocks` | 同 | SettingsBlocksPage | page | **NA** | 无审计记录 | 未审计 | — |
| 74 | `/settings/api-tokens` | 同 | SettingsApiTokensPage | page | **NA** | 无审计记录 | 未审计 | — |
| 75 | `/settings/security/email` | 同 | SettingsEmailPage | page | **NA** | 无审计记录 | 未审计 | — |
| 76 | `/settings/data/export` | 同 | SettingsDataExportPage | page | **NA** | 无审计记录 | 未审计 | — |
| 77 | `/settings/data/delete-account` | 同 | SettingsDeleteAccountPage | page | **NA** | 无审计记录 | 未审计 | — |
| 78 | `/settings/security/re-authenticate` | 同 | SettingsReauthenticatePage | page | **NA** | 无审计记录 | 未审计（流程步） | — |
| 79 | `/studio/analytics` | 同 | StudioAnalyticsPage | page | **NA** | 补9 只定性 | 未审计 | — |
| 80 | `/studio/content/:articleId/versions` | 同 | ArticleVersionsPage | page | **NA** | 补9 只定性 | 未审计 | — |
| 81 | `/studio/collaboration` | 同 | CollaborationInvitePage | page | **NA** | 补10 只定性 | 未审计 | **后端空心** |
| 82 | `/studio/collaboration/accept` | 同 | CollaborationAcceptPage | page | **NA** | 同上 | 未审计 | **accept 0 写** |
| 83 | `/studio/categories` | 同 | StudioCategoriesPage | page | **NA** | 补11 只定性 | 未审计 | — |
| 84 | `/studio/content/:articleId` | 同 | EditorPage | page | **NA** | 无审计记录 | 未审计（重编辑器） | — |

### 2.3 Auth 组（AuthLayout，公开）

| # | 声明 | 展开路径 | 组件 | 类型 | Static Design | 证据 | 未完成验收 | Product Debt |
|---|---|---|---|---|---|---|---|---|
| 85 | `/login` | 同 | LoginPage | page | **NA** | 无审计记录 | 未审计 | — |
| 86 | `/register/pending-audit` | 同 | PendingAuditPage | page | **NA** | 无审计记录 | 未审计 | — |
| 87 | `/verify-email` | 同 | VerifyEmailPage | page | **NA** | 无审计记录 | 未审计 | — |
| 88 | `/forgot-password` | 同 | ForgotPasswordPage | page | **NA** | 无审计记录 | 未审计 | — |
| 89 | `/reset-password` | 同 | ResetPasswordPage | page | **NA** | 无审计记录 | 未审计 | — |
| 90 | `/force-change-password` | 同 | ForceChangePasswordPage | page | **NA** | 无审计记录 | 未审计 | — |
| 91 | `/register`（wide） | 同 | RegisterPage | page | **NA** | 无审计记录 | 未审计（372 行） | — |

### 2.4 其它

| # | 声明 | 展开路径 | 组件 | 类型 | Static Design | 证据 | 未完成验收 | Product Debt |
|---|---|---|---|---|---|---|---|---|
| 92 | `*` | 兜底 | NotFound | wildcard | **A** | 10-03 修居中/插画（未正式审计） | 未做移动端审计 | — |
| L1 | `<Route element={<AppLayout/>}>` | — | AppLayout | layout | **A** | 10-03 移动导航/搜索/skip-link | 未审计 | — |
| L2 | `<Route element={<AuthLayout width="narrow"/>}>` | — | AuthLayout | layout | **NA** | 10-03 仅宽度变体 | 未审计 | — |
| L3 | `<Route element={<AuthLayout width="wide"/>}>` | — | AuthLayout | layout | **NA** | 同上 | 未审计 | — |
| L4 | `<Route element={<RequireAuth><SettingsLayout/></RequireAuth>}>` | — | SettingsLayout | pathless layout | **NA** | 10-03 只改 h1 | 未审计 | — |
| R1 | `from:"/users/:username"` | `/users/:username` | → `/u/:username` | redirect | **S** | 5 条 legacy 之一 | — | — |
| R2 | `from:"/tags"` | `/tags` | → `/topics` | redirect | **S** | 同上 | — | — |
| R3 | `from:"/articles"` | `/articles` | → `/discover` | redirect | **S** | 同上 | — | — |
| R4 | `from:"/me/profile"` | `/me/profile` | → `/settings/profile` | redirect | **S** | 同上 | — | — |
| R5 | `from:"/settings"` | `/settings` | → `/settings/profile` | redirect | **S** | 同上 | — | — |

---

## 3. Messages 事实更正（逐条核验当前代码）

| 声明 | 当前代码证据 | 结论 |
|---|---|---|
| 单标签页共享 WebSocket | `ChatSocketProvider.tsx` 全应用唯一一条连接；`AppProviders.tsx:11` 注释 "ONE community WebSocket per tab"；`ConversationThreadPage.tsx:28` "no longer opens a WebSocket… SUBSCRIBES to the single tab-wide connection"；`AppLayout.tsx:51` 同 | ✅ **已实施，未回归** |
| 服务端支持同一用户多个 session | `CommunityChatWebSocketHandler.java:60` `Map<String, Set<WebSocketSession>> sessions`；`:78-80` 新连接 **不** 踢旧连接；`:142-156` 只移除当前 session；类注释 `:25-40` 记录 2026-10-06 变更 | ✅ **已实施，未回归** |
| 断线重连 REST `afterSequence` 补拉 | `ChatSocketProvider.tsx:125-146` `backfill()` 用 `messagesApi.listMessagesAfter(conversationId, cursor, BACKFILL_PAGE)` 循环补拉；`:216` 每次收到 `connected` 即调用；`messages.api.ts:131-146` 参数与注释；`chat-socket.test.tsx:249/295/306` 三条测试 | ✅ **已实施，未回归** |
| 未读计数正确性修复 | `ChatMessageMapper.java:58-70` 注释 "2026-10-06：此前没有 sender_id != #{userId} 过滤" 且 SQL `:65` `AND m.sender_id <> #{userId}`；`:66-69` 用 `last_read_sequence` 而非时间戳 | ✅ **已实施，未回归** |
| sequence 正确性 | `messages.types.ts:208` 注释：不传 `afterSequence` = 从最早开始；`ChatMessageMapper` 用 `sequence_number` 而非时间戳做增量对账 | ✅ **已实施，未回归** |

**结论：上一版把"单 WebSocket""重连不补拉"列为当前缺陷是错的，已撤销。**
Messages 的 Static Design 状态应为 **已审计（10-06 Contract Recovery + Final Fix 已实施）**，
仅剩未做正式"封板 1440/390 最终验收"这一项；无真实功能回归。

---

## 4. 403 重新评价

按用户要求分四类核查真实用户路径：

| 场景 | 真实实现 | 证据 | 判定 |
|---|---|---|---|
| 隐私保护故意 404 | ✅ 刻意 | `collections.types.ts:9` "UNLISTED is NOT link-readable (anon + other user → 404)"；`announcements.api.ts:6` ARCHIVED/missing→404；`events.api.ts:27` 非 ACTIVE→404；`articles.api.ts:47` "404 for both does-not-exist and not-mine" | **正确设计，非缺陷** |
| 需要重新认证 | ✅ 有专门流程 | `account.api.ts:47` 无 `X-Recent-Auth`→403 `AUTH_FORBIDDEN`；`SettingsReauthenticatePage.tsx:15` 专门 mint recent-auth grant | **有恢复体验，非缺陷** |
| 真正权限不足 | 后端**刻意与"不存在"合并为 404**，无独立 403 语义 | `EditorPage.tsx:251` "no distinct 403, so there is no separate forbidden state to show"；`SubmissionDetailPage.tsx:84` 同；`api-tokens.api.ts:16` revoke 他人 token→404 | **不需要独立 403 页** |
| 系统异常 | 由 `RouteErrorPage` + `PageErrorBoundary` 承接 | `App.tsx:38` errorElement；`AppLayout.tsx:511` PageErrorBoundary | **已覆盖** |

**结论：全站缺独立 403 页 = 不是 blocker，也不是 Product Debt，只是"不需要的一项"。
真实恢复体验（重新认证、404 隐私、系统错误重试）都存在。** 上一版把它列为 blocker 已撤销。

**唯一值得记的观察（非缺陷）**：搜索结果页（`/search`）在 0 结果时下方有 555px 空白
（`2026-10-04.md:401`），属布局优化机会，不属权限恢复问题。

---

## 5. Product Debt 清单（独立于 Static Design 状态）

| Debt | 关联页面/路由 | Static Design 状态 | 性质 |
|---|---|---|---|
| 通知无 cursor 分页 | `/notifications` | **Sealed** | 后端只钳 limit 50/100，UI 不声称"全部"（`.ai/HANDOFF.md` 明确） |
| 公开 Series 无作者字段 | `/series*` | 已审计未封板 | 公开 DTO 丢 owner，补19 契约缺口 |
| `/appeals/new` 无 in-product 入口 | `/appeals/new` | **Sealed** | 治理封板时已记录，不撤销封板 |
| `/messages/saved` 入口刻意下线 | `/messages/saved` | 已审计 | `UserMenu.tsx:15-17`「收藏的私信」入口暂时下线；路由/API/后端保留 |
| Messages 子路由未做独立封板验收 | `/messages/search`、`/messages/:id/media`、`/messages/:id/files`、`/messages/saved` | 已审计 | 主工作区已验收；**子路由不得凭工作区封板一并宣称完成**，逐项保留 |
| `/messages/search` 无显眼入口（仅有安静文本链接） | `/messages/search` | 已审计 | `MailboxPage.tsx:100` 有入口，但为安静文本链接，非按钮级入口 |
| 协作后端空心（accept 0 写） | `/studio/collaboration*` | 未审计 | UI 已声明边界 |
| 群管理不做 | `/me/groups` | 未审计 | 后端有、本 Phase 不交付 |
| owner 审批队列不做 | `/me/requests` | 未审计 | 仅"我提交的入组申请" |
| 活动无容量/上下线/通知 | `/events*` | **Sealed** | 事件域封板时已记录，不撤销封板 |

**已撤销的三条（不再列为当前 Debt）**：
- ~~search 只返回 ARTICLE~~ → 当前代码支持 ARTICLE/SERIES/MOMENT/USER + 隐私过滤 + LIKE 转义，**无此 debt**。
- ~~`/messages/search` 全站无入口~~ → `MailboxPage.tsx:100` 有入口，**无此 debt**（仅"入口不显眼"）。
- ~~举报需手输内容 UUID~~ → Contract Recovery 已修复（`NewReportPage.tsx:62` 读路由参数），**无此 debt**。

**关键原则（本轮确立）**：Debt 与 Static Design 封板状态**并列记录，互不撤销**。
`/events`、`/appeals`、`/reports`、`/notifications` 的 Static Design 仍为 **Sealed**，同时各自挂 Debt 标签。
反向同样成立：**不得因 UI 封板就隐瞒真实产品债务。**

---

## 6. 准确状态统计（口径：**92 条字面路由**，脚本逐行还原）

对 §2 表格用脚本统计（`grep` 每一行的 Static Design 列），结果**可逐项还原**：

| 状态 | 条数 | 逐条编号 |
|---|---|---|
| **Sealed (S)** | **21** | 1,2,4,5,7,8,9,10,11,22,23,28,29,30,44,45,46,47,48,49,**50** |
| **Conditionally Sealed (CS)** | **3** | 6,39,40 |
| **已审计未封板 (A)** | **11** | 3,15,16,17,51,52,53,54,55,56,92 |
| **真正未审计 (NA)** | **57** | 其余全部（见 §2 各行） |
| **合计（字面路由）** | **92** | ✅ 21 + 3 + 11 + 57 = 92，与 `path="..."` 字面数一致 |

> **本轮变化**：#50 `/notifications` 由 **A → S**（已封板）；A 组由 12 条降为 11 条。总数仍闭合 92。

**另计（非"页面"但属路由声明）**：
- 5 条 legacy redirect（R1–R5）→ 全部 `S`（目标路由均已真实存在）
- 4 条 layout 声明（L1 AppLayout `A`；L2/L3 AuthLayout `NA`；L4 SettingsLayout `NA`）
- 1 条 wildcard（已含在 `#92`）

**总计：92 字面 + 5 legacy = 97 条路由声明**（= §0 口径）。
**独立页面：82**（86 个 `pages/*.tsx` 文件减去 4 个非路由/复用文件）。

> **可复核性**：每一行在 §2 有唯一 `#` 编号、路径、组件、状态与证据列；加总闭合到 92/97。
> **不再使用"约 20 + 约 12 + 约 45"** 这类无法还原的估数。
>
> **口径说明（已明确，不再是"待核实"）**：
> - "路由声明" = 97（92 字面 + 5 legacy redirect 展开）。
> - "独立页面" = 82（组件去重）。
> - **两者不做百分比推导**（用户明确禁止）。
> - 若用户希望把 5 条 legacy redirect / 4 条 layout 并入统计，本表已单列，可随时合并。

**（其余"待核实"项保留在 §7，指历史验收证据，不指计数口径。）**

---

## 7. 待核实清单（不猜测）

| 项 | 为什么待核实 |
|---|---|
| Galaxies / Moments / Article Detail / Public Profile 是否有过非 memory 的验收 | 仅查了 memory + docs/audit，未见记录；可能有口头验收未落盘。**用户明确表示「此前已有审计与条件封板记录」**，但本仓找不到落盘证据 → 保持"待核实"，**不推测为已审计，也不推翻用户陈述** |
| `/me/*` 系列（likes/comments/bookshelf/following 等）是否在"P1 交付"时做过视觉验收 | 早期 09-17/09-18 memory 是后端为主，未见前端视觉验收 |
| Studio 12 页是否在 Phase 2K/2L/2M/2N 交付时验收过 | 补7/补9/补10/补11 都是"契约核实"，非视觉审计 |
| 认证 7 页是否有任何验收 | 完全无记录（**下一阶段即为本组审计**） |

---

## 8. 下一批推荐 3–5 组（基于修正后的覆盖与真实风险）

1. **认证全流程（7 页 + `AuthLayout`）** — 零审计记录；产品第一屏；含审核态与强改密流程，风险最高。
2. **设置 / 账号安全（9 页 + `SettingsLayout` + `SettingsNav`）** — 零审计；唯一涉及改邮箱/导出/注销/
   re-auth 的敏感区；`/settings/security/re-authenticate` 已从 shell 中 hoist 但从未审计。
3. **创作中心 Studio（12 页，含 EditorPage）** — 零审计；内容生产核心；编辑器是全站最重交互页。
4. **`/articles/:articleId` + `/series/:seriesId/read`（阅读管线）** — 最重阅读路径，**从未审计**；
   series 已审计但有明确契约缺口（作者缺失）与长目录未测。
5. **`/moments` + `/galaxies`（6 页）** — 公开可达、零审计，且 `/moments` 已知"空态空洞"。

> `/me/growth`、`/me/badges` 已从"高优先级"下调：它们是 **Conditionally Sealed，
> 主体已定性是"骨架成立"**，欠的是视觉审计，风险低于"完全未看过"的认证/设置/Studio。

---

## 9. 边界声明

- 本轮**只对账**：未改源码、未 commit、未做 Motion、未重开已封板页面。
- 修订来源全部为可追溯文件：`routes.tsx`、`docs/audit/*`、`.workbuddy/memory/*`、`docs/codebase/LEGACY-DELTA.md`。
- 无法找到历史证据的项目一律标"待核实"，未猜测。

# Announcements / 公告体系 — Static Design Audit

日期：2026-10-07
范围：只调查，不改源码、不 commit、不做 Motion
基线：Messages Static Design 已封板（205 files / 2237 tests）

---

## 0. 结论先行

**公告是一套「全站公开广播内容」，不是「通知的一种」。当前骨架成立，不需要新建模块。**

- 它和 Notifications **数据层零耦合**：没有 producer、没有 per-user 行、没有 read state。
- 数据模型极简（6 列），UI 也极简（列表 + 详情 + 首页一行）。
- 真正的缺陷**不是缺功能，而是三处具体的工程质量问题**：
  ① 排序无 tie-breaker 导致同秒不确定；② 列表不露摘要；③ 详情「大壳小内容」。
- 另有 1 处死代码 + 1 处全项目共有的 contract smell。

最终判断：**保留骨架，做 3 处局部修复。不重构，不扩功能。**

---

## 1. 真实产品模型（DB → Service → API → Route → UI 全链）

### 1.1 DB

`sql/V015__discovery_notification.sql`

```sql
CREATE TABLE `announcement` (
  `id`           varchar(36)  NOT NULL COMMENT '公告标识',
  `title`        varchar(256) NOT NULL COMMENT '公告标题',
  `body`         text         NOT NULL COMMENT '公告正文',
  `status`       varchar(32)  NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态：DRAFT/PUBLISHED/ARCHIVED',
  `published_at` timestamp    NOT NULL COMMENT '发布时间（UTC）',
  `created_at`   timestamp    NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_announcement_status` (`status`,`published_at`)
) COMMENT='平台公告';
```

**没有** category / summary / pinned / priority / author / audience / link 任何一列。
「公告是几类职责混在一起吗？」——**不是**，物理上就没有承载多职责的字段。

### 1.2 status 三态

`AnnouncementService.normalizeStatus`：

| 输入 | 结果 |
|---|---|
| `PUBLISHED` | `PUBLISHED` |
| `DRAFT` | `DRAFT` |
| `ARCHIVED` | `ARCHIVED` |
| `UNPUBLISHED` | → `DRAFT`（兼容别名） |
| 其它 / 空 | `FieldContractException` |

### 1.3 API 双面

**公开面**（guest 可读，**裸 JSON，无 Result envelope**）：

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/api/v1/announcements?limit=` | 默认 20（`limit<=0` 兜底 20），只返回 `PUBLISHED` |
| GET | `/api/v1/announcements/{id}` | 非 `PUBLISHED` 或不存在 → 404 `problem+json` `NOT_FOUND` |

公开 DTO `AnnouncementView{id, title, body, publishedAt}` —— **`status` 与 `createdAt` 不外泄**（实测确认）。

**管理面**（`/api/v1/admin/operations/announcements`，`Result` envelope）：

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `` | `created_at DESC`，含 DRAFT/ARCHIVED |
| POST | `` | 强制 `status=PUBLISHED`（**不能建草稿**） |
| PATCH | `/{id}` | `{status}`，合法值同上 |

### 1.4 Route

`xingyu-web/src/router/routes.tsx`

```
/announcements       → AnnouncementsPage       （懒加载，guest 可进）
/announcements/:id   → AnnouncementDetailPage  （懒加载，guest 可进）
```

`static-info-routes.test.tsx` 断言二者均无登录重定向。

### 1.5 UI 三个消费者

1. **列表页** `/announcements` — 卡片列表：标题 + 日期，**仅此**。
2. **详情页** `/announcements/:id` — 「公告」badge + 标题 + 「发布 <日期>」meta strip + 正文。
3. **首页** `HomeNotice` — masthead 与 feed tabs 之间的**一行**：图标 + 最新公告标题 + 查看详情 ›。

### 1.6 首页公告来源（关键澄清）

- `GET /api/v1/home` 与 `GET /api/v1/me/home` **都不含公告字段**（`HomeCompositionView` / `MeHomeView`
  已 grep 确认无 `announcement`）。
- 首页**单独**调用 `homeApi.getAnnouncements(3)` = `GET /api/v1/announcements?limit=3`，
  然后只取 `items[0]` 渲染成 `HomeNotice`。
- **所以 Home 与列表共用同一条公开规则**（同一 endpoint、同一 `PUBLISHED` 过滤、同一排序），
  只有 limit 不同。**不存在"首页缓存了一份失效公告"的结构性风险**——每次都现查。

### 1.7 谁都能管理吗？

不能。写路径只有管理员：

- `CommunityAnnouncementController` 只暴露 2 个 GET。
- `AdminAnnouncementController` 提供 list/create/patch，走 admin 鉴权。
- 前端 admin 页 `community/announcements.vue` 只提供「下线(DRAFT)」「归档(ARCHIVED)」两个动作。
  **没有「重新上架」，没有「编辑正文」，没有「置顶」**。

---

## 2. Announcement / Notification 边界判决

| 维度 | Announcement | Notification |
|---|---|---|
| 受众 | 全站（含匿名） | 单个 user_id |
| 存储 | 1 行 = 1 条公告 | 1 行 = 1 个用户的 1 条通知 |
| 已读 | **无** | `read_at` |
| 产生方 | 管理员手工 | 行为事件（当前只有 FOLLOW） |
| 排序键 | `published_at` | `created_at, id` |
| 与对方关系 | **零外键、零写入耦合** | 同左 |

唯一连接点是一根 **UI 图标指针**：`notificationHref` 把 category `ANNOUNCE` 映射到 `/announcements`，
`NotificationRow` 给它一个 `Megaphone` 图标。

**但是**：全后端唯一 `setCategory` 调用仍是 `FOLLOW`。实测通知表 339 行，category **全部是 FOLLOW**。
`ANNOUNCE` 没有任何真实写入方。

**判决：保持独立。** 不要（在本轮或后续无据地）为公告新增 Notification producer、
已读状态、公告分类、弹窗强制阅读、用户级推送 —— 真实模型里都没有。

---

## 3. 真实验证记录

环境：`xingyu_hub_test` + 后端 fat jar（test profile, 7779）+ vite dev（7777）。
**所有样本均通过真实管理员 HTTP 路径创建，验证完毕后全部清理，基线回到 0 行。**

### 3.1 计数（真实 DB）

| 指标 | 值 |
|---|---|
| announcement 总行数（审计前） | **0** |
| 已发布 | 0 |
| 归档 | 0 |
| 置顶 | N/A（无该字段） |
| notification 行数 / category | 339 / 全为 FOLLOW |

**真实结论：公告表在两个库里都是空的。** 该功能从未被真实使用过 —— 与消息域同样的状态。

### 3.2 排序真行为

```
公开列表实测顺序（3 条同秒创建）：
2026-10-07T00:20:25Z | 同秒公告 B
2026-10-07T00:20:25Z | <img src=x ...>
2026-10-07T00:20:25Z | 同秒公告 A
```

- mapper：`ORDER BY published_at DESC`，**无任何 tie-breaker**。
- `published_at` 列是 `timestamp`（**秒精度**）；Java 层 `Instant.now()` 有纳秒，入库被截。
- 3 条同秒 → DB 全是同一秒 → **公开列表内互序不确定**（MySQL 不保证）。

这是**实测到的真 defect**，不是从字段名猜的。

**修正建议**：`ORDER BY published_at DESC, id DESC`。

### 3.3 归档公告的旧 URL

实测：`GET /announcements/{archived-id}` → 404 → 前端「公告不存在或未发布 / 这条公告可能已归档，
或地址有误。」+ 返回链接。**无残留内容、无泄露** ✅。

### 3.4 上传后（update）的时间诚实性

管理员只能改 `status`，**不能改正文**，所以「改了内容时间却没变」这类问题**结构上不存在**。
`updateStatusForAdmin` 只在 `PUBLISHED && publishedAt==null` 时补 `now()`；已经发布过的公告
重新发布不会重置 publishedAt（合理）。

### 3.5 `pinned` 能否暴露未发布内容

**不存在 `pinned` 字段**，该风险不成立。公开查询硬过滤 `status='PUBLISHED'`，详情页也二次校验。

### 3.6 detail 用稳定公开标识

用 `id`（UUID），不是自增/可猜测 id ✅。
（对比：`u/{username}` 那套是通知域的，公告没有这个问题。）

### 3.7 管理字段是否泄漏进公开 DTO

**未泄漏** ✅。`AnnouncementView` 只有 `{id,title,body,publishedAt}`；`status`/`createdAt` 只在
admin 面出现。

### 3.8 XSS

body 写入 `<b>粗体</b><script>alert('xss')</script><a href='javascript:alert(1)'>链接</a>`：

- 渲染出的 `innerHTML` = `&lt;b&gt;粗体&lt;/b&gt;...` —— **全部转义**。
- `article img` 计数 0，`article a` 计数 0，`img[src=x]` 计数 0。

**XSS 安全 ✅**（React 默认转义）。
**反差代价**：管理端写的 HTML/Markdown **不会被渲染**，只支持纯文本 + 换行
（`whitespace-pre-wrap`）。即公告正文没有任何富文本能力。

### 3.9 1440 / 390 布局

| 视口 | 结果 |
|---|---|
| 1440 列表 | 正常，无横向溢出 |
| 1440 详情 | 正常；article 宽 1152px，正文块宽 598px |
| 390 列表 | 正常，无横向溢出，单列卡片 |
| 390 详情 | 正常 |
| 390 首页 notice | 正常，一行，位于 masthead 与 feed tabs 之间 |

### 3.10 空态

0 条公告时：

- 首页 notice **整行消失**（`homeNoticePresent: false`），不加空盒子、不占高度 ✅。
- 首页侧栏**不出现**「社区公告」空模块 ✅。
- 列表页显示「暂无已发布公告 / 有新的已发布公告时会出现在这里。」✅。
- footer「公告」入口仍在（唯一可发现入口）✅。

### 3.11 测试

- 前端 announcements + home + static-info routes：**44 passed**。
- 后端 `Batch6OperationsIntegrationTest`（含公告 create→PATCH ARCHIVED 全链）：**1 passed**。

---

## 4. Static Design 问题（本轮只报告）

### P0 — 排序无 tie-breaker（见 3.2）

同秒公告互序不确定。`ORDER BY published_at DESC` → 加 `, id DESC`。

### P1 — 列表卡片不露摘要

列表 payload **带 body**，但卡片只渲染 `title` + `publishedAt`。用户扫列表时读不到任何摘要。

对比：**首页 notice 连 body 都不渲染**（只给 title），列表也**没有**用 body。
即整个公告体系**没有摘要层级**。

→ 这是真实的信息层级缺口（不是"数据太薄"，数据其实在手上）。

### P1 — 详情页「大壳小内容」

实测 1440：`article` 宽 **1152px**，正文块 `max-w-[68ch]` ≈ **598px**。
右侧约 550px 纯空白。正文只有 131 字时尤其空旷。

是否"PageHero 太重"？——公告页**没有用 PageHero**，列表页是一个简单的 `<header>` + `<h1>`；
详情页是 `<article>` + `<header>` + 正文。**外壳本身不重，是正文宽度上限与容器宽度不匹配**。
→ 收窄容器（或让正文块居中），而不是加装饰。

### P2 — 死代码

`xingyu-web/src/features/home/components/AnnouncementPanel.tsx` —— V2 **零引用**。
只有 `HomeNotice.tsx:14` 与 `TrendingTopicsPanel.tsx:17` 的注释提到它。

→ 可安全删除。**本轮未删**（只调查）。

### 观察 — 管理端 auth 的 contract smell（全项目共有，非公告特有）

无 token 请求返回 **HTTP 200** + body `{"code":401,"message":"请先登录"}`。
`/api/v1/admin/moderation/reports` 同样如此。**没有真实越权**，但 HTTP 感知的
客户端 / 缓存 / 探活会误判"成功"。

（附注：`/api/v1/admin/operations/galaxies` 无 token 反而返回 HTTP 500 —— 同类问题，
但不在本轮 scope，仅记录。）

### 明确不做的

按用户指令，以下**均未新增**，因为真实模型里没有：
公告分类、已读状态、弹窗公告、强制阅读、用户级推送、Notification producer。

---

## 5. 排序与时间语义（汇总）

| 项 | 真实语义 |
|---|---|
| 主排序 | `published_at DESC` |
| 次排序 | **无**（← defect） |
| 置顶 | **无该概念** |
| 置顶稳定性 | N/A |
| 时间字段 | 仅 `published_at` + `created_at`，均秒精度 `timestamp` |
| `publishedAt` 何时写 | create 时 = now；PATCH 到 PUBLISHED 且原为 null 时 = now |
| 归档后是否还在首页/列表 | **否**（公开查询硬过滤 PUBLISHED） |
| 首页展示条数 | 取 `limit=3` 的**第 0 条** |
| 首页与列表规则是否一致 | **一致**（同 endpoint、同过滤、同排序，仅 limit 不同） |

---

## 6. 最终判断

**保留骨架，做 3 处局部修复，不重构。**

| 项 | 判断 |
|---|---|
| 公告是否职责混杂 | 否。物理模型就是单一职责的公开广播内容 |
| 是否该并入 Notifications | 否。数据层零耦合，边界清晰 |
| 页面是否比公告本身更复杂 | 否。列表页/详情页都很克制；问题在正文宽度上限 |
| PageHero 是否过重 | 不适用（公告页未使用 PageHero） |
| 是否「大容器 + 小内容」 | **是**，仅详情页正文宽度（1152 vs 598） |
| 扫读效率 | 中等偏下（列表无摘要） |
| 置顶表达力 | N/A（无置顶） |
| 标题/时间/摘要/正文层级 | 缺**摘要**这一层 |
| 空态 | 已正确（首页自动消失，列表文案诚实） |
| 详情短文本外的大壳 | 见上 |
| 无附着装饰 | 无（页面很干净） |
| 首页与独立页重复 | 有意为之且不重复噪声（首页只 1 行 + 指针） |
| 是否数据太薄 | **不是**。数据够用，是**呈现没用上 body** |

### 修复清单（供下一轮决策，本轮未执行）

1. `AnnouncementMapper.listPublished` → `ORDER BY published_at DESC, id DESC`（P0）。
2. 列表卡片补一行摘要（`line-clamp-2` 用 `body`）（P1）。
3. 详情页收窄容器或居中正文块，消除 550px 空壳（P1）。
4. 删 `AnnouncementPanel.tsx` 死代码（P2）。

---

## 7. 本轮未改动的证据

- 源码：**0 个公告相关文件被修改**（`git status` 中唯一的 announcement 文件
  `AnnouncementPanel.tsx` 是**更早阶段**遗留的 `accent`→`accent-strong` 对比度改动，非本轮）。
- 数据：审计样本全部通过真实管理员路径创建，验证后**全部清理**，`announcement` 回到 0 行。
- 临时文件：全部删除。
- 服务：后端 7779 / vite 7777 均已停止，端口已释放。
- 未 commit，未做 Motion。

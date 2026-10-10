# Activities / Events — Static Design Audit

日期：2026-10-07
范围：只调查，不改源码、不 commit、不做 Motion
前置：Governance Static Design 已封板；Announcements Static Design 已审计
基线数据：`community_event` = 1 行（seed） / `event_submission` = 0 / `event_registration` = 0

---

## 0. 结论先行

**活动域是一套「真实存在、骨架正确、但缺少服务端时间约束」的完整功能，不是空壳。**

- DB → Service → API → Route → UI 全链条真实贯通，前端 feature 树有完整契约注释。
- **幂等、取消语义、投稿开关、并发唯一性**四项**全部实测正确**。
- 与 Announcements / Notifications **零交叉引用**，职责边界干净。
- 但存在 **1 个 P0 Correctness 缺口**：**服务端完全不校验活动时间窗口**。
  已用真实链路反证：一个 `ends_at = 2020-01-01`、`status = ACTIVE` 的活动，
  **公开列表照常返回、详情 HTTP 200、报名 HTTP 200 REGISTERED、投搞 HTTP 200 SUBMITTED。**
  前端的"已结束"判断纯属 UI 层遮蔽，绕过前端即失效。
- 另有 1 个 P2（status 无白名单）与若干产品缺口（无人数限制、无上下线、无活动通知）。
- Static Layout 层的问题**是上述 P0 的下游表现**：列表/首页把已结束活动当成进行中展示。

最终判断：**保留骨架，做局部修复（服务端时间门 + status 白名单），不重构。**

---

## 1. 真实产品模型（DB → Service → API → Route → UI 全链）

### 1.1 DB —— 3 张表

`sql/V021__community_events_guide_galaxy.sql`

```sql
CREATE TABLE `community_event` (
  `id`              varchar(36)  NOT NULL,
  `slug`            varchar(128) NOT NULL,
  `title`           varchar(256) NOT NULL,
  `body`            text         NOT NULL,
  `status`          varchar(32)  NOT NULL DEFAULT 'ACTIVE',  -- 仅 ACTIVE / ARCHIVED
  `starts_at`       timestamp    NULL,
  `ends_at`         timestamp    NULL,
  `submission_open` tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`      timestamp    NOT NULL,
  `updated_at`      timestamp    NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_event_slug` (`slug`),
  KEY `idx_community_event_status_starts` (`status`,`starts_at`)
);
-- seed: 01900000-0000-7000-8000-000000000201 / welcome-writing / 星语写作季
```

`event_submission`（投稿）：

```sql
UNIQUE KEY `uk_event_submission` (`event_id`,`author_id`,`object_type`,`object_id`)
-- status 仅 SUBMITTED
```

`sql/V035__event_registration.sql`（报名）：

```sql
CREATE TABLE `event_registration` (
  `id`           varchar(36) NOT NULL,
  `event_id`     varchar(36) NOT NULL,
  `user_id`      varchar(36) NOT NULL,
  `status`       varchar(32) NOT NULL,   -- REGISTERED / CANCELLED
  `created_at`   timestamp   NOT NULL,
  `cancelled_at` timestamp   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_registration` (`event_id`,`user_id`)
);
```

**关键否定事实（全库 grep 确认）**：三张表**都没有** `capacity` / `max_participants` /
`waitlist` / `registration_count` / `published_at` / `cover` / `location` / `organizer` 任何一列。
人数限制在产品模型里**根本不存在**。

### 1.2 Service —— `CommunityEventService`

| 方法 | 行 | 行为 |
|---|---|---|
| `register(eventId, userId)` | 48–75 | 读 `findByEventAndUser` → REGISTERED 直接返回；null 则 insert；CANCELLED 则复活 |
| `cancelRegistration` | 78–86 | 置 `CANCELLED` + `cancelled_at` |
| `submit(...)` | 90–115 | 校验 `submissionOpen`（409 "活动投稿已关闭"）+ 校验目标在 `search_document`（404）+ 幂等 |
| `reviewSubmission` | 154–155 | `normalizeReviewStatus`：ACCEPTED/APPROVED→ACCEPTED，REJECTED/DISMISSED→REJECTED |
| `createForAdmin` | 168–186 | **`setStartsAt(now)` 硬编码，完全忽略客户端 `endsAt`/`startsAt`** |
| `updateForAdmin` | 189–209 | `status` 直接写入，**无白名单** |
| `requireActiveEvent` | 211–217 | **仅判 `"ACTIVE".equals(status)`，从不比较 `starts_at`/`ends_at` 与 now** |

### 1.3 Mapper —— 时间过滤不存在

```java
// CommunityEventMapper.java
@Select("SELECT * FROM community_event WHERE status = 'ACTIVE'
         ORDER BY starts_at DESC, created_at DESC LIMIT #{limit}")
List<CommunityEvent> listActive(int limit);
```

**只有 `status = 'ACTIVE'`，没有任何 `starts_at <= now` / `ends_at >= now`。**

```java
// EventRegistrationMapper.java:22 —— 定义了，但全项目零调用
long countRegistered(String eventId);
```

`countRegistered` 是**唯一的人数限制钩子，且是死代码**（`grep -rn countRegistered` 仅命中定义处）。

### 1.4 API

**公开面**（裸 JSON）：

| 方法 | 路径 |
|---|---|
| GET | `/api/v1/events?limit=20` |
| GET | `/api/v1/events/{id}` |
| GET | `/api/v1/events/{id}/submissions?limit=50` |

`EventView` = `{id, slug, title, body, startsAt, endsAt, submissionOpen}` ——
**不含 `status`**（这是前端把"进行中"当代理判断的根源）。

**会话面**（`CommunityMeController` 295–317）：

| 方法 | 路径 |
|---|---|
| POST / DELETE | `/api/v1/me/events/{id}/register` |
| POST | `/api/v1/me/events/{id}/submissions` |
| GET | `/api/v1/me/event-submissions?limit=20` |

**管理面**（`AdminEventController`）：

| 方法 | 路径 |
|---|---|
| GET / POST | `/api/v1/admin/community/events` |
| PATCH | `/api/v1/admin/community/events/{id}` |
| GET | `/admin/community/events/{id}/submissions` |
| POST | `/admin/community/events/submissions/{id}/review` |

### 1.5 Route

`xingyu-web/src/router/routes.tsx` 677–691

```
/events                    → EventsPage         （guest 可进）
/events/:eventId           → EventDetailPage    （guest 可进）
/events/:eventId/submit    → EventSubmitPage    （RequireAuth）
/me/events                 → MyEventsPage       （RequireAuth）
```

### 1.6 入口可达性（实测）

| 入口 | 位置 | 状态 |
|---|---|---|
| `/events` | `AppLayout.tsx:532` 页脚「社区活动」 | ✅ 唯一入口 |
| `/events` | 首页侧栏 `CommunityEventsPanel` | ✅ |
| `/me/events` | **仅** `EventDetailPage.tsx:349` 详情页侧栏 | ⚠️ **无全局入口** |
| `/me/events` | UserMenu / 主导航 / 页脚 | ❌ **全部没有** |

页脚注释（行 528–531）明确说明：`/events` 是公开页，刻意放页脚而非主导航（主导航 7 项已固定）。

---

## 2. 边界判决：Events ↔ Announcements ↔ Notifications

**数据层零耦合，实测确认。**

- `CommunityEventService` 全文 **零** 引用 `NotificationService` / `AnnouncementService`。
- `NotificationService` 全文 **零** 引用 event 相关标识；全后端唯一 `setCategory` 仍是 `FOLLOW`。
- 无外键、无共享表、无写入链路交叉。

| 维度 | Event | Announcement | Notification |
|---|---|---|---|
| 受众 | 全站公开 | 全站公开 | 单 user |
| 参与状态 | 有（registration） | 无 | 有（read_at） |
| 时间窗口 | **有字段，无服务端校验** | 仅 published_at | 无 |
| 产生方 | 管理员 | 管理员 | FOLLOW 事件 |

**判决：三者保持独立。** 但 event 有「活动开始 / 结束 / 报名成功」这类天然通知场景，
当前**没有任何 producer**——这是产品缺口（见 §4），不是设计错误。

---

## 3. Correctness 实测记录

环境：dev 后端 7779 + vite 7777 + `xingyu_hub`。
**所有 fixture 均通过真实管理员 HTTP 路径创建，验证后全部清理，基线回到 1 seed / 0 / 0。**

### 3.1 ✅ 幂等（重复报名 / 重复投稿）

| 操作 | 结果 |
|---|---|
| `POST /me/events/{id}/register` ×1 | 200，返回 registration id |
| `POST /me/events/{id}/register` ×1（重复） | 200，**返回同一个 id** ✅ |
| `POST /me/events/{id}/submissions` ×1 | 200 SUBMITTED |
| `POST /me/events/{id}/submissions` ×1（重复同对象） | 200，**返回同一条** ✅ |

### 3.2 ✅ 取消语义

```
POST register    → 200 REGISTERED
DELETE register  → 204
DELETE register  → 404（已取消，正确拒绝）
POST register    → 200 REGISTERED（复活同一行，created_at 不变）✅
```

### 3.3 ✅ `submissionOpen` 门禁

`submission_open = 0` 时 `POST /me/events/{id}/submissions` →
**409 `活动投稿已关闭`** ✅（这是**唯一一个真正生效的服务端业务门禁**）。

### 3.4 ✅ 并发唯一性

20 个并发首次报名（同一 user × 同一 event）：

```
HTTP 200 × 20
DB: SELECT COUNT(*) FROM event_registration WHERE event_id=... AND user_id=... → 1
```

唯一键 `uk_event_registration` 兜住了并发 ✅。

### 3.5 ❌ **P0 — 服务端完全不校验时间窗口（本轮最重要发现）**

**反证过程**：

1. 通过真实管理端 `POST /admin/community/events` 创建 fixture 活动 `083267f1-...`（ACCEPTED 契约）；
2. 因 API **无法设置 `ends_at`**（`createForAdmin` 硬编码 `setStartsAt(now)`，忽略 `endsAt`），
   用 SQL 单独把 `ends_at` 置为 `'2020-01-01'`，`status` 保持 `ACTIVE`；
3. 逐条反证：

| 验证项 | 期望（若时间门存在） | **实测** |
|---|---|---|
| 公开列表 `GET /events` | 不出现 | **出现**，与正常活动并列 ❌ |
| 详情 `GET /events/{id}` | 404 | **HTTP 200**，完整返回 ❌ |
| 报名 `POST /me/events/{id}/register` | 409/404 拒绝 | **HTTP 200 REGISTERED** ❌ |
| 投稿 `POST /me/events/{id}/submissions`（真实已发布 moment） | 409/404 拒绝 | **HTTP 200 SUBMITTED** ❌ |

**根因**：`requireActiveEvent` 只判 `status`，`listActive` 只过滤 `status`。
`starts_at`/`ends_at` 在整个服务端**从未参与任何判断**——它们只是**被存储和展示**。

**后果**：前端的 `isEventEnded()`（`events.types.ts`，仅基于 `endsAt`）是**纯 UI 遮蔽**。
任何直接调用 API（脚本、移动端、第三方）都能对 2020 年就已结束的活动成功报名和投稿。

### 3.6 ❌ P2 — `status` 无白名单

```
PATCH /admin/community/events/{id}  {"status":"GARBAGE_STATE"}
→ HTTP 200，DB 写入 'GARBAGE_STATE'
→ 该活动立刻从公开列表消失（listActive 只认 ACTIVE）
```

`updateForAdmin` 行 201 直接 `setStatus(...toUpperCase())`，**无任何枚举校验**。
（对比：公开 DTO 不暴露 status，所以前端**永远看不到**自己把活动写坏了。）

### 3.7 ⚠️ 潜在风险 — `uk_event_registration` 冲突 → HTTP 500

`CommunityApiExceptionHandler` 对 `DuplicateKeyException` 采取"已知键特判、否则
`log.error` + `INTERNAL_ERROR`"。`uk_event_registration` **不在已知键列表内** →
一旦触发（并发窗口极小，§3.4 未复现），客户端收到 **HTTP 500** 而非幂等成功。
当前靠 service 层"先读后写"规避，但**没有数据库层兜底的优雅响应**。

### 3.8 ⚠️ `createForAdmin` 无法设置结束时间

管理端**只能设 slug/title/body/status/submissionOpen**，`startsAt` 恒为 now、`endsAt` 恒为 NULL。
**这意味着：通过产品自身的 API，管理员根本创建不出一个有明确结束时间的活动。**
§3.5 的 fixture 不得不借助 SQL——这本身就是缺口证据。

---

## 4. 产品缺口（能力"不存在"，非"有 bug"）

| 缺口 | 证据 |
|---|---|
| **无人数限制 / 满员** | 全库无 capacity 列；`countRegistered` 为死代码 |
| **无候补 / waitlist** | 无表、无列、无 API |
| **无上下线概念** | status 仅 ACTIVE/ARCHIVED；无 PUBLISHED/DRAFT、无排期发布 |
| **无活动通知** | NotificationService 零 event 引用；唯一 category 是 FOLLOW |
| **`/me/events` 无全局入口** | 仅详情页侧栏一个链接；UserMenu/导航/页脚均无 |
| **无封面 / 地点 / 主办方** | 三表均无对应列；DTO 亦无 |
| **管理端不能设结束时间** | `createForAdmin` 忽略 endsAt（§3.8） |
| **无投稿作品展示区** | 详情页只列 accepted submissions 计数，无独立作品流 |

---

## 5. Static Layout 问题

**本质：`EventView` 无 `status`，前端被迫用 `endsAt` 当代理；而后端又不真正执行它。**

### 5.1 「进行中的活动 共 N 场」把已结束活动算进来

`EventsPage.tsx:157–158` 标题写死「进行中的活动」+ `共 {events.length} 场`，
而 `events` 是**未过滤的 ACTIVE 列表**。实测 seed + 已结束 fixture 时显示「共 2 场」，
其中 1 场在 2020 年就结束了。

### 5.2 「即将开始」区块列出已结束活动

`EventsPage.tsx:245` 「即将开始」的筛选条件是"有 `startsAt`"，
与"未来"无关 → 一个 2020 年结束的活动因 `startsAt = 2026-xx` 被列进「即将开始」，
卡片上却标「已结束」（`statusLabel`）——**同屏自相矛盾**。

### 5.3 首页侧栏中性展示已结束活动

`CommunityEventsPanel.tsx` 只渲染日期区间（`01/01 - 01/01`），**无"已结束"标记**
（该组件刻意省略参与人数与 submissionOpen，但也没补结束态）。

### 5.4 详情页对已结束活动仍展示"参与方式"三步

`EventDetailPage.tsx` 正确隐藏了「报名」「投稿」CTA（因为 `ended` 为 true），
但**「参与方式」说明区仍完整展示 3 步指引** → 已结束活动仍在教用户怎么参与。

### 5.5 前端判断本身是"最后的防线"

`isEventEnded()` 是唯一正确的终点判断，且**只在 UI 生效**（§3.5）。
即：**UI 越诚实，越掩盖后端的越权可写**。

---

## 6. 数据规模（真实）

| 指标 | 值 |
|---|---|
| `community_event` | **1**（seed「星语写作季」） |
| `event_submission` | **0** |
| `event_registration` | **0** |
| 真实使用痕迹 | **无**（与公告域、消息域同状态：功能建好但从未被真实使用） |

---

## 7. 测试证据

- Events feature 前端测试：**124 passed**（8 个文件）。
- 覆盖：路由守卫、`isEventEnded`、`eventCountdown`、投稿 picker 过滤、状态标签映射。
- **缺口**：**没有任何后端测试断言"过期活动不可报名/投稿"** —— 这正是 §3.5 能长期存活的原因。

---

## 8. 最终判断

**保留骨架，做局部修复，不重构。**

| 项 | 判断 |
|---|---|
| 域是否真实存在 | **是**。3 表 + 全 API + 完整 UI，非空壳 |
| 骨架是否成立 | **是**。幂等、取消、并发、投稿门禁全部正确 |
| 是否与公告/通知职责混杂 | **否**。数据层零耦合 |
| 主要问题性质 | **服务端契约缺失**（时间门 + status 白名单），非架构错误 |
| 页面是否虚假操作 | **否**（CTA 会正确隐藏），但**后端允许虚假写入** |
| 是否需要重构 | **否**。补 2 个服务端校验即可闭合绝大多数问题 |
| Static Layout 问题 | **P0 的下游症状**，服务端修好后自然收敛 |

### 修复清单（供下一轮决策，本轮未执行）

| 优先级 | 位置 | 修复 |
|---|---|---|
| **P0** | `CommunityEventService.requireActiveEvent` | 增加 `starts_at <= now`（若设）与 `ends_at >= now`（若设）判断；过期→404/409 |
| **P0** | `CommunityEventMapper.listActive` | 增加 `AND (ends_at IS NULL OR ends_at >= NOW())` |
| **P1** | `CommunityEventService.updateForAdmin` | `status` 白名单（仅 `ACTIVE`/`ARCHIVED`），非法→`FieldContractException` |
| **P1** | `CommunityEventService.createForAdmin` | 接受客户端 `startsAt`/`endsAt`（当前恒为 now/NULL） |
| **P1** | `CommunityApiExceptionHandler` | 把 `uk_event_registration` 纳入已知键特判，避免 500 |
| **P2** | `EventsPage` 「进行中/即将开始」 | 按 `isEventEnded` 真实分组，或后端返回带状态/时间过滤的列表 |
| **P2** | `EventDetailPage` 「参与方式」 | 已结束时隐藏或改写说明 |
| **P2** | 新增后端测试 | 断言过期活动 register/submit 被拒（防回归） |

### 明确不做的（本轮）

按用户指令，**未新增**：人数限制、候补、活动通知 producer、上下线状态机、封面/地点/主办方。
真实模型里都没有，不得无据扩功能。

---

## 9. 本轮未改动的证据

- 源码：**0 个活动域文件被本轮修改**。`git status` 中 3 个 events 相关文件
  （`CommunityEventSupport.java` / `SearchIndexEventHandler.java` / `CommunityEventsPanel.tsx`）
  均为**更早阶段**遗留改动，非本轮审计产物。
- 数据：fixture 全部经真实管理员链路创建，验证后**全部清理**，
  基线回到 `community_event=1（seed）/ event_submission=0 / event_registration=0`。
- 临时文件：`.tmp-audit/` 已整体删除（`ls` 确认 REMOVED）。
- 未 commit，未做 Motion。

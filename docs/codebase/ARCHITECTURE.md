# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: **Layered Maven backend** (`api → core → infra → common`) plus **feature-folder frontends**. Async side effects use a **DB-backed reliable event poller**, not an external message broker.
- Why this classification: parent POMs encode layers; community services sit in `xingyu-community` with MyBatis mappers; `ReliableEventConsumer` polls `ReliableEventMapper`.
- Primary constraints:
  1. Dual HTTP contracts: admin `Result<T>` vs community `ProblemDetails` / mixed unwrapped bodies.
  2. Dual auth: Sa-Token (admin/app) vs MySQL `CommunitySession` + `satoken` header (community web).
  3. Schema changes are file-versioned SQL; runtime migrator is off in packaged profiles; local rebuild is `sql/rebuild.ps1`.

### 2) System Flow

```text
Browser/Admin/Uni-app
  -> Vite proxy or BASE_URL
  -> Spring Boot :7779
  -> ApiPrefixConfig (/api/v1 or /api/v1/admin)
  -> Auth interceptor (Sa-Token or CommunityAuthInterceptor)
  -> Controller
  -> Core *Service
  -> MyBatis-Plus Mapper / MySQL
  -> optional Redis, OSS, WS push, reliable_event row
  -> Result JSON | ProblemDetails | raw DTO
```

1. Clients call `/api/v1/...` (web-next `src/api/client.ts` uses `fetch` + `satoken` header) or `/api/v1/admin/...` (admin axios `baseURL`).
2. `ApiPrefixConfig` maps `top.pxczxn.xingyu.admin.*` → `/api/v1/admin` and `web`/`api` packages → `/api/v1`.
3. Admin paths use `SaInterceptor` + `StpUtil.checkLogin()` (`SaTokenConfig.java`). Community paths use `CommunityAuthInterceptor` → `CommunityAccountService.requireActiveSession()` (session table).
4. Controllers call core services (e.g. `CommunityMessageController` → `ConversationService` → `ConversationMapper`).
5. After commits, platform can enqueue reliable events; `ReliableEventConsumer` claims batches every `xingyu.event.consumer.delay-ms` (default 5000 ms).
6. Realtime chat uses `/ws/community/chat` with community session handshake, not Sa-Token.

### 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| `xingyu-starter` | Process entry, prefix mapping, IT suite | Long-term home for all controllers | `XingyuHubApplication.java`; `ApiPrefixConfig.java` |
| `xingyu-admin-api` | Admin REST + some WS handlers | Community session semantics | `AdminCommunityUserController.java`; `WebSocketConfig.java` |
| `xingyu-community-api` | Community REST + auth interceptor | Sa-Token login for community users | `CommunityAuthController.java`; `CommunityWebConfig.java` |
| `xingyu-community` (core) | Articles, series, galaxies, IM domain, sessions | Generic RBAC menus | `community/service`, `entity`, `mapper` |
| `xingyu-system` | Admin users/config/monitor, Sa-Token wiring | Community content domain | `SaTokenConfig.java` |
| `xingyu-platform` | Bootstrap, reliable events, core security pieces | HTTP mapping | `ReliableEventConsumer.java` |
| `xingyu-db` | Druid/MyBatis infra, `SchemaMigrator` | Business rules | `SchemaMigrator.java` |
| `xingyu-job` | Quartz catalog | Community publish scheduler (that is `@Scheduled` in community) | `SysJobController.java`; `ScheduledArticlePublishTask.java` |
| `xingyu-web` | Current user UI (partial vs product map) | Admin RBAC screens | `src/router/routes.tsx` |
| `xingyu-web` | Legacy full page map | New V2-only routes | `app/**/page.tsx` |
| `xingyu-admin` | Ops UI | Community ProblemDetails client | `src/utils/request.ts` |
| `xingyu-uniapp` | Mini-program chat/profile against `/api/v1/app` and **admin chat** paths | Full community product surface | `utils/api.js`; `pages.json` |

### 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Layered Maven modules | `../../xingyu-server/pom.xml` | Separate API/core/infra |
| Mapper/Service/Controller | community + admin packages | Spring + MyBatis-Plus default |
| Strategy (login) | `xingyu-auth/.../strategy` | Password/SMS/miniprogram/social |
| Factory (SMS/Pay/Push/OSS) | `SmsServiceFactory`, `PayServiceFactory`, `FileStorage` impls | Pluggable vendors |
| Interceptor auth | `SaTokenConfig`, `CommunityAuthInterceptor`, `CommunityOpenApiInterceptor` | Different principals |
| Envelope `Result<T>` | Admin + `GlobalExceptionHandler` | Admin SPA contract (`code` 200) |
| RFC9457-style `ProblemDetails` | `CommunityApiExceptionHandler`; web-next `client.ts` | Community contract |
| Outbox-like poller | `ReliableEventConsumer` + `sql/V002__reliable_event.sql` | Retryable side effects without Kafka |
| Custom schema ledger | `SchemaMigrator` + `schema_migration` table | Checksummed `V###` files, not Flyway |

### 5) Known Architectural Risks

- **Two user webs** (`xingyu-web` vs `xingyu-web`) can diverge from the v3.2 route registry; V2 comments state missing nav (messages/notifications) and no public series reader.
- **Two auth systems** sharing the header name `satoken` (community sessions in MySQL; admin tokens via Sa-Token/Redis) increases mis-wiring risk (`V027` comment in `sql/README.md`).
- **Redis is wired as a first-class dependency** (`sa-token-redis-jackson`, captcha/repeat-submit) with no optional disable found; Redis outage behavior at startup is **[TODO]**.
- **Uni-app still titles “Mars办公”** and calls `/api/v1/admin/sys/chat/*`, leftover of the generic admin template (`pages.json`; `V019` dropped Mars demo tables).
- **Schema migrator default vs profiles**: `SchemaMigrator` is `@ConditionalOnProperty(..., matchIfMissing = true)` but YAML sets `enabled: false` for dev/prod/test — accidental property omission in a custom profile would auto-migrate.

### 6) Evidence

- `../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/XingyuHubApplication.java`
- `../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/api/ApiPrefixConfig.java`
- `../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java`
- `../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/interceptor/CommunityAuthInterceptor.java`
- `../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventConsumer.java`
- `../../xingyu-server/xingyu-infra/xingyu-db/src/main/java/top/pxczxn/xingyu/infra/schema/SchemaMigrator.java`
- `../../xingyu-web/src/api/client.ts`

## Extended Sections (Optional)

### Auth matrix

| Client | Login endpoint (canonical) | Session store | Guard |
|--------|----------------------------|---------------|-------|
| Admin SPA | `POST /api/v1/admin/auth/login` | Sa-Token (+ Redis jackson on classpath) | `SaInterceptor` |
| Community web | `POST /api/v1/auth/login` | `community` session mapper / MySQL | `CommunityAuthInterceptor` |
| App (starter) | `/api/v1/app/auth/*` | Sa-Token | `SaTokenConfig` include `/api/v1/app/**` |
| Open API | `/api/v1/open/**` | token interceptor (not StpUtil) | `CommunityOpenApiInterceptor` |

### Sync vs async

- In-request: HTTP + MyBatis.
- Scheduled: article publish (60s), access-log flush (30s), event consumer (5s default).
- Push: WebSocket handlers under `xingyu-admin-api` websocket package.

### Intent vs code (product)

Product master (`doc/星语社区-产品功能与开发总文档-v3.2-品牌文案整合基线.md`) defines a full community (galaxies, public series, governance). **Web V2 implements a subset** of routes; **Legacy `xingyu-web` still holds the larger page map**. Spec says code must not silently become the product source of truth.

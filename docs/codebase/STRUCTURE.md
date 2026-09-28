# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| `xingyu-backend/` | Maven multi-module Spring Boot API + jobs | `xingyu-backend/pom.xml` |
| `xingyu-web-next/` | User-facing **Web V2** (Vite + React Router) | `xingyu-web-next/vite.config.ts`; `src/app/App.tsx` |
| `xingyu-web/` | **ARCHIVED** — Legacy user web, moved to `archive/xingyu-web-legacy/` on 2026-09-28 (Vite SPA with Next-style `app/**/page.tsx` shims). Not built, not tested, not maintained. See `archive/README.md`. | `archive/README.md`; `archive/xingyu-web-legacy/src/main.tsx` |
| `xingyu-admin/` | Vue 3 admin console | `xingyu-admin/README.md` |
| `xingyu-uniapp/` | Uni-app mini-program (chat/profile oriented) | `xingyu-uniapp/README.md`; `pages.json` |
| `sql/` | Versioned `V###__*.sql` migrations (V000–V041) | `sql/README.md` |
| `doc/` | Product specs (v3.2 master, API docs, naming) | `doc/星语社区-产品功能与开发总文档-v3.2-品牌文案整合基线.md` |
| `docs/` | Design system + this codebase knowledge set | `docs/design-system/MASTER.md`; `docs/codebase/` |
| `scripts/` | CI-style migration apply, seeds, inventories | `scripts/ci-apply-migrations.sh` |
| `maintenance/` | Schema ledger reconciliation (not migrations) | `maintenance/reconciliation/README.md` |
| `uploads/` | Runtime uploaded files (large binaries) | scan largest files |
| `tools/`, `ui+layout/` | [TODO] purpose not documented in README | directory listing |
| `.run/` | IntelliJ run config for `XingyuHubApplication` | `.run/XingyuHubApplication.run.xml` |
| `.plan/`, `.workbuddy*`, `.playwright-mcp/` | Local AI/plan/MCP dumps | directory listing; `.gitignore` |

### 2) Entry Points

- Main runtime entry: `xingyu-backend/xingyu-starter/src/main/java/top/pxczxn/xingyu/XingyuHubApplication.java` (`@SpringBootApplication`, `@EnableScheduling`)
- Secondary:
  - Quartz jobs via `xingyu-job` + admin `/api/v1/admin/monitor/job`
  - Spring `@Scheduled` tasks (`ScheduledArticlePublishTask`, `ApiAccessLogFlushTask`, `ReliableEventConsumer`)
  - WebSocket: `/ws/message`, `/ws/ssh`, `/ws/community/chat` (`WebSocketConfig.java`)
- Frontend entries:
  - `xingyu-web-next/index.html` → `src/main.tsx`
  - `archive/xingyu-web-legacy/index.html` → `src/main.tsx` (ARCHIVED — not served)
  - `xingyu-admin/index.html` → `src/main.ts`
  - `xingyu-uniapp/main.js` (`package.json` `"main"`)
- How entry is selected: Maven `start-class` in `xingyu-starter/pom.xml`; Vite `index.html`; Spring `spring.profiles.active` in `application.yml`

### 3) Module Boundaries

Backend Maven layers (parent modules in `xingyu-backend/pom.xml`):

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| `xingyu-common` | Result, exceptions, contracts (`ErrorCode`, `ProblemDetails`), shared utils | HTTP controllers, DB mappers of a domain |
| `xingyu-infra` | DB/schema migrator, Redis deps, OSS, WS container, SMS/mail/pay/wechat/social/crypto/push | Community/admin HTTP APIs |
| `xingyu-core` | Domain services: `system`, `file`, `gen`, `auth`, `community`, `platform` | [ASK USER] whether `xingyu-platform` vs `xingyu-community` split is the intended long-term domain cut |
| `xingyu-api` | `xingyu-admin-api` controllers; `xingyu-community-api` (`top.pxczxn.xingyu.web.*`) | Persistence implementations (those live in core mappers) |
| `xingyu-job` | Quartz job entities/services/sample tasks | Community HTTP |
| `xingyu-starter` | Boot class, `ApiPrefixConfig`, some app auth controllers, integration tests | [observed] a few controllers live here (`AppAuthController`, `LegacyAuthCompatController`) rather than `xingyu-api` |

Frontend:

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| `xingyu-web-next/src/features/*` | Page-level product features | Shared fetch transport (`src/api/client.ts`) |
| `xingyu-web-next/src/api/*` | Domain HTTP modules | UI components |
| `archive/xingyu-web-legacy/app/**/page.tsx` | ARCHIVED Legacy route pages (read-only history) | V2 React Router (`xingyu-web-next`) |
| `xingyu-admin/src/views` + `src/api` | Admin screens and `/api/v1/admin` clients | Community ProblemDetails client |

### 4) Naming and Organization Rules

- **Java packages**: reverse-DNS `top.pxczxn.xingyu.<layer>.<area>`; admin HTTP under `admin.controller.*`; community HTTP under `web.controller.*`
- **SQL**: `V###__snake_description.sql` in `sql/`
- **Web V2 files**: PascalCase pages (`SeriesListPage.tsx`); kebab-case helpers (`series-slug.ts`); colocated `*.test.ts(x)`
- **Legacy web** (archived): Next App Router filenames (`page.tsx`) under `app/`
- **Admin**: Vue `index.vue` under `src/views/<domain>/`
- **Import aliases**: Web V2 `@/*` → `./src/*` (`xingyu-web-next/tsconfig.json`); Legacy `@/*` → project root (`archive/xingyu-web-legacy/tsconfig.json`)
- **API prefix**: `/api/v1` for community + starter; `/api/v1/admin` for admin (`ApiPrefixConfig.java`)

### 5) Evidence

- `xingyu-backend/pom.xml` and nested `*/pom.xml`
- `XingyuHubApplication.java`
- `xingyu-web-next/src/router/routes.tsx`
- `xingyu-admin/src/main.ts`
- `sql/README.md`
- `doc/星语社区-产品功能与开发总文档-v3.2-品牌文案整合基线.md`

## Extended Sections (Optional)

### Backend module tree (Maven)

```text
xingyu-backend
  xingyu-common
  xingyu-infra
    xingyu-db, xingyu-redis, xingyu-oss, xingyu-websocket
    xingyu-sms, xingyu-push, xingyu-pay, xingyu-wechat
    xingyu-social, xingyu-crypto, xingyu-mail
  xingyu-core
    xingyu-system, xingyu-file, xingyu-gen, xingyu-auth
    xingyu-community, xingyu-platform
  xingyu-api
    xingyu-admin-api, xingyu-community-api
  xingyu-job
  xingyu-starter
```

### Web V2 feature folders

`announcements`, `article`, `auth`, `blocks`, `bookshelf`, `collections`, `discover`, `guide`, `home`, `moments`, `onboarding`, `profile`, `rules`, `series`, `settings`, `studio`, `topics` — under `xingyu-web-next/src/features/`.

### Community API controllers (27)

Examples: `CommunityAuthController`, `CommunityArticleController`, `CommunitySeriesController`, `CommunityGalaxyController`, `CommunityMessageController`, `CommunityOpenApiController`, … under `xingyu-community-api/.../web/controller/`.

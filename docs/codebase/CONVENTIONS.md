# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| Java types | PascalCase | `CommunityArticleController` | `xingyu-community-api/.../CommunityArticleController.java` |
| Java methods | camelCase | `listConversations` | `CommunityMessageController.java` |
| Java packages | `top.pxczxn.xingyu.<module>...` | `top.pxczxn.xingyu.community.service` | core community tree |
| SQL files | `V###__snake_case.sql` | `V041__align_dev_schema_baseline.sql` | `sql/` |
| Web V2 pages | PascalCase `*Page.tsx` | `SeriesListPage.tsx` | `src/features/series/pages/` |
| Web V2 tests | colocated `*.test.ts(x)` | `series-list-page.test.tsx` | same feature folder |
| Admin views | `src/views/<domain>/index.vue` | `src/views/community/users/index.vue` | admin tree |
| Env vars | `SCREAMING_SNAKE` | `DB_PASSWORD`, `VITE_API_BASE_URL` | YAML and `.env.example` |
| Token header | `satoken` (community + Sa-Token) | header name in interceptor and `client.ts` | `CommunityAuthInterceptor.java`; `src/api/client.ts` |

Private Java fields: Lombok `@Data` / `@RequiredArgsConstructor` is common; no `_` prefix convention observed in sampled services.

### 2) Formatting and Linting

- Formatter: **[TODO]** — no `.prettierrc`, Spotless, or EditorConfig found.
- Linter: **[TODO]** — no ESLint config; no Checkstyle/SpotBugs plugins in POMs.
- TypeScript (Web V2): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` (`xingyu-web-next/tsconfig.json`).
- Java encoding: UTF-8 (`xingyu-backend/pom.xml` `project.build.sourceEncoding`).
- Run commands: `npm run typecheck` (web-next); backend compile via Maven. No `lint` script.

### 3) Import and Module Conventions

- Web V2: alias `@/` → `src/`; domain APIs under `src/api/<domain>/`; transport-only in `src/api/client.ts` (file header comment).
- Legacy web: alias `@/` → repo root of `xingyu-web` (includes `app/`, `components/`, `lib/`).
- Java: package-by-layer; community HTTP package is `web` not `community.api`.
- Barrel exports: **[TODO]** not uniformly required; features import concrete files.

### 4) Error and Logging Conventions

- **Admin HTTP**: return `Result<T>` (`code` 200 success). Uncaught errors: `GlobalExceptionHandler` scoped to `admin`, `system`, `auth`, `file`, `gen`, `job` packages — `BusinessException` + integer codes.
- **Community HTTP**: `CommunityApiExceptionHandler` maps `ContractException` / `FieldContractException` to `ProblemDetails`. Some endpoints return raw lists/DTOs (e.g. conversation list) and may throw `ResponseStatusException`.
- **Web V2 client**: parses `ProblemDetails` into `ApiError`; 401 clears stored token (`client.ts`).
- **Logging**: SLF4J via `@Slf4j` in services; YAML sets `logging.level.top.pxczxn.xingyu` (`debug` in dev, `info` in prod). No `logback-spring.xml` found — Spring Boot default Logback assumed, layout **[TODO]**.
- **Sensitive data**: passwords must come from env placeholders (`__SET_DB_PASSWORD__`). RSA private key still stored in `sys_config_group` JSON with `TODO(P2)` to move it (`SysConfigGroupController.java`). Redaction rules beyond that are **[TODO]**.

### 5) Testing Conventions

- Backend: `*Test.java`; integration tests in `xingyu-starter` with `@SpringBootTest` + `@ActiveProfiles("test")` + `TestDatabaseGuard` (must hit `xingyu_hub_test`). Surefire `reuseForks=false` because Sa-Token JVM static state.
- Web V2: `src/**/*.{test,spec}.{ts,tsx}`, Vitest `globals`, jsdom, `vitest.setup.ts`. **No `@vitejs/plugin-react` in vitest config** (comment: Vite 8 / Vitest 3 incompatibility).
- Admin: `tests/*.mjs` via `node --test`.
- Uni-app: **0** test files found.
- Coverage threshold: **[TODO]** — no Jacoco/nyc/vitest coverage config found.

### 6) Evidence

- `xingyu-web-next/tsconfig.json`
- `xingyu-web-next/vitest.config.ts`
- `xingyu-web-next/src/api/client.ts`
- `xingyu-backend/xingyu-common/src/main/java/top/pxczxn/xingyu/common/result/Result.java`
- `xingyu-backend/xingyu-common/src/main/java/top/pxczxn/xingyu/common/exception/GlobalExceptionHandler.java`
- `xingyu-backend/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/advice/CommunityApiExceptionHandler.java`
- `xingyu-backend/xingyu-starter/pom.xml` (Surefire)
- `xingyu-admin/package.json`

## Extended Sections (Optional)

### Product/doc conventions (intent)

The v3.2 product doc forbids inventing domain terms, merging distinct statuses, and changing English identifiers when rewriting copy (`doc/星语社区-产品功能与开发总文档-v3.2-品牌文案整合基线.md` §0.3–0.4, §76). These are **product rules**, not compiler-enforced.

### Dual UI copy vs routes

Design system nav (首页 / 发现 / 话题 / 系列 / 星系 / 指南) is documented in `docs/design-system/MASTER.md`. Web V2 `AppLayout.tsx` currently uses 首页 / 发现 / 话题 / 动态 — treat as an implementation gap, not a naming standard.

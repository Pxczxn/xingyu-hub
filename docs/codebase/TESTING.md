# Testing Patterns

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test frameworks:
  - Backend: Spring Boot Test (`spring-boot-starter-test` on `xingyu-starter`) + JUnit (via Boot)
  - User web: Vitest ^3.0.5 + Testing Library + jsdom
  - Admin: Node.js built-in test runner
- Assertion/mocking: JUnit/AssertJ/Mockito via Boot starter (exact assertion style **[TODO]** per class); Vitest `expect`; Testing Library queries.
- Commands:

```bash
# Backend (from xingyu-backend); needs MySQL xingyu_hub_test + Redis per application-test.yml
mvn -pl xingyu-starter -am test

# Web V2
cd xingyu-web-next && npm test          # vitest run
cd xingyu-web-next && npm run test:watch

# Legacy web — ARCHIVED 2026-09-28; not built, not tested. Kept out on purpose.
# (was: cd xingyu-web && npm test)

# Admin audit tests (not full UI suite)
cd xingyu-admin && npm run test:audit
```

- Coverage command: **[TODO]** not defined in sampled scripts.
- E2E: **no `playwright.config.*`**. `.playwright-mcp/` contains MCP page dumps, not a CI suite.

### 2) Test Layout

- Backend unit: colocated under module `src/test/java` (`xingyu-common`, `xingyu-platform`, `xingyu-system`, `xingyu-db`, `xingyu-crypto`).
- Backend integration: `xingyu-starter/src/test/java/top/pxczxn/xingyu/` (`*IntegrationTest.java`, `ChatWebSocketIntegrationTest.java`, etc.).
- Web V2: colocated `src/**/*.{test,spec}.{ts,tsx}` (`vitest.config.ts` `include`).
- Legacy web: `*.{test,spec}.{ts,tsx}` (20 files; default Vitest include).
- Admin: `xingyu-admin/tests/*.mjs`.
- Setup: `../../xingyu-web/vitest.setup.ts`; backend `application-test.yml` + `TestDatabaseGuard.java`.
- DB rebuild for tests: `sql/rebuild-test-db.sh` (referenced by test YAML comments / `sql/README.md`).

### 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit | yes | contracts, migrator status, crypto, some controllers with Mockito | 12 non-starter `*Test.java` files (scan/explore count) |
| Integration | yes | Auth/article/batch flows, WebSocket | 20 tests under starter; Surefire forks per class |
| Frontend component/router | yes (V2 heavy) | routes, studio, series pages | 81 test files in web-next |
| Admin | partial | data-audit scripts | `test:audit` only |
| Uni-app | no | — | 0 tests |
| E2E browser CI | no | — | no Playwright config; no GitHub Actions |

### 4) Mocking and Isolation Strategy

- Backend IT: real MySQL `xingyu_hub_test` + Redis db 7; fail if wrong database (`TestDatabaseGuard`).
- Sa-Token: JVM static state → Surefire `forkCount=1`, `reuseForks=false`.
- Frontend: Vitest + jsdom; network typically stubbed in feature tests (pattern: colocated `*.test.tsx` next to pages — exact mock helpers **[TODO]** to catalog exhaustively).
- Common failure mode: integration tests fail if local `xingyu_hub_test` / Redis not up, or if connected to `xingyu_hub` (guard). Schema migrator **disabled** on test profile — schema must be applied by rebuild scripts.

### 5) Coverage and Quality Signals

- Coverage tool + threshold: **[TODO]** none found (no Jacoco plugin, no vitest `coverage` block in sampled config).
- Current reported coverage: **[TODO]** not stored in-repo.
- Known gaps:
  - Uni-app untested
  - Admin UI untested (only audit node tests)
  - Product-complete E2E absent
  - Scan listed TODOs in `archive/xingyu-web-legacy/app/page.tsx` (unreadCount / onboarding) as production stubs, not tests
  - High-churn frontend router/tests (`docs/codebase/.codebase-scan.txt` HIGH-CHURN)

### 6) Evidence

- `../../xingyu-server/xingyu-starter/pom.xml` (Surefire)
- `../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml`
- `../../xingyu-server/xingyu-starter/src/test/java/top/pxczxn/xingyu/TestDatabaseGuard.java`
- `../../xingyu-web/vitest.config.ts`
- `../../xingyu-web/package.json`
- `xingyu-admin/package.json`
- `docs/codebase/.codebase-scan.txt`

## Extended Sections (Optional)

### Backend test count (explore)

32 `*Test.java` files: 20 in starter, 6 common, 3 platform, 1 system, 1 db, 1 crypto.

### Product test expectations

v3.2 doc chapters 59–60 describe testing/SLO gates as **product requirements**. Whether CI enforces them is **[ASK USER]** — this git tree has **no `.github/workflows`**.

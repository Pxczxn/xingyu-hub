# Codebase Concerns

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| high | Dual user frontends; V2 is incomplete vs product/design nav | `docs/design-system/MASTER.md`; `xingyu-web-next/src/layouts/AppLayout.tsx`; `routes.tsx` comments (no `/galaxies`) | Users/devs hit the wrong app; features exist in API/Legacy but not V2 | [ASK USER] freeze Legacy vs finish V2 parity. *Progress:* public Series shipped in V2 (Phase 2G, `5cd1421`); `/galaxies` still missing |
| high | Dual auth sharing `satoken` header | `CommunityAuthInterceptor.java`; `SaTokenConfig.java`; `sql/README.md` V027 | Token mix-up between admin Sa-Token and community DB sessions | Keep clients strictly separated; document header+cookie rules |
| high | RSA private key in `sys_config_group` JSON | `SysConfigGroupController.java:284` TODO(P2) | Key compromise via config dump/backup | Move to dedicated secret storage |
| med | Public series leaks unpublished chapters to guests | `SeriesService.syncChapters()` (binds any owned article, incl. `DRAFT`/`PRIVATE`); `listPublic`/`getPublicById` return those chapters; `ArticleService.getPublicArticle()` needs a `published_revision` row → guest 404 on open | A guest sees a chapter in the table of contents and gets a dead 404 for it; creator has no signal they bound an unreadable article | Filter unpublished articles out of the public chapter list (or reject the binding). **Deferred by user (2026-09-27) — frontend degrades gracefully for now, backend untouched** |
| med | Redis treated as required; no optional fallback module | `xingyu-redis/pom.xml`; `RepeatSubmitAspect` (no catch) | Admin login/captcha/repeat-submit can fail hard | [ASK USER] confirm Redis SLO; add fail-open only if intended |
| med | Server SSH passwords storage TODO (unencrypted) | `SysServerServiceImpl.java:96` | Credential leak in DB | Encrypt at rest before production SSH feature use |
| med | Uni-app still Mars/admin-chat oriented | `pages.json` title `Mars办公`; `utils/api.js` `/api/v1/admin/sys/chat` | Wrong product surface; security if mini-program talks to admin APIs | [ASK USER] retire vs rewrite against community APIs |
| med | No in-repo CI; secrets discipline exists in scripts | no `.github/`; `scripts/ci-apply-migrations.sh` | Drift and untested PRs | [ASK USER] where CI lives |
| low | Social Alipay/Apple stubs | `AlipayLogin.java`; `AppleLogin.java` | Dead login types if exposed in UI | Hide until implemented |
| low | Legacy home TODOs (unread/onboarding flags) | `xingyu-web/app/page.tsx` scan TODO lines | Incorrect UX on Legacy home | Wire APIs or drop Legacy home |

### 2) Technical Debt

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Next.js shims without `next` dependency | Incremental migrate from App Router files | `xingyu-web` (`next.config.ts`, `app/**/page.tsx`, Vite aliases) | Tooling confusion (“this is Next”) | Keep documenting as Vite SPA; eventually delete with V2 |
| Admin README port 3000 vs Vite 7778 | Stale README | `xingyu-admin/README.md` vs `vite.config.ts` | Wrong local URL | Update README |
| Parent POM description still “通用管理系统 - RBAC” | Scaffold leftover | `xingyu-backend/pom.xml` | Wrong mental model | Rename description to 星语 |
| `public-base-url` `localhost:3000` | Copy-paste / old port | `application-dev.yml` `xingyu.community.public-base-url` | Wrong absolute links in emails/SEO | Point at actual web origin |
| Schema ledger reconciliation history | Dev applied SQL outside migrator | `maintenance/reconciliation/` (CLOSED) | Repeat if people edit live DB | Stick to `V042+` files + rebuild scripts |
| Design-system UI kit not fully in V2 | V2 started smaller | MASTER.md lists Avatar/Tabs; V2 has 5 `components/ui` files | Inconsistent UI | Port primitives as pages need them |
| No formatter/linter configs | Not introduced | glob | Style drift across 4 JS apps + Java | Add once [ASK USER] chooses tools |

### 3) Security Concerns

| Risk | OWASP category (if applicable) | Evidence | Current mitigation | Gap |
|------|--------------------------------|----------|--------------------|-----|
| Secrets in Git | A02 | YAML placeholders; `.gitignore` `.env` / keys | Fail-fast dummy passwords | Confirm no local-db.env ever committed |
| Config-stored RSA key | A02 | `SysConfigGroupController` TODO | Demo/dev convenience | Dedicated KMS/file |
| SSH password plaintext TODO | A02 | `SysServerServiceImpl` | None in comment | Encrypt |
| Admin default `admin123` after rebuild | A07 | `sql/README.md` | Prod YAML `xingyu.security.allow-default-admin-password` | Ensure prod forbids defaults (`application-prod.yml` keys exist) |
| Druid console in dev | A01/A05 | `application-dev.yml` `/druid/*` | Env credentials; **disabled in prod** | Keep prod disabled |
| Uni-app localhost + admin APIs | A01 | `utils/request.js`; `api.js` | Dev-only URL | Do not ship with admin chat paths |
| Social login stubs | A07 | Alipay/Apple TODO | Incomplete | Do not enable in UI |
| Large multipart 500MB | A04 | `application-*.yml` | Wall filter on Druid | Abuse/DoS sizing [ASK USER] |

### 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| In-process event consumer | `ReliableEventConsumer` single app poll | Fine for one instance | Duplicate consumers / missed leases if multi-instance poorly tuned | Document single-writer or clustering |
| Quartz + `@Scheduled` mixed | `xingyu-job` + community `ScheduledArticlePublishTask` | Two schedulers | Duplicate publishes if multiple nodes | Cluster Quartz; lock scheduled tasks |
| Scan “largest files” are binaries/SQL dumps | `.codebase-scan.txt` | Repo/workspace bloat | Clone cost | Keep dumps gitignored (policy in `.gitignore`) |
| N+1 | **[TODO]** not profiled in this pass | unknown | unknown | Use existing mybatis-batch skill when changing lists |
| Access log via Redis then flush | `ApiAccessLogFlushTask` | extra hop | Redis down drops or errors logs | already logs Redis write failure for push |

### 5) Fragile/High-Churn Areas

From `docs/codebase/.codebase-scan.txt` HIGH-CHURN (last 90 days):

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| `xingyu-web-next/src/router/routes.tsx` | Product surface + redirects | 11 edits | Keep `series-routes.test.tsx` / `routes.test.tsx` green |
| `xingyu-admin/.../community/users` | Admin community user UX | 7 + related API/controller | Pair Vue + `AdminCommunityUserController` + `CommunityUserAdminService` |
| `xingyu-web-next` layout/editor/studio | Editor CSS + workspace | 4–6 | Run web-next vitest; visual check studio |
| `xingyu-web/lib/community-api.ts` + `globals.css` | Legacy still moving | 6 | Avoid duplicating into V2; port once |
| `sql/rebuild-test-db.sh` | Test DB contract | 4 | Don’t change checksums of published `V000–V041` |

### 6) `[ASK USER]` Questions

1. [ASK USER] 用户端是否以 `xingyu-web-next` 为唯一前进方向？`xingyu-web` 是否冻结/只作视觉参考？
2. [ASK USER] `xingyu-uniapp` 是否仍要做成星语社区小程序，还是 Mars 办公/IM 遗留、可归档？
3. [ASK USER] Redis 是生产硬依赖，还是允许无 Redis 降级（与部分内部 “Redis 可选” 政策是否一致）？
4. [ASK USER] 社区 API 是否应全部改为 `ProblemDetails`，禁止未包装 DTO / `ResponseStatusException` 混用？
5. [ASK USER] CI 跑在哪里？本仓库没有 `.github/workflows`，但有 `scripts/ci-apply-migrations.sh`。
6. [ASK USER] 对外站点 origin 是什么？`xingyu.community.public-base-url` 现为 `http://localhost:3000`，与 5173/7777/7778 都不一致。
7. [ASK USER] 开发库 schema 变更只允许 `sql/V042__*.sql` + `rebuild.ps1`，还是某些环境要打开 `xingyu.schema.migration.enabled`？
8. [ASK USER] 代码风格工具（Java Checkstyle/Spotless、前端 ESLint/Prettier）是否要补，还是继续靠 TypeScript `strict` + 人工？

### 7) Evidence

- `docs/codebase/.codebase-scan.txt` (TODO/FIXME, HIGH-CHURN, no root CI/Docker)
- `doc/星语社区-产品功能与开发总文档-v3.2-品牌文案整合基线.md` (intent)
- `sql/README.md`; `maintenance/reconciliation/README.md`
- `SysConfigGroupController.java`; `SysServerServiceImpl.java`; `AlipayLogin.java`; `AppleLogin.java`
- `xingyu-web-next/src/layouts/AppLayout.tsx`; `xingyu-uniapp/pages.json`
- `application-dev.yml`; `application-prod.yml`

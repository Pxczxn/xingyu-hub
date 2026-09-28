# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

| System | Type | Purpose | Auth model | Criticality | Evidence |
|--------|------|---------|------------|-------------|----------|
| MySQL | DB | System of record (`xingyu_hub`) | JDBC user/password via env | high | `application-dev.yml` datasource |
| Redis | Cache / session aid | Sa-Token jackson, captcha/SMS limits, repeat-submit, some community flags | password optional in YAML (empty in sample) | high (wired; optional mode not found) | `xingyu-redis/pom.xml`; `application-dev.yml` |
| Local / MinIO / Aliyun OSS / Tencent COS / RustFS | Object storage | File backends | vendor credentials via config helper | high for uploads | `xingyu-oss` `FileStorage` implementations |
| SMTP | Email | `EmailService` | JavaMail config provider | med | `xingyu-mail` |
| Aliyun / Tencent / Qiniu / Console SMS | SMS | Login and community codes | vendor keys via config | med | `xingyu-sms` |
| WeChat MP / Mini Program | API | Official account + mini program | access token cached in Redis | med | `WechatMpService.java`; `WechatMiniProgramService.java` |
| Alipay / WeChat Pay | Payment | `PayService` implementations | merchant keys from `SystemConfigHelper` `payment` group | med | `AlipayService.java`; `WechatPayService.java` |
| Feishu / WeCom / DingTalk / Webhook / Console | Push | Admin notifications | webhook secrets | low–med | `xingyu-push` |
| Social OAuth | Login strategies | WeChat etc.; **Alipay/Apple are TODO stubs** | OAuth | low until implemented | `xingyu-social/impl/AlipayLogin.java`, `AppleLogin.java` |
| Druid stat servlet | HTTP | SQL monitor UI (dev) | `DRUID_USERNAME` / `DRUID_PASSWORD` | low | `application-dev.yml`; disabled in prod |
| Open API | HTTP | `/api/v1/open/**` | dedicated interceptor + tokens (`V031`) | med | `CommunityOpenApiInterceptor`; `sql/V031__p2_growth.sql` |

No Kafka/RabbitMQ/SQS client modules found. Reliable events are **MySQL rows** consumed in-process.

No Docker, Prometheus, OpenTelemetry, or APM config files found.

### 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| MySQL `xingyu_hub` | Business + `schema_migration` ledger | MyBatis-Plus mappers; Druid | Credentials must be env-injected; test guard requires `xingyu_hub_test` | YAML; `TestDatabaseGuard.java` |
| Redis db 6 (dev) / 7 (test) | Cache, rate limit, Sa-Token | `RedisTemplate` / Sa-Token redis | Repeat-submit aspect has no try/catch around Redis | `RepeatSubmitAspect.java`; `ApiAccessLogServiceImpl` logs Redis write failures |
| Filesystem `uploads/` | Local storage adapter | `LocalFileStorage` | Large binaries in workspace (scan) | `LocalFileStorage.java`; scan largest files |
| `schema_migration` | Applied SQL checksums | `SchemaMigrator` | Dev vs fresh ledger drift historically required `RECONCILED` rows | `maintenance/reconciliation/README.md` |

### 3) Secrets and Credentials Handling

- Credential sources: environment variables (`DB_*`, `DRUID_*`); runtime `sys_config_group` JSON via `SystemConfigHelper` for payment/SMS/etc.; gitignore for `.env`, `application-local.yml`, keys, `scripts/local-db.env`.
- Hardcoding checks: JDBC passwords use invalid placeholders, not real secrets, in committed YAML. Uni-app **hardcodes** `BASE_URL = 'http://localhost:7779'` (`utils/request.js`). RSA private key in config JSON is an acknowledged TODO.
- Rotation: **[TODO]** no Secrets Manager / Vault integration found.
- Rebuild docs mention default admin `admin / admin123` after `sql/rebuild.ps1` (`sql/README.md`) — local-only bootstrap, not a production secret store.

### 4) Reliability and Failure Behavior

- Retry/backoff: `ReliableEventConsumer` claims with lease (`LEASE_SECONDS = 30`) and handler `ConsumeDecision` — in-app retry of events. Vendor HTTP retry policies **[TODO]** per SMS/OSS client.
- Timeout: Druid `max-wait: 60000`; Redis Lettuce pool `max-wait: -1` (dev). HTTP client timeouts **[TODO]**.
- Circuit-breaker: none found (no Resilience4j/Sentinel deps in sampled POMs).
- Schema apply: `scripts/ci-apply-migrations.sh` refuses `DB_NAME=xingyu_hub` and non-empty databases (fresh-only). Runtime migrator disabled in YAML.

### 5) Observability for Integrations

- Logging around Redis access-log push: yes (`ApiAccessLogServiceImpl`).
- SQL monitor: `xingyu.sql-monitor` in YAML (enabled in sample dev).
- Metrics/tracing: **[TODO]** no Micrometer/Prometheus files found.
- Gaps: no CI pipeline in-repo despite `scripts/ci-apply-migrations.sh`; no container healthcheck files.

### 6) Evidence

- `xingyu-backend/xingyu-starter/src/main/resources/application-dev.yml`
- `xingyu-backend/xingyu-starter/src/main/resources/application-prod.yml`
- `xingyu-backend/xingyu-infra/xingyu-redis/pom.xml`
- `xingyu-backend/xingyu-infra/xingyu-oss/src/main/java/top/pxczxn/xingyu/oss/FileStorage.java`
- `xingyu-backend/xingyu-infra/xingyu-db/src/main/java/top/pxczxn/xingyu/infra/schema/SchemaMigrator.java`
- `scripts/ci-apply-migrations.sh`
- `archive/xingyu-web-legacy/.env.example` (ARCHIVED)
- `.gitignore` secrets section

## Extended Sections (Optional)

### Local port map (dev)

| Process | Port | Evidence |
|---------|------|----------|
| Backend | 7779 | `application-dev.yml` |
| Legacy web (ARCHIVED) | 7777 | `archive/xingyu-web-legacy/vite.config.ts` — no longer served |
| Admin | 7778 | `xingyu-admin/vite.config.ts` (README still says 3000) |
| Web V2 | 5173 | `xingyu-web-next/vite.config.ts` |
| `xingyu.community.public-base-url` | `http://localhost:3000` | `application-dev.yml` — does not match any of the Vite ports above |

### Proxying

- Web V2: `/api/v1` → `http://127.0.0.1:7779`
- Legacy: `/api/v1` → `VITE_API_TARGET` default `127.0.0.1:7779`
- Admin: `/api`, `/druid`, `/ws` → `localhost:7779`

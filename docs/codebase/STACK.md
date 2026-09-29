# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

This repository is a **multi-project workspace** (not a single npm/Maven root). There is no root `package.json` or root `pom.xml`.

| Area | Value | Evidence |
|------|-------|----------|
| Primary languages | Java 21 (backend); TypeScript/React (user web); Vue 3 (admin); JavaScript (uni-app) | `../../xingyu-server/pom.xml` (`java.version` 21); `../../xingyu-web/package.json`; `xingyu-admin/package.json`; `xingyu-uniapp/package.json` |
| Runtime + version | Spring Boot 3.2.2; Node not pinned (no `.nvmrc`); Vite 8 (user web), Vite 5 (admin) | `../../xingyu-server/pom.xml`; `../../xingyu-web/package.json`; `xingyu-admin/package.json` |
| Package managers | Maven (backend); npm (`package-lock.json` present in web/admin) | `../../xingyu-server/pom.xml`; `../../xingyu-web/package.json`; `xingyu-admin/package.json` |
| Module/build system | Maven multi-module aggregator `xingyu-server`; independent Vite apps | `../../xingyu-server/pom.xml` `<modules>`; each frontend `package.json` |

### 2) Production Frameworks and Dependencies

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| Spring Boot | 3.2.2 | HTTP server, DI, scheduling | `../../xingyu-server/pom.xml` |
| MyBatis-Plus | 3.5.5 | ORM / mapper | `../../xingyu-server/pom.xml` |
| Sa-Token | 1.37.0 | Admin/app session & RBAC | `../../xingyu-server/pom.xml`; `SaTokenConfig.java` |
| Hutool | 5.8.25 | Utilities | `../../xingyu-server/pom.xml` |
| Druid | 1.2.23 | JDBC pool | `../../xingyu-server/pom.xml`; `application-dev.yml` |
| mysql-connector-j | (Spring Boot BOM) | MySQL driver `com.mysql.cj.jdbc.Driver` | `xingyu-infra/xingyu-db/pom.xml`; `application-dev.yml` |
| Redis (Spring Data + Lettuce) | Boot BOM | Cache, Sa-Token Redis jackson, rate limits | `xingyu-infra/xingyu-redis/pom.xml`; `application-dev.yml` |
| Quartz | `spring-boot-starter-quartz` | Admin-managed jobs | `xingyu-job/pom.xml` |
| React | ^19.0.0 | User web (V2 and Legacy) | `../../xingyu-web/package.json`; `xingyu-web/package.json` |
| react-router-dom | ^7.1.1 | Web V2 routing | `../../xingyu-web/package.json` |
| Vue | ^3.4.15 | Admin UI | `xingyu-admin/package.json` |
| Naive UI / Pinia / vue-router | Naive ^2.37.3, Pinia ^2.1.7, vue-router ^4.2.5 | Admin UI/state/routing | `xingyu-admin/package.json` |
| axios | ^1.6.5 | Admin HTTP | `xingyu-admin/package.json` |
| Milkdown | ^7.22.1 | Markdown editor | `../../xingyu-web/package.json` |
| uview-plus / crypto-js | 3.3.36 / ^4.2.0 | Uni-app UI and crypto | `xingyu-uniapp/package.json` |
| MinIO / Aliyun OSS SDKs | (infra poms) | Object storage adapters | `xingyu-infra/xingyu-oss/pom.xml` |
| Aliyun / Tencent SMS SDKs | (infra poms) | SMS adapters | `xingyu-infra/xingyu-sms/pom.xml` |
| spring-boot-starter-mail | Boot BOM | Email | `xingyu-infra/xingyu-mail/pom.xml` |

### 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| Maven + spring-boot-maven-plugin | Backend build/repackage | `xingyu-starter/pom.xml` |
| maven-surefire-plugin 3.5.4 | Backend tests (fork isolation) | `xingyu-starter/pom.xml` |
| TypeScript 5.3.x | Frontend typecheck | frontend `package.json` files |
| Vite | Frontend bundler/dev server | `xingyu-web`, `xingyu-web`, `xingyu-admin` |
| Vitest + jsdom + Testing Library | User-web unit/UI tests | `../../xingyu-web/package.json`; `xingyu-web/package.json` |
| Node `node --test` | Admin data-audit tests | `xingyu-admin/package.json` `test:audit` |
| Tailwind CSS 3.4 | User-web styling | `../../xingyu-web/package.json` |
| [TODO] ESLint / Prettier / Checkstyle / Spotless / Jacoco | No config files or POM plugins found | glob for eslint/prettier/checkstyle; grep of `pom.xml` |

### 4) Key Commands

```bash
# Backend
cd xingyu-backend
mvn -pl xingyu-starter -am package
mvn -pl xingyu-starter -am test

# Schema (local rebuild; requires DB_PASSWORD)
cd sql
./rebuild.ps1

# User web V2
cd xingyu-web-next
npm install
npm run dev          # Vite, port 5173
npm test
npm run build

# Legacy user web
cd xingyu-web
npm install
npm run dev          # Vite, port 7777
npm test

# Admin
cd xingyu-admin
npm install
npm run dev          # Vite, port 7778 (README says 3000; vite.config.ts is 7778)
npm run test:audit

# Uni-app
cd xingyu-uniapp
npm install
# HBuilderX / uni-app CLI per README
```

Lint command: **[TODO]** — no lint scripts in frontend `package.json`; no Checkstyle/Spotless plugins in backend POMs.

### 5) Environment and Config

- Config sources:
  - `../../xingyu-server/xingyu-starter/src/main/resources/application.yml` (`spring.profiles.active: dev`)
  - `application-dev.yml`, `application-prod.yml`, `application-test.yml`
  - `xingyu-web/.env.example`
  - gitignored `scripts/local-db.env` (referenced by `sql/README.md` and `application-dev.yml` comments)
- Required env vars (explicit placeholders / fail-fast):
  - `DB_PASSWORD` (dev default `__SET_DB_PASSWORD__`; prod also `DB_USERNAME`, `DB_URL`)
  - `DRUID_USERNAME`, `DRUID_PASSWORD` (dev Druid console)
  - Optional frontend: `VITE_API_BASE_URL` (web-next), `VITE_API_TARGET`, `VITE_USE_V2_HOME` (legacy web)
- Deployment/runtime constraints:
  - Default HTTP port **7779**
  - MySQL database name `xingyu_hub` (dev/prod), `xingyu_hub_test` (tests)
  - Redis host/port configured in all profiles; `xingyu-redis` has no optional/fallback Java source
  - `xingyu.schema.migration.enabled: false` in dev and prod YAML
  - No Dockerfiles or compose files found
  - No `.github/workflows` found

### 6) Evidence

- `../../xingyu-server/pom.xml`
- `../../xingyu-server/xingyu-starter/src/main/resources/application-dev.yml`
- `../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml`
- `../../xingyu-web/package.json`
- `xingyu-web/package.json`
- `xingyu-admin/package.json`
- `xingyu-uniapp/package.json`
- `sql/README.md`
- `docs/codebase/.codebase-scan.txt` (root scan missed subproject manifests)

## Extended Sections (Optional)

### Per-app Node versions

Exact Node version is **[TODO]** (no `.nvmrc` / `engines` field found in sampled `package.json` files).

### Environment matrix

| Profile | Port | DB | Redis DB | Schema migrator |
|---------|------|----|----------|-----------------|
| `dev` | 7779 | `xingyu_hub` | 6 | disabled |
| `prod` | 7779 | `${DB_URL}` default `xingyu_hub` | (see YAML) | disabled |
| `test` | (Boot test) | `xingyu_hub_test` | 7 | disabled |

Evidence: `application-dev.yml`, `application-prod.yml`, `application-test.yml`.

# 星语社区（xingyu-hub）

星语社区是一套面向内容创作者与社区用户的全栈产品：**社区 Web 端**、**运营管理后台**、**小程序端**与统一 **Java 后端**，覆盖内容创作、社交互动、审核治理、运营配置与开放 API 等能力。

本仓库为 **Monorepo**，各端共享同一套后端 API 与数据库迁移体系。

> 英文说明见文末 **[English](#english)** 章节。

---

## 目录

- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [仓库结构](#仓库结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [数据库迁移](#数据库迁移)
- [各端开发与构建](#各端开发与构建)
- [API 与认证](#api-与认证)
- [WebSocket](#websocket)
- [测试](#测试)
- [CI](#ci)
- [生产部署要点](#生产部署要点)
- [开发约定](#开发约定)

---

## 架构概览

```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  xingyu-web     │  │  xingyu-admin   │  │  xingyu-uniapp  │
│  社区 Web       │  │  运营管理后台   │  │  小程序         │
│  Vite + React   │  │  Vue 3 + Vite   │  │  uni-app        │
│  :7777          │  │  :7778          │  │  HBuilderX      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │  /api/v1           │  /api/v1/admin     │  /api/v1
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  xingyu-backend   │
                    │  Spring Boot 3.2  │
                    │  :7779            │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │ MySQL 8   │   │ Redis 7   │   │ 文件存储  │
        │ xingyu_hub│   │ db: 6     │   │ runtime/  │
        └───────────┘   └───────────┘   └───────────┘
```

后端通过 `ApiPrefixConfig` 为不同包下的 Controller 自动挂载路径前缀：

| 包路径 | API 前缀 | 用途 |
|--------|----------|------|
| `top.pxczxn.xingyu.admin.*` | `/api/v1/admin` | 管理端、系统运维 |
| `top.pxczxn.xingyu.web.*` | `/api/v1` | 社区公开与用户 API |
| `top.pxczxn.xingyu.api.*` | `/api/v1` | 兼容层（如 App 认证） |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Java 21、Spring Boot 3.2、MyBatis-Plus、Sa-Token、Druid、Redis |
| 社区 Web | React 19、TypeScript、Vite 8、Tailwind CSS、Vitest |
| 管理端 | Vue 3、Vite、Naive UI、Pinia、ECharts |
| 小程序 | uni-app |
| 数据库 | MySQL 8.0（`utf8mb4` / `utf8mb4_0900_ai_ci`） |
| CI | GitHub Actions（MySQL + Redis 服务容器） |

---

## 仓库结构

```text
xingyu-hub/
├── sql/                      # 版本化数据库迁移（V000–V031）
│   ├── V*.sql                # 增量迁移脚本（不可改已发布 checksum）
│   └── rebuild.ps1           # Windows 本地一键删库重建
├── scripts/
│   └── ci-apply-migrations.sh # CI / Linux 按序应用迁移
├── .github/workflows/ci.yml  # 持续集成
├── xingyu-backend/           # Java 后端（Maven 多模块）
│   ├── xingyu-starter/       # 启动入口（XingyuHubApplication）
│   ├── xingyu-api/           # admin-api、community-api 接口层
│   ├── xingyu-core/          # system、community、auth、file、gen…
│   ├── xingyu-infra/         # db、redis、crypto、websocket、oss…
│   ├── xingyu-common/        # 公共组件
│   └── xingyu-job/           # 定时任务
├── xingyu-web/               # 社区 Web 前端
├── xingyu-admin/             # 运营管理后台
└── xingyu-uniapp/            # 小程序端
```

### 后端模块说明

**xingyu-core**

| 模块 | 说明 |
|------|------|
| `xingyu-system` | RBAC、系统配置、用户/角色/菜单、审计 |
| `xingyu-community` | 社区业务：文章、话题、消息、审核、活动、星系等 |
| `xingyu-auth` | 登录策略、多端认证 |
| `xingyu-file` | 文件上传与管理 |
| `xingyu-gen` | 代码生成 |
| `xingyu-platform` | 平台扩展 |

**xingyu-infra**

| 模块 | 说明 |
|------|------|
| `xingyu-crypto` | 请求/响应加解密（XYC1 协议、HKDF） |
| `xingyu-websocket` | WebSocket 基础设施 |
| `xingyu-db` / `xingyu-redis` | 数据源与缓存 |
| `xingyu-oss` / `xingyu-mail` / `xingyu-sms` | 对象存储、邮件、短信 |
| `xingyu-wechat` / `xingyu-social` / `xingyu-pay` / `xingyu-push` | 微信、社交、支付、推送 |

---

## 环境要求

| 工具 | 版本建议 |
|------|----------|
| JDK | 21 |
| Maven | 3.9+ |
| Node.js | 20（与 CI 一致） |
| MySQL | 8.0 |
| Redis | 7 |
| Git | 2.x |

Windows 本地数据库重建脚本默认 MySQL 路径：

`C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`

---

## 快速开始

### 1. 克隆仓库

```bash
git clone <repo-url> xingyu-hub
cd xingyu-hub
```

### 2. 准备数据库

确保 MySQL、Redis 已启动。开发环境默认：

| 项 | 默认值 |
|----|--------|
| 数据库名 | `xingyu_hub` |
| MySQL 用户 | `pxczxn`（`rebuild.ps1`）/ `root`（CI） |
| MySQL 密码 | `root` |
| Redis | `localhost:6379`，database `6` |

**Windows 一键重建（推荐开发环境）：**

```powershell
cd sql
.\rebuild.ps1
# 可选参数：-User pxczxn -Password root -Database xingyu_hub
```

重建完成后管理端默认账号：**admin / admin123**

**Linux / CI：**

```bash
export DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=root DB_NAME=xingyu_hub
bash scripts/ci-apply-migrations.sh
```

### 3. 启动后端

```bash
cd xingyu-backend/xingyu-starter
mvn spring-boot:run
# 或先打包：cd xingyu-backend && mvn package -DskipTests
```

- 默认端口：**7779**
- 默认 Profile：`dev`（`application-dev.yml`）
- 开发环境 Druid 监控：`http://localhost:7779/druid`（用户名 `admin`，密码见 `application-dev.yml`）

### 4. 启动社区 Web

```bash
cd xingyu-web
npm ci
npm run dev
```

- 地址：`http://127.0.0.1:7777`
- `/api/v1` 由 Vite 代理到 `http://127.0.0.1:7779`

### 5. 启动管理端

```bash
cd xingyu-admin
npm ci
npm run dev
```

- 地址：`http://localhost:7778`
- `/api`、`/druid`、`/ws` 代理到后端 7779

### 本地端口一览

| 服务 | 端口 |
|------|------|
| xingyu-backend | 7779 |
| xingyu-web | 7777 |
| xingyu-admin | 7778 |
| MySQL | 3306 |
| Redis | 6379 |

---

## 数据库迁移

项目采用 **版本化 SQL 迁移**，由 `schema_migration` 表记录版本与 checksum。

### 迁移文件

| 范围 | 说明 |
|------|------|
| V000 | 迁移追踪表 |
| V002–V018 | 社区 + 管理端基线 schema |
| V019–V020 | 清理 Mars 演示数据 |
| V021–V027 | 活动、群聊、注册字段等 |
| V028–V031 | 话题描述、文章状态、话题治理、增长与开放 API |

当前最新：**V031__p2_growth.sql**（运营精选、社区 API Token）

### 日常变更流程

1. 新增 `sql/V0xx__描述.sql`，**不要修改**已发布迁移文件（checksum 不可变）。
2. 本地用 `rebuild.ps1` 验证，或对新脚本单独执行。
3. 与对应后端代码一并提交。
4. CI 通过 `scripts/ci-apply-migrations.sh` 自动应用全部 `V*.sql`。

### 应用内迁移开关

`application-dev.yml` 中 `xingyu.schema.migration.enabled` 默认为 `false`；本地重建优先使用 `sql/rebuild.ps1`。

---

## 各端开发与构建

### xingyu-web（社区 Web）

采用 **Vite + React**，通过别名兼容 Next.js 风格路由（`next/link`、`next/navigation` 等映射到 `src/vite/`）。

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（7777） |
| `npm run dev:clean` | 强制刷新依赖缓存 |
| `npm run build` | 生产构建 → `dist/` |
| `npm run start` | 预览构建结果 |
| `npm test` | Vitest 单元测试 |

环境变量（可选）：

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | API 根地址；留空则走 Vite 代理 |
| `VITE_API_TARGET` | 开发代理目标，默认 `http://127.0.0.1:7779` |

主要功能页面（`app/` 路由）包括：首页与发现、文章/系列/动态、话题与星系、消息与群聊、创作工作室、个人中心、设置、活动、申诉举报、开放 API Token 管理等。

### xingyu-admin（运营管理后台）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发（7778） |
| `npm run build` | 构建 → `dist/` |
| `npm run test:audit` | 管理端数据审计测试 |
| `npm run audit:data` | 运行数据审计脚本 |

运营模块（路由节选）：运营概览、社区用户、内容审核、治理案件、活动/指南/公告/星系/精选运营、内容资产、系统 RBAC、监控、消息与日志、代码生成等。

管理端支持 **请求加解密**（`xingyu-crypto` + 前端 HKDF），登录前可先拉取 `/api/v1/admin/crypto/config`。

### xingyu-uniapp（小程序）

使用 HBuilderX 或 uni-app CLI 打开 `xingyu-uniapp/`，运行到微信开发者工具。

```bash
cd xingyu-uniapp
npm install
```

`utils/request.js` 默认 API 地址为 `http://localhost:7779`；真机调试需改为可访问的后端地址。Token 通过 `Authorization` 请求头传递（与 Web 端 `satoken` 头并存兼容）。

### xingyu-backend（打包）

```bash
cd xingyu-backend
mvn clean package -DskipTests
# 可执行 jar：xingyu-starter/target/xingyu-starter-1.0.0.jar
```

生产启动示例：

```bash
java -jar xingyu-starter-1.0.0.jar \
  --spring.profiles.active=prod \
  -DDB_URL='jdbc:mysql://...' \
  -DDB_USERNAME=... \
  -DDB_PASSWORD=... \
  -DREDIS_HOST=... \
  -DREDIS_PASSWORD=...
```

可将管理端 `dist/` 拷贝到 `xingyu-starter/src/main/resources/static/` 后一并打包，由后端 SPA 回退到 `index.html` 提供单页应用托管（见 `WebMvcConfig`）。

---

## API 与认证

### 路径规范

| 前缀 | 示例 | 说明 |
|------|------|------|
| `/api/v1` | `/api/v1/home`、`/api/v1/articles` | 社区 API |
| `/api/v1/admin` | `/api/v1/admin/operations/overview` | 管理端 API |
| `/api/v1/open` | `/api/v1/open/articles` | 开放 API（API Token） |
| `/api/v1/auth` | `/api/v1/auth/login` | 社区用户认证 |
| `/api/v1/admin/auth` | `/api/v1/admin/auth/login` | 管理端认证 |

### 认证方式

使用 **Sa-Token**：

| 端 | Token 传递 |
|----|------------|
| 社区 Web | 请求头 `satoken`；localStorage 键 `xingyu-satoken` |
| 管理端 | 响应头 `satoken` + 请求携带 |
| 小程序 | `Authorization` 头（兼容） |

社区部分路径需登录（`CommunityAuthInterceptor`），例如 `/api/v1/me/**`、`/api/v1/messages/**`、`/api/v1/reports/**` 等。开放 API 路径 `/api/v1/open/**` 使用 API Token 鉴权。

### 社区 API 域（节选）

| 域 | 路径前缀 | 能力 |
|----|----------|------|
| 认证 | `/auth` | 注册、登录、邮箱验证、密码找回 |
| 个人 | `/me` | 资料、书架、收藏、设置、API Token |
| 内容 | `/articles`、`/series`、`/moments` | 文章、系列、动态 |
| 社交 | `/topics`、`/galaxies`、`/users` | 话题、星系、用户关系 |
| 消息 | `/messages` | 私信、群聊 |
| 治理 | `/reports`、`/appeals` | 举报、申诉 |
| 运营 | `/events`、`/announcements`、`/guide` | 活动、公告、指南 |
| SEO | `/sitemap.xml`、`/feed.xml` | 站点地图、RSS |
| 开放 | `/open` | 第三方只读 API |

错误响应遵循 Problem Details 风格（社区 API 有独立 `CommunityApiExceptionHandler`）。

---

## WebSocket

| 路径 | 用途 |
|------|------|
| `/ws/message` | 管理端消息推送 |
| `/ws/ssh` | 服务器 SSH 终端 |
| `/ws/community/chat` | 社区私信/群聊实时推送 |

社区聊天：HTTP 发送消息，WebSocket 接收多端同步。连接示例：

```text
ws://localhost:7779/ws/community/chat?token=<satoken>
```

管理端开发时可通过 Vite 代理 `/ws` 到后端。

---

## 测试

### 后端集成测试

```bash
cd xingyu-backend/xingyu-starter
mvn test
```

测试前需可用的 MySQL 与 Redis（与 `application-dev.yml` 一致）。CI 会先执行 `scripts/ci-apply-migrations.sh`。

| 测试 | 覆盖 |
|------|------|
| `AuthFlowIntegrationTest` | 注册登录流程 |
| `ArticleFlowIntegrationTest` | 文章流水线 |
| `Batch4IntegrationTest` / `Batch5IntegrationTest` | 批次功能 |
| `Batch6OperationsIntegrationTest` | 运营（活动、星系、公告） |
| `Batch7GrowthIntegrationTest` | 增长（精选、开放 API、SEO） |
| `ChatWebSocketIntegrationTest` | 聊天 WebSocket |
| `OperationsOverviewIntegrationTest` | 运营概览 |

Surefire 配置 `reuseForks=false`，因 Sa-Token 使用 JVM 级静态状态。

### 前端测试

```bash
cd xingyu-web && npm test
cd xingyu-admin && npm run test:audit
```

---

## CI

工作流：`.github/workflows/ci.yml`

| Job | 说明 |
|-----|------|
| `backend` | MySQL 8 + Redis 7 服务容器 → 应用迁移 → `mvn test` |
| `web` | `xingyu-web`：`npm ci` + `npm test` |
| `admin` | `xingyu-admin`：`npm ci` + `npm run test:audit` |

触发：`push` / `pull_request` 到 `main` / `master`。

---

## 生产部署要点

### 环境变量（`application-prod.yml`）

| 变量 | 说明 |
|------|------|
| `DB_URL` | JDBC 连接串 |
| `DB_USERNAME` / `DB_PASSWORD` | 数据库凭据 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 地址 |
| `REDIS_PASSWORD` | Redis 密码（可为空） |
| `REDIS_DATABASE` | 默认 `6` |

生产环境已关闭 Druid 监控页面与 SQL 监控；**切勿**将 `application-dev.yml` 中的本地密码用于生产。

### 运行时目录

| 路径 | 说明 |
|------|------|
| `xingyu-backend/runtime/uploads/` | 用户上传文件（已在 `.gitignore`） |
| `logs/` | 应用日志 |

### 静态资源

- 用户上传：运行时 `runtime/uploads/`，勿纳入 Git。
- 管理端构建产物：可打入 `static/` 由后端统一托管，或独立 CDN / Nginx 部署。

### 社区公开地址

开发配置 `xingyu.community.public-base-url`（默认 `http://localhost:3000`），生产需改为实际社区域名，用于邮件链接、SEO 等场景。

---

## 开发约定

### Git 与文档

- 根目录仅保留本 `README.md`；`doc/`、`docs/` 及子目录 Markdown 为本地开发资料，不提交。
- 构建产物、`node_modules/`、`target/`、`runtime/`、日志等由 `.gitignore` 忽略。
- 文本文件统一 LF（见 `.gitattributes`）。

### 数据库

- 结构变更：**新增** `sql/V0xx__*.sql`，不修改已发布迁移。
- 不要用 Navicat「仅结构」导出覆盖已有库。
- 种子数据仅保留必要系统初始化，不含真实用户业务数据。

### 演示模式

`xingyu.demo-mode: true` 时，管理端写操作会被 `DemoModeInterceptor` 拦截（生产应保持 `false`）。

### 加密传输

管理端与部分接口支持 XYC1 协议加解密；开发环境可在系统配置中关闭。小程序 `utils/crypto.js` 与后端 `xingyu-crypto` 模块对应。

---

## 许可证

未在仓库中声明开源许可证时，默认保留所有权利。对外分发前请补充 LICENSE 文件。

---

<a id="english"></a>

# English — Xingyu Community

Xingyu Community is a full-stack product for content creators and community users: **community web**, **operations admin**, **mini program**, and a unified **Java backend**. This **monorepo** shares one API and one database migration pipeline.

> 中文说明见上文 **[星语社区](#星语社区xingyu-hub)** 章节。

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Database Migrations](#database-migrations)
- [Client Development & Build](#client-development--build)
- [API & Authentication](#api--authentication)
- [WebSocket](#websocket-1)
- [Testing](#testing-1)
- [CI](#ci-1)
- [Production Deployment](#production-deployment)
- [Development Conventions](#development-conventions)

---

## Architecture

```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  xingyu-web     │  │  xingyu-admin   │  │  xingyu-uniapp  │
│  Community Web  │  │  Ops Admin      │  │  Mini Program   │
│  Vite + React   │  │  Vue 3 + Vite   │  │  uni-app        │
│  :7777          │  │  :7778          │  │  HBuilderX      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │  /api/v1           │  /api/v1/admin     │  /api/v1
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  xingyu-backend   │
                    │  Spring Boot 3.2  │
                    │  :7779            │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │ MySQL 8   │   │ Redis 7   │   │ Uploads   │
        │ xingyu_hub│   │ db: 6     │   │ runtime/  │
        └───────────┘   └───────────┘   └───────────┘
```

`ApiPrefixConfig` attaches prefixes by controller package:

| Package | Prefix | Purpose |
|---------|--------|---------|
| `top.pxczxn.xingyu.admin.*` | `/api/v1/admin` | Admin & platform ops |
| `top.pxczxn.xingyu.web.*` | `/api/v1` | Community APIs |
| `top.pxczxn.xingyu.api.*` | `/api/v1` | Compatibility layer |

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| Backend | Java 21, Spring Boot 3.2, MyBatis-Plus, Sa-Token, Druid, Redis |
| Community web | React 19, TypeScript, Vite 8, Tailwind CSS, Vitest |
| Admin | Vue 3, Vite, Naive UI, Pinia, ECharts |
| Mini program | uni-app |
| Database | MySQL 8.0 (`utf8mb4`) |
| CI | GitHub Actions |

---

## Repository Layout

```text
xingyu-hub/
├── sql/                       # Migrations V000–V031, rebuild.ps1
├── scripts/ci-apply-migrations.sh
├── .github/workflows/ci.yml
├── xingyu-backend/            # Maven multi-module backend
├── xingyu-web/                # Community web
├── xingyu-admin/              # Admin
└── xingyu-uniapp/             # Mini program
```

---

## Prerequisites

JDK 21, Maven 3.9+, Node.js 20, MySQL 8.0, Redis 7, Git 2.x.

---

## Quick Start

```bash
git clone <repo-url> xingyu-hub && cd xingyu-hub

# Database (Windows)
cd sql && .\rebuild.ps1
# Default admin: admin / admin123

# Database (Linux / CI)
export DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=root DB_NAME=xingyu_hub
bash scripts/ci-apply-migrations.sh

# Backend (:7779)
cd xingyu-backend/xingyu-starter && mvn spring-boot:run

# Community web (:7777)
cd xingyu-web && npm ci && npm run dev

# Admin (:7778)
cd xingyu-admin && npm ci && npm run dev
```

| Service | Port |
|---------|------|
| xingyu-backend | 7779 |
| xingyu-web | 7777 |
| xingyu-admin | 7778 |

---

## Database Migrations

Versioned `sql/V*.sql` with `schema_migration` checksum tracking. Latest: **V031__p2_growth.sql**.

- Add new `sql/V0xx__*.sql` for schema changes; never edit published migrations.
- Local rebuild: `sql/rebuild.ps1` (Windows).
- CI applies all scripts via `scripts/ci-apply-migrations.sh`.

---

## Client Development & Build

**xingyu-web:** `npm run dev` | `build` | `test` — Vite + React, Next-style routing aliases.

**xingyu-admin:** `npm run dev` | `build` | `npm run test:audit` — Vue 3 admin.

**xingyu-uniapp:** Open in HBuilderX; default API `http://localhost:7779`.

**Backend package:** `mvn clean package -DskipTests` → `xingyu-starter/target/xingyu-starter-1.0.0.jar`

---

## API & Authentication

| Prefix | Purpose |
|--------|---------|
| `/api/v1` | Community APIs |
| `/api/v1/admin` | Admin APIs |
| `/api/v1/open` | Open API (tokens) |

**Sa-Token:** community web uses header `satoken`; admin uses response/request `satoken`; mini program uses `Authorization`.

---

## WebSocket

| Path | Purpose |
|------|---------|
| `/ws/message` | Admin push |
| `/ws/ssh` | SSH terminal |
| `/ws/community/chat` | Community chat sync |

```text
ws://localhost:7779/ws/community/chat?token=<satoken>
```

---

## Testing

```bash
cd xingyu-backend/xingyu-starter && mvn test
cd xingyu-web && npm test
cd xingyu-admin && npm run test:audit
```

---

## CI

`.github/workflows/ci.yml` — backend (`mvn test`), web (`npm test`), admin (`test:audit`) on push/PR to `main` / `master`.

---

## Production Deployment

Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PASSWORD` via `application-prod.yml` / env. Do not reuse dev credentials. Uploads live in `runtime/uploads/` (gitignored).

---

## Development Conventions

- Only root `README.md` is tracked; `doc/` / `docs/` are local.
- LF line endings (`.gitattributes`).
- New migrations only; no rewriting published SQL checksums.
- `xingyu.demo-mode: false` in production.

---

## License

No open-source license declared. Add `LICENSE` before public distribution.

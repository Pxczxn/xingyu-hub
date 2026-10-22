# 技术栈（当前源码核对版）

本次为仓库级导航与关键链路分析，不代表逐行审计、生产部署验收或依赖漏洞扫描。依赖版本下列为 manifest 声明范围，不等于全部安装版本；未知项用 `[TODO]` 标记。

## 1) Runtime Summary

| 部分 | 语言、运行时与构建 | 证据 |
|---|---|---|
| 服务端 | Java 21，Maven 多模块，Spring Boot 3.2.2，单 starter JAR | [父 POM](../../xingyu-server/pom.xml)、[starter POM](../../xingyu-server/xingyu-starter/pom.xml) |
| 用户端 | TypeScript、React 19、Vite 8；Node >=22.12；现行目录只有 xingyu-web，package name 仍为 xingyu-web-next | [package.json](../../xingyu-web/package.json) |
| 管理端 | TypeScript 5.4.5、Vue 3.4、Vite 5；独立 npm 工程 | [package.json](../../xingyu-admin/package.json) |
| 消息移动端 | JavaScript、Vue 3、uni-app；HBuilderX 工程，无 package scripts | [package.json](../../xingyu-uniapp/package.json)、[README](../../xingyu-uniapp/README.md) |

本机实际命令结果：Node v24.18.0、npm 11.16.0、Java 21.0.11、Maven 3.9.16。用户端 CI 使用 Node 22 与 npm ci，见 [CI](../../.github/workflows/ci.yml)。本次未安装或升级任何依赖。

仓库规模（2026-10-21 源码统计，排除 target/node_modules/dist）：Java 726 个文件（main 644 / test 82），`xingyu-web/src` 586 个 ts/tsx/css 文件约 8.3 万行，管理端 102 个源文件，移动端 10 个页面。数量只说明体量，不代表质量或覆盖。

## 2) Production Frameworks and Dependencies

| 部分 | 关键依赖及职责 | 证据 |
|---|---|---|
| 服务端 | MyBatis-Plus 3.5.5 持久化；Sa-Token 1.37.0 管理端认证；Spring MVC、MySQL/Druid；另有 Redis、Quartz 及基础设施集成模块 | [父 POM](../../xingyu-server/pom.xml)、[system POM](../../xingyu-server/xingyu-core/xingyu-system/pom.xml)、[infra POM](../../xingyu-server/xingyu-infra/pom.xml) |
| 用户端 | React/React DOM ^19.0.0，React Router ^7.1.1，Radix UI，Milkdown ^7.22.1；原生 fetch，不是 Axios 请求层 | [manifest](../../xingyu-web/package.json)、[client](../../xingyu-web/src/api/client.ts) |
| 管理端 | Vue ^3.4.15、Router ^4.2.5、Naive UI ^2.37.3、Pinia ^2.1.7、Axios ^1.6.5、ECharts ^6.0.0、xterm；另有自实现的 XYC1 响应加密（ECDH → HKDF → AES-256-GCM） | [manifest](../../xingyu-admin/package.json)、[加密协议](../../xingyu-admin/src/utils/crypto/protocol.ts) |
| uni-app | uview-plus、crypto-js；uni 平台 API | [manifest](../../xingyu-uniapp/package.json)、[入口](../../xingyu-uniapp/main.js) |

## 3) Development Toolchain

用户端有 TypeScript strict、ESLint 9、Prettier、Tailwind 3、Vitest 3 与 Testing Library；Vitest 实际选择 happy-dom，虽然依赖中仍有 jsdom。管理端有单独 vue-tsc 命令及 Node 内置审计测试，build 不自动类型检查。服务端测试使用 Spring Boot Test；这些是开发工具，不是线上业务依赖。

证据：[TS 配置](../../xingyu-web/tsconfig.json)、[ESLint 配置](../../xingyu-web/eslint.config.js)、[Vitest 配置](../../xingyu-web/vitest.config.ts)、[管理端命令](../../xingyu-admin/package.json)、[starter POM](../../xingyu-server/xingyu-starter/pom.xml)。

## 4) Key Commands

```bash
# cwd: xingyu-web
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run check:bundle

# cwd: xingyu-admin
npm run dev
npm run type-check
npm run test:audit
npm run build

# cwd: xingyu-server；仅准备好隔离测试库后运行，可能写测试库
mvn -pl xingyu-starter -am test
```

## 5) Environment and Config

开发端口：用户端 7777、管理端 7778、服务端 7779，来源分别为 [Web Vite](../../xingyu-web/vite.config.ts)、[Admin Vite](../../xingyu-admin/vite.config.ts)、[dev profile](../../xingyu-server/xingyu-starter/src/main/resources/application-dev.yml)。用户端 VITE_API_BASE_URL 可覆盖 API 地址。

服务端默认 profile 为 dev。生产需显式选择 prod 并注入 DB_USERNAME、DB_PASSWORD，可覆盖 DB_URL、REDIS_HOST/PORT/PASSWORD/DATABASE；dev 支持导入被忽略的本地 properties。只确认配置机制，不读取或披露本地凭据。dev/prod/test 均显式关闭自动 schema migration。容器部署拓扑、实际生产反代与服务版本 `[TODO]`，源码不能证明线上配置。

管理端响应加密由服务端配置驱动：前端启动拉取 `/api/v1/admin/crypto/config`，`enabled=false` 时全链路明文；启用后请求带 `X-Crypto-Session-Id` / `X-Crypto-Request-Id`，响应为 XYC1 信封。详见 [集成](./INTEGRATIONS.md)。

## 6) Evidence

- [运行配置](../../xingyu-server/xingyu-starter/src/main/resources/application.yml)、[prod profile](../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml)
- [用户端 manifest](../../xingyu-web/package.json)、[管理端 manifest](../../xingyu-admin/package.json)、[移动端 manifest](../../xingyu-uniapp/package.json)
- [CI](../../.github/workflows/ci.yml)、[验证结果](./TESTING.md)

旧文档中的双用户端目录、5173/3000 开发端口、无 lint、Node 无约束、jsdom 为现行测试环境等描述均已被当前配置取代；历史记录不应作为启动依据。

# 项目结构与阅读路线

## 1) Top-Level Map

| 路径 | 当前职责及依据 |
|---|---|
| [xingyu-server](../../xingyu-server/pom.xml) | Maven 聚合：common、infra、core、api、job、starter |
| [xingyu-web](../../xingyu-web/package.json) | React 用户端，社区内容阅读、创作、互动与账户设置 |
| [xingyu-admin](../../xingyu-admin/package.json) | Vue 管理端，系统管理与社区审核、治理、运营；侧栏由 `src/config/navigation.ts` 硬编码，服务端菜单只补动态路由 |
| [xingyu-uniapp](../../xingyu-uniapp/pages.json) | 消息、私聊、通讯录、群聊和个人资料；不是 Web 全业务等量实现 |
| [sql](../../sql/README.md) | V000–V053 版本化 SQL、开发库及测试库重建工具 |
| [scripts](../../scripts/ci-apply-migrations.sh) | fresh-only 数据库应用及辅助脚本；不要把名称含 ci 理解为已接入流水线 |
| [maintenance/reconciliation](../../maintenance/reconciliation/README.md) | 历史台账核对说明，与常规版本迁移区分 |
| [docs/codebase](./ARCHITECTURE.md) | 本组源码导航文档；旧归档说明保留为历史而非现状 |
| [.github/workflows](../../.github/workflows/ci.yml) | 当前只定义用户端质量门禁 |

扫描器未识别根 manifest，不等于没有多工程结构；根目录不是一个统一 npm workspace。扫描统计还含静态构建资源，不能把总行数当手写业务代码量。

### 各工程规模（2026-10-21 直接统计）

| 工程 | 结构计数 | 证据 |
|---|---|---|
| xingyu-server | Maven 根聚合 6 个模块（common / infra / core / api / job / starter）；`src/main` 644 个 java、`src/test` 82 个 | [父 POM](../../xingyu-server/pom.xml)、目录统计 |
| xingyu-api | community-api 29 个 Controller、admin-api 42 个 Controller | 文件计数 |
| xingyu-core | auth / community / file / gen / platform / system 六个模块；community 单模块含 30 个 Service 类 | [core POM](../../xingyu-server/xingyu-core/pom.xml) |
| xingyu-web | 29 个 features、85 个 `*Page.tsx`、32 个 api 领域目录 | [路由表](../../xingyu-web/src/router/routes.tsx) |
| xingyu-admin | 41 个 `views/**/*.vue`、5 个 store、5 个 crypto 模块 | [路由](../../xingyu-admin/src/router/index.ts) |
| xingyu-uniapp | 10 个页面，tabBar 3 项 | [pages.json](../../xingyu-uniapp/pages.json) |
| sql | 54 个 `V0xx__*.sql`（V000–V053），历史上出现过 123 个不同表名（含 V019/V020 已删除的 Mars 演示表） | 迁移文件 |

## 2) Entry Points

- 服务端：[XingyuHubApplication](../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/XingyuHubApplication.java)，Spring Boot + EnableScheduling；[starter POM](../../xingyu-server/xingyu-starter/pom.xml) 配置 repackage。
- 用户端：[main.tsx](../../xingyu-web/src/main.tsx) → [App](../../xingyu-web/src/app/App.tsx) → [Providers](../../xingyu-web/src/app/providers/AppProviders.tsx) / [routes](../../xingyu-web/src/router/routes.tsx)。Auth → ChatSocket → NotificationToast；单 React Router，重型页面按需加载。
- 管理端：[main.ts](../../xingyu-admin/src/main.ts) 初始化 Pinia、router、Naive UI，以及加密和站点配置；[router](../../xingyu-admin/src/router/index.ts) 合并静态页面与服务端菜单。
- uni-app：[main.js](../../xingyu-uniapp/main.js)、[App.vue](../../xingyu-uniapp/App.vue)、[pages.json](../../xingyu-uniapp/pages.json)。登录态与 Web 不共享前端实现。
- 后台任务随服务端启动，不是另一个独立部署服务：[事件消费者](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventConsumer.java)、[定时送审任务](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/task/ScheduledArticlePublishTask.java)。

## 3) Module Boundaries

| 模块 | 源码表现出的职责 | 阅读与修改边界 |
|---|---|---|
| common | 契约、错误、公共模型与访问策略 | 不把 Spring Controller 业务搬入公共契约 |
| infra | db、redis、oss、crypto、mail、sms、支付/推送/社交/微信/WebSocket 等适配 | 实际有若干模块反依赖 system，不能宣称严格单向分层 |
| core/system | 管理端用户、角色、配置与系统能力 | 不等同社区用户和 session |
| core/community | 账号、内容、社交、聊天、治理等领域 | 通过 Service/Mapper 追踪真实权限和状态语义 |
| core/platform | 可靠事件等共享平台能力 | 可靠性不能只看类名和 lease 字段 |
| api | admin-api 与 community-api 的 HTTP 入口 | 前缀、认证上下文、响应格式不同 |
| job | Quartz 作业和反射调用 | 任务权限边界需要单独关注 |
| starter | 组装、profile、启动、安全守卫与集成测试 | 构建模块不代表每模块都是服务 |

依据：[core POM](../../xingyu-server/xingyu-core/pom.xml)、[infra POM](../../xingyu-server/xingyu-infra/pom.xml)、[API POM](../../xingyu-server/xingyu-api/pom.xml)、[pay POM](../../xingyu-server/xingyu-infra/xingyu-pay/pom.xml)。

## 4) Naming and Organization Rules

用户端按领域分 features 与 api，再共享 components/lib/layouts/router；组件常用 PascalCase，工具和测试也有 kebab-case，不能机械统一重命名。`@/*` 映射 src，见 [tsconfig](../../xingyu-web/tsconfig.json)。管理端主要是 views、api、stores、utils 与 router，见 [用户 store](../../xingyu-admin/src/stores/user.ts)。服务端以 Java 包与 Maven 模块并行分层，类名体现 Controller、Service、Mapper、Entity 职责。

建议入门顺序：先看 [技术栈](./STACK.md)，再看 [架构与文章链路](./ARCHITECTURE.md)、[集成及认证](./INTEGRATIONS.md)、[测试](./TESTING.md)，最后读 [风险优先级](./CONCERNS.md)。静态 assets、dist、node_modules 不作为业务架构证据。

## 5) Evidence

- [服务端聚合](../../xingyu-server/pom.xml)、[启动入口](../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/XingyuHubApplication.java)
- [用户端路由](../../xingyu-web/src/router/routes.tsx)、[管理端路由](../../xingyu-admin/src/router/index.ts)、[移动端页面表](../../xingyu-uniapp/pages.json)
- [扫描记录](./.codebase-scan.txt)：历史高变动路径可能已重命名；扫描结果必须与当前文件交叉核验。

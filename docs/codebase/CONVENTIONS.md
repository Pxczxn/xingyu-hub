# 代码约定与契约边界

以下区分源码惯例与工具强制规则，不把个人建议伪装成仓库规范。

## 1) Naming Rules

| 范围 | 已观察惯例 | 证据 |
|---|---|---|
| Java | 类 PascalCase，方法 camelCase，Controller/Service/Mapper 后缀；包按领域与层拆分 | [ArticleService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleService.java)、[ArticleMapper](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/mapper/ArticleMapper.java) |
| React | 页面/组件 PascalCase；工具、API、测试含 kebab-case 和点分后缀；不是单一文件名格式 | [HomePage](../../xingyu-web/src/features/home/pages/HomePage.tsx)、[client.test](../../xingyu-web/src/api/client.test.ts)、[storage](../../xingyu-web/src/lib/storage.ts) |
| Vue 管理端 | views 下 index.vue，api 与 stores 分目录，组合式状态 | [审核页](../../xingyu-admin/src/views/community/review/index.vue)、[user store](../../xingyu-admin/src/stores/user.ts) |
| SQL / 配置 | V###__description.sql；环境变量大写下划线 | [迁移说明](../../sql/README.md)、[prod profile](../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml) |

## 2) Formatting and Linting

用户端 [ESLint flat config](../../xingyu-web/eslint.config.js) 启用 JS/TS recommended、jsx-a11y，rules-of-hooks 为 error，exhaustive-deps 和 react-refresh 为 warn；有意未启用整套 React Compiler 规则。下划线开头的未使用绑定获豁免。配置中的历史警告数量不是本轮测量值。

[tsconfig](../../xingyu-web/tsconfig.json) 开启 strict、noUnusedLocals、noUnusedParameters、noFallthroughCasesInSwitch，target ES2022。用户端命令为 npm run lint、npm run format:check，后者使用 Prettier；是否通过需看实际结果，不能因配置存在而宣称全库合规。

管理端脚本含 type-check，但 build 只执行 vite build，见 [manifest](../../xingyu-admin/package.json)。Java 全库统一格式/静态规则及管理端统一 lint 门禁 `[TODO]`；不能将 Web 的配置推及所有工程。

## 3) Import and Module Conventions

- 用户端 `@/*` 指向 src，TypeScript 与 [Vitest](../../xingyu-web/vitest.config.ts) 都配置该别名；目录按 features 与 api 领域组织。
- 服务端跨模块能力通过 Maven 显式依赖，而非仅凭 Java 包名推断层级。[community POM](../../xingyu-server/xingyu-core/xingyu-community/pom.xml) 显示实际依赖。
- 全库统一 import 排序、barrel exports 策略 `[TODO]`，未发现足以宣称强制统一的证据。不做无关重命名或格式化。

## 4) Error and Logging Conventions

**三端契约不能混用：**

- 用户端 [client](../../xingyu-web/src/api/client.ts) 接收原始 JSON/ProblemDetails 风格错误，添加 satoken、credentials include、可选 Idempotency-Key；401 清理本地 token。不要在这里套管理端 Result 解包假设。
- 管理端 [request](../../xingyu-admin/src/utils/request.ts) 使用 /api/v1/admin 基址、Axios、Result(code/message/data) 解包及加密响应处理；[api-request](../../xingyu-admin/src/utils/api-request.ts) 集中规范化列表和分页。
- 管理端视图层的按钮权限是显式函数调用而非指令：`const hasPermission = (p) => userStore.hasPermission(p)` + `v-if`，admin 角色短路放行，见 [用户管理](../../xingyu-admin/src/views/system/user/index.vue#L59-L72)、[store](../../xingyu-admin/src/stores/user.ts#L67-L71)。这只决定界面可见性，服务端另有校验；两者都缺失时不能靠前端兜底。
- 社区"公开但可带身份"的读取由 [CommunityWebConfig](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/config/CommunityWebConfig.java#L18-L76) 的路径白名单 + [拦截器](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/interceptor/CommunityAuthInterceptor.java#L30-L109) 的可选身份解析共同实现；新增 viewer-scoped 字段时必须同步该白名单，否则字段永远为空。
- 服务端领域访问拒绝、版本冲突由 Service/策略判断，不应仅依赖前端隐藏按钮。[访问策略](../../xingyu-server/xingyu-common/src/main/java/top/pxczxn/xingyu/common/contract/access/AccessPolicy.java) 是正文可见性证据。
- 管理端加密是"尽力而为"约定：[fetchCryptoConfig](../../xingyu-admin/src/utils/request.ts#L72-L100) 失败时回落为 `enabled:false` 继续明文请求；后端缺会话头时记 warn 并返回明文（[Advice](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/advice/EncryptResponseBodyAdvice.java#L95-L116)）。新增管理端接口不需要自行处理加密，但也不要假设响应一定是密文。
- 任务使用日志记录失败并继续扫描，见 [定时任务](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/task/ScheduledArticlePublishTask.java)。dev 包日志 debug、prod info；全局日志字段、脱敏及追踪规范 `[TODO]`，未做日志泄露专项审计。

## 5) Testing Conventions

Web 将 `*.test.ts(x)` 放在 src 相邻领域内，Vitest 扫描 `src/**/*.{test,spec}.{ts,tsx}`；使用 Testing Library 与 mock。管理端 Node tests 仅部分为逻辑断言，部分是源码文本约束，不能替代页面验收。Java 按模块 src/test/java 放单测和 starter 集成测试，test profile 专用数据库。详见 [测试](./TESTING.md)。

覆盖率比例与统一阈值 `[TODO]`；本轮测试通过数不是代码覆盖率。

## 6) Evidence

- [TS 配置](../../xingyu-web/tsconfig.json)、[lint 配置](../../xingyu-web/eslint.config.js)、[命令](../../xingyu-web/package.json)
- [API 客户端](../../xingyu-web/src/api/client.ts)、[Admin 客户端](../../xingyu-admin/src/utils/request.ts)
- [SQL 约定](../../sql/README.md)、[隔离测试配置](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml)

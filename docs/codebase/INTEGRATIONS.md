# 集成、存储与认证

## 1) Integration Inventory

| 接入 | 当前代码事实 | 重要边界 / 证据 |
|---|---|---|
| 管理端 HTTP | /api/v1/admin，satoken，Sa-Token 登录态与角色权限 | [request](../../xingyu-admin/src/utils/request.ts)、[SaTokenConfig](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java) |
| 管理端加密 | XYC1：ECDH 建会话 → HKDF 派生响应密钥 → AES-256-GCM，信封含 sid/rid/ts/nonce 与 AAD `XYC1\|{sid}\|{rid}\|A256GCM\|{ts}`；仅加密响应，请求体解密未实现 | [协议](../../xingyu-admin/src/utils/crypto/protocol.ts)、[会话](../../xingyu-admin/src/utils/crypto/session.ts)、[后端 Cipher](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/engine/Xyc1ResponseCipher.java)、[Advice](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/advice/EncryptResponseBodyAdvice.java) |
| 用户端 HTTP | /api/v1，satoken，但社区自建 session 验证，不直接复用管理登录态 | [client](../../xingyu-web/src/api/client.ts)、[CommunityAuthInterceptor](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/interceptor/CommunityAuthInterceptor.java) |
| Open API | /open/** 使用 Authorization 与独立 API Token | [OpenApiInterceptor](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/interceptor/CommunityOpenApiInterceptor.java)；scope 全覆盖 `[TODO]` |
| 聊天 WebSocket | Web 使用 /ws/community/chat?token，心跳、重连、REST sequence 回补；移动端仍连 /ws/message?token= | [ChatSocketProvider](../../xingyu-web/src/features/chat/ChatSocketProvider.tsx)、[移动端 socket](../../xingyu-uniapp/utils/websocket.js)；重放/多实例实际行为未验收 |
| 移动端旧接口 | BASE_URL 固定 `http://localhost:7779`，认证头 `Authorization`（非 satoken），路径混用 /api/v1/app、/api/v1/admin、/api/v1/auth；私聊走 `/admin/sys/chat/*`、群聊走 `/admin/chat/group/*`，后端 [SysChatCompatController](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/message/SysChatCompatController.java#L26-L91) 对发送返回"已迁移"、对历史/会话返回空 | [request](../../xingyu-uniapp/utils/request.js#L8-L22)、[api](../../xingyu-uniapp/utils/api.js)；真机能否跑通未验证 |
| 移动端加密 | legacy 模式：从 /api/v1/admin/crypto/config 取明文 aesKey，用 crypto-js CTR 手搓 GCM 并显式跳过认证标签校验；解密失败静默回退原始数据 | [crypto](../../xingyu-uniapp/utils/crypto.js#L74-L137)；与管理端 XYC1 不是同一代协议 |
| OSS/邮件/短信/支付/微信/社交等 | infra 含适配模块，不意味着所有供应商已开通或可用 | [infra POM](../../xingyu-server/xingyu-infra/pom.xml)；账户、配额、供应商环境、可用性 `[TODO]` |

### 认证语义

管理端 [SaTokenConfig](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java#L48-L103) 对 admin 路由登录检查，并对部分社区管理路由额外要求 admin 角色。排除登录检查的路径仍可能有控制器判权，不能笼统断言文件接口匿名。这里有一段必须知道的历史：[注解读取修复](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java#L18-L41) 说明 admin 控制器被 AOP CGLIB 代理后 `@SaCheckPermission` 曾整体静默失效，改为用 `AnnotationUtils.findAnnotation` 读注解、并在 [L62-L82](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java#L62-L82) 用运行时路由断言强制 `/community/**`、`/review/**`、`/moderation/**`、`/topics/**`、`/operations/**` 需要 admin 角色。系统域 `/sys/**`、`/monitor/**` 等的注解保护依赖上述注解修复生效，本轮未做越权实测。[StpInterfaceImpl](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/StpInterfaceImpl.java) 缓存角色权限到 SaSession，所有权限变更是否完整失效 `[TODO]`。

管理端侧栏不读服务端菜单：[navigation.ts](../../xingyu-admin/src/config/navigation.ts#L19-L88) 硬编码分组导航，[layout](../../xingyu-admin/src/layout/index.vue#L385) 直接使用；服务端菜单只通过 `addDynamicRoutes` 补上静态表里没有的路由，因此"菜单可见"与"路由可进入"是两套来源。`org/dept`、`org/post`、`system/customer`、`test/test` 只存在于动态路由。

社区 [路由配置](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/config/CommunityWebConfig.java) 和 interceptor 建立 CommunityAuthContext，校验 session 撤销/过期、账号 ACTIVE、强制改密；部分 GET 允许游客并降级无效可选 token。文章公共 GET 自行解析可选身份。上下文会在请求结束清理。这里只确认源码路径，实际 Spring 拦截器/注解代理效果未做运行实验。

## 2) Data Stores

- MySQL：业务表、社区 session、schema_migration 台账、reliable_event outbox；MyBatis-Plus + Druid。prod 使用环境变量配置，见 [prod](../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml)。
- Redis：dev 默认 db6、test db7。可选增强是项目目标，但本轮未做 Redis 断开故障演练，**不能据配置推断全业务不依赖 Redis**。见 [测试配置](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml)。
- 文件存储：V052 扩充用途、可见性、所有者和公私桶元数据，见 [迁移](../../sql/V052__unified_file_metadata.sql)；发布服务含私有媒体提升步骤，具体线上桶策略 `[TODO]`。
- 迁移：当前 [版本清单](../../sql/README.md) 为 V000–V053；dev/prod/test 默认关闭运行时迁移。[fresh-only 脚本](../../scripts/ci-apply-migrations.sh) 显式拒绝 xingyu_hub 和非空库；它不是历史开发库增量升级工具。本次只在测试库应用了 V053，未改开发库、未做生产部署。

## 3) Secrets and Credentials Handling

prod 需注入 DB_USERNAME / DB_PASSWORD，默认是不可用占位符；测试需 TEST_DB_PASSWORD，支持 TEST_DB_URL / TEST_DB_USERNAME。dev 导入本地 properties 的多工作目录路径，见 [dev](../../xingyu-server/xingyu-starter/src/main/resources/application-dev.yml)。本次不读取本地凭据；没有做全历史 secrets 扫描，不能据 YAML 占位符宣称全库无秘密。

[配置控制器](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/system/SysConfigGroupController.java#L295) 标注 RSA 私钥迁出配置 JSON 的 TODO。轮换、独立密钥存储、备份权限 `[TODO]`。种子管理员有已知默认口令，生产配置启用默认口令拒绝策略；守卫运行效果本轮未验证。

## 4) Reliability and Failure Behavior

- Admin Axios 超时 30 秒，见 [request](../../xingyu-admin/src/utils/request.ts)。外部供应商超时、重试、熔断及写操作幂等 `[TODO]`，不将事件重试机制等同第三方调用可靠性。
- [可靠事件消费者](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventConsumer.java) 默认每 5 秒、批量 20、租约 30 秒；失败按次数分钟延迟、达到上限隔离。但 PROCESSING 不在过期重领集合，见 [Mapper](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventMapper.java#L29-L47)，存在崩溃后卡住风险。
- 支付宝与 Apple 登录实现包含 TODO，不能把模块存在解读为完整上线能力，见 [支付宝](../../xingyu-server/xingyu-infra/xingyu-social/src/main/java/top/pxczxn/xingyu/social/impl/AlipayLogin.java)、[Apple](../../xingyu-server/xingyu-infra/xingyu-social/src/main/java/top/pxczxn/xingyu/social/impl/AppleLogin.java)。

## 5) Observability for Integrations

Druid 与应用 SQL monitor 在 dev 启用、prod 关闭；prod 应用包 info/root warn，见 [dev](../../xingyu-server/xingyu-starter/src/main/resources/application-dev.yml)、[prod](../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml)。事件可按状态统计积压，见 [Mapper](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventMapper.java#L61-L67)。集中日志、trace、告警投递、线上 dashboard 与 SLO `[TODO]`，未从源码推断生产监控已具备。

## 6) Evidence

- [基础设施模块](../../xingyu-server/xingyu-infra/pom.xml)、[社区认证](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/interceptor/CommunityAuthInterceptor.java)
- [配置](../../xingyu-server/xingyu-starter/src/main/resources/application-prod.yml)、[迁移说明](../../sql/README.md)、[风险与意图问题](./CONCERNS.md)

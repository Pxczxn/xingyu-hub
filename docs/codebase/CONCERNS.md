# 风险、技术债与后续优先级

口径：**事实**指源码/命令直接可见；**推断**指有证据的后果判断但未运行复现；**未验证**指本轮未覆盖。下面优先级是后续核验建议，不是已证实生产故障或漏洞等级。本轮仅更新分析文档，不修业务代码。

## 1) Top Risks (Prioritized)

| 优先级 | 发现与证据 | 影响与建议 |
|---|---|---|
| 已修复（2026-10-21） | **事实**：[ReliableEventMapper](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventMapper.java) 新增 `reclaimExpiredLeases` / `isolateExpiredLeases`，`ReliableEventConsumer.poll` 每轮先回收过期租约；`updateOutcome` 增加 `lease_until` 栅栏；[V053](../../sql/V053__reliable_event_recovery_index.sql) 补 `(status, lease_until)` 索引 | **验证**：platform 15 项、租约恢复集成 8 项、索引链路 6 项通过。索引实测（20 万行探针表，MySQL 8.0.46 RR）：回收 UPDATE 0.95s → 0.0009s，EXPLAIN 由全索引扫描变 `range/rows=1`；锁实验证明无索引时并发 INSERT 会锁等待超时，加索引后冲突窗口随执行时间降到约 1ms（gap lock 本身未消除）。剩余：handler 仍是 at-least-once |
| 已修复（2026-10-21） | **事实**：契约统一为「已发布文章在重新送审期间仍可发现并阅读旧发布版本」。`ArticleAccessService` 只读 published revision，不再把 `underReview` 传给 `AccessPolicy`；`ArticleTopicMapper`（5 处）、`SearchDocumentMapper`（发现筛选 / 关注流）、`FeedService` 去掉 `article.status='PUBLISHED'` 的二次过滤，统一信任活索引行；`PublishedRevisionMapper` 的空间作品列表补 lifecycle/moderation 排除；个人主页 `articleCount` 改为按「发布版本存在 + lifecycle/moderation」统计；发布（含转 PRIVATE）与移入/移出回收站在写事务内同步刷新索引 | **验证**：新增 `ArticleRevisionVisibilityConsistencyIntegrationTest` 6 项、`ArticleVisibilityIndexWindowIntegrationTest` 3 项（禁用异步消费后验证转 PRIVATE/删除立即从搜索与发现消失、恢复重新出现），回归 7 个测试类共 35 项、用户详情与通知 21 项均通过。剩余：索引写入与业务同事务，索引失败会导致业务回滚（有意的强一致取舍）；跨实例部署时同步刷新只作用于当前实例，但索引在共享库中，仍一致 |
| 中高 | **事实**：uni-app 的 [request](../../xingyu-uniapp/utils/request.js)、[API](../../xingyu-uniapp/utils/api.js)、[socket](../../xingyu-uniapp/utils/websocket.js) 使用固定 localhost、Authorization、旧 admin 聊天与 /ws/message；与现 Web 的社区会话和 socket 不同。更关键的是它依赖的私聊/群聊后端已是空兼容层：[SysChatCompatController:26-29](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/message/SysChatCompatController.java#L26-L29) 对发送返回"已迁移"，history/contacts 返回空 | **推断**：移动端聊天入口点击即失败，不是配置问题而是能力已下线；真机 localhost 也不等于开发电脑。先决定移动端维护目标（下线/迁移到 /api/v1/messages），不要在兼容层上补功能 |
| 中 | **事实**：移动端品牌与项目脱节——`pages.json` 的标题仍是「Mars办公」、主题色为微信绿 `#07C160`，登录页残留 MarsAdmin，manifest 的 appid 为空；管理端 `operation-screen.vue` 无引用、`test/test/index.vue` 无路由 | 不是运行时故障，但直接发布小程序或对外演示会暴露模板痕迹。清理前先确认这些页面是否仍有人用 |
| 中 | **事实**：现 CI 仅 Web job，见 [ci.yml](../../.github/workflows/ci.yml)；Admin build 不 type-check，见 [manifest](../../xingyu-admin/package.json) | 后端、Admin、移动端回归未由该流水线覆盖。补安全隔离的验证门禁，而非直接把写库测试接开发库 |
| 中低 | **事实**：公开系列目录仍列出未发布章节——[SeriesService:425–442](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/SeriesService.java#L425-L442) 的 `toChapterView(chapter, false)` 对无索引文档的章节返回 `title=null`，但条目仍在 `listPublic`/`getPublicById` 结果里；绑定校验 [requireChapterArticlesOwned:336–352](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/SeriesService.java#L336-L352) 只校验存在与归属，不校验发布状态 | 读者在公开目录看到占位章节，点开因无 `published_revision` 得到 404；标题未泄露，但暴露"存在未公开章节"。前端已优雅降级，用户 2026-09-27 决定暂缓后端改动；若要收口，在公开章节列表过滤未发布项，或在绑定阶段拒绝 |

## 2) Technical Debt

- **分层偏差（事实）**：infra 的 pay/push/sms/social/wechat 依赖 core/system，证据分别为 [pay](../../xingyu-server/xingyu-infra/xingyu-pay/pom.xml#L21)、[push](../../xingyu-server/xingyu-infra/xingyu-push/pom.xml#L21)、[sms](../../xingyu-server/xingyu-infra/xingyu-sms/pom.xml#L21)、[social](../../xingyu-server/xingyu-infra/xingyu-social/pom.xml#L21)、[wechat](../../xingyu-server/xingyu-infra/xingyu-wechat/pom.xml#L21)。这是反向耦合，不直接证明 Maven 环；后续可按需求抽低层配置契约，当前不建议无目标大重构。
- **文档漂移（已纠正本组七文档）**：原先双用户前端、旧目录/端口、jsdom、无 lint/CI 的结论不再成立。[App](../../xingyu-web/src/app/App.tsx)、[Vite](../../xingyu-web/vite.config.ts)、[Vitest](../../xingyu-web/vitest.config.ts)、[CI](../../.github/workflows/ci.yml) 是现状证据。原有 [LEGACY-DELTA](./LEGACY-DELTA.md) 是历史快照，所述 archive 路径当前不存在，保留而不当现行指南。
- **未完成适配（事实）**：[AlipayLogin](../../xingyu-server/xingyu-infra/xingyu-social/src/main/java/top/pxczxn/xingyu/social/impl/AlipayLogin.java)、[AppleLogin](../../xingyu-server/xingyu-infra/xingyu-social/src/main/java/top/pxczxn/xingyu/social/impl/AppleLogin.java) 有 TODO；供应商上线状态未确认。
- **测试隔离债（事实）**：Web 2536 测试通过但有 localhost:3000 连接拒绝与 act 警告，见 [验证记录](./TESTING.md)。应消除意外真实网络访问和异步残留，不能只追求绿色摘要。
- **认证状态同步（2026-10-22 修复，同日收口跨标签换号）**：[storage](../../xingyu-web/src/lib/storage.ts#L24-L36) 的 `AUTH_CHANGED_EVENT` 由 [AuthProvider](../../xingyu-web/src/features/auth/auth.store.ts) 订阅，并额外监听跨标签 `storage` 事件：[client](../../xingyu-web/src/api/client.ts#L104-L106) 的 401 清 token、主动退出、其他标签清除都会把 `status/user/token` 同步为 unauthenticated，受保护页面由 `RequireAuth` 立即跳转 `/login`。**跨标签换号**：token 变化时强制重新解析 `/me`，并用单调会话 epoch 丢弃过期响应——A→B 切换会立即替换身份，慢请求不会覆盖较新会话，退出后迟到的 `/me` 也不会复活旧账号；新 token 验证失败会清空会话。**迟到的 401**：`api/client.ts` 只在「当前存储 token 仍是发起请求的 token」时清除，旧账号请求的 401 不会把已切换的新会话踢下线。

## 3) Security Concerns

| 风险事实 | 当前边界与未验证项 | 建议 |
|---|---|---|
| [uni-app crypto:75–99](../../xingyu-uniapp/utils/crypto.js#L75-L99) 明示不验证 GCM tag，并剥离标签；请求基址为 HTTP | 若该分支用于受保护响应，缺少完整性校验；本轮未构造攻击或证明生产可利用 | 在确认仍使用的协议上完整认证解密；不要把“能解密”等同可信 |
| [JobInvokeUtil:18–44](../../xingyu-server/xingyu-job/src/main/java/top/pxczxn/xingyu/job/util/JobInvokeUtil.java#L18-L44) 从数据库 invokeTarget 解析 Bean/方法并反射执行 | [任务 Controller](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/monitor/SysJobController.java) 有 add/edit 等权限；不是匿名 RCE 结论 | 评估任务编辑者实际获得的应用 Bean 调用能力，并考虑 allowlist |
| [SaTokenConfig:111–116](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/config/SaTokenConfig.java#L111-L116) 宽泛 origin patterns + credentials | 利用性依赖部署、凭证传播和浏览器策略，未验证 | 收敛生产信任源并做跨域凭证测试 |
| 管理端响应加密是 fail-open 且只覆盖响应：[EncryptResponseBodyAdvice:95–116](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/advice/EncryptResponseBodyAdvice.java#L95-L116) 缺会话头/会话过期时记 warn 后返回明文；前端 [fetchCryptoConfig](../../xingyu-admin/src/utils/request.ts#L72-L100) 失败即按 `enabled:false` 继续；请求体解密尚未实现 | 不能把"已加密"当成完整性/防重放保证；该链路的实际线上开关状态未验证 | 明确加密的威胁模型（防什么），再决定是否改为 fail-closed 并补齐请求体加密 |
| [SysConfigGroupController:295](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/system/SysConfigGroupController.java#L295) 记录 RSA 私钥迁出配置 JSON TODO；[SysServerServiceImpl:96](../../xingyu-server/xingyu-core/xingyu-system/src/main/java/top/pxczxn/xingyu/system/service/impl/SysServerServiceImpl.java#L96) 有密码存储 TODO | TODO 不是本轮证明的泄露；库权限/备份/加密现状未审计 | 核验真实存储与读权限，再安排独立密钥/凭据管理 |

这不是完整 OWASP 审计或供应链审计；没有验证全部注解代理、权限缓存失效、上传边界与第三方凭证轮换。

## 4) Performance and Scaling Concerns

- **查询结构事实**：[ArticleService:62–66](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleService.java#L62-L66) 列表逐项转 summary，[toSummary:368–369](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleService.java#L368-L369) 每项查 draft；[ArticleMapper:13–18](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/mapper/ArticleMapper.java#L13-L18) 作者列表无 LIMIT。属于 1+N 查询和无界列表结构，未量测慢查询。先记录 SQL 次数和数据量，再批查/分页。
- **审核列表**：[ReviewService:134–157](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ReviewService.java#L134-L157) 每项再查版本/资料，具有查询放大结构，未做容量实验。
- **会话写放大**：[CommunityAccountService:746–760](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/CommunityAccountService.java#L746-L760) 有效请求读 session/user 并更新 lastActiveAt；拦截器还会取用户。容量影响未量测，不能直接声称数据库瓶颈。
- **事件重放**：consumer 多 handler 后统一标成功，前面副作用可能重复；新增邮件/支付 handler 时必须重新评估幂等，不能凭当前搜索“可重建”语义推及所有事件。

## 5) Fragile/High-Churn Areas

近 90 天（2026-07-23 起）分支 `pxczxn` 共 166 次提交，改动集中在用户端。高变动前列：旧目录 `xingyu-web-next/src/router/routes.tsx` 35 次、`xingyu-web-next/src/layouts/AppLayout.tsx` 24 次（这两个路径当前已不存在，是历史改名前的记录）；当前文件里 [DiscoverPage](../../xingyu-web/src/features/discover/pages/DiscoverPage.tsx) 14、[HomePage](../../xingyu-web/src/features/home/pages/HomePage.tsx) 13、home.test 11、[AppLayout](../../xingyu-web/src/layouts/AppLayout.tsx) 10、HomeFeedItem 10、SearchDocumentMapper 9、[PublicSeriesListPage](../../xingyu-web/src/features/series/pages/PublicSeriesListPage.tsx) 8、[PublicSeriesDetailPage](../../xingyu-web/src/features/series/pages/PublicSeriesDetailPage.tsx) 8。含义是：首页/发现/系列三条阅读主线与搜索语义是当前最热的改动区，改动前先读同目录测试。

当前 [routes](../../xingyu-web/src/router/routes.tsx)、[EditorPage](../../xingyu-web/src/features/studio/pages/EditorPage.tsx)、[CommunityAccountService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/CommunityAccountService.java) 有较长实现；长度/变动不是缺陷本身。安全策略：先锁定状态与权限契约，以定向测试支持最小改动，不根据行数机械拆分。扫描共列出 8 条生产 TODO 命中，跨配置凭据和第三方适配；它不是完整缺陷数量，也不包含隐藏/未扫描文件。

## 6) [ASK USER] Questions

1. [ASK USER] 已发布文章重新送审期间，旧发布版本应继续对非作者公开，还是立即下线？这决定访问策略与索引统一方向。
2. [ASK USER] uni-app 仍是当前交付目标吗？若是，目标是下线聊天能力后仅保留资料/登录，还是迁移到 `/api/v1/messages`？空兼容层不应继续承载真实入口。
3. [ASK USER] 管理端 XYC1 响应加密要防的是什么威胁（防抓包读明文，还是防篡改/重放）？当前设计只加密响应且缺头时降级明文，若目标含完整性与抗重放，需要另立改造。
4. [ASK USER] 下一轮优先验证可靠事件崩溃恢复，还是补齐后端/Admin CI？默认建议先验证前者，再建立对应回归门禁。

## 7) Evidence

主要证据已逐项链接；另见 [架构](./ARCHITECTURE.md)、[认证与集成](./INTEGRATIONS.md)、[确切测试命令](./TESTING.md)。未运行数据库、并发、进程崩溃、浏览器、真机或生产攻击验证。需求与实现的差异还包括“定时发布”当前实际送审；是否改为直接公开必须由产品规则决定。

# 架构与核心业务链路

## 1) Architectural Style

**已确认：前后端分离的模块化单体，而非微服务集群。** [starter](../../xingyu-server/xingyu-starter/pom.xml) 组装 API 与平台模块，由 [Spring Boot 入口](../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/XingyuHubApplication.java) 同进程启动。Java 内部采用 Controller → Service → Mapper，前端按领域拆分，数据库可靠事件承接异步索引更新。

关键约束：社区与管理端身份体系分开；正文区分可编辑草稿、冻结版本、发布指针；内容可见性同时受编辑流程、生命周期、治理状态影响。不能用 article.status 一个字段解释所有访问行为。

## 2) System Flow

```text
React 创作台 → 社区 Controller → Service → MyBatis Mapper → MySQL
                         ↓ 可靠事件表
Vue 审核台 → 管理 Controller → 审核/发布 Service
                         ↓
发布指针 → 正式版本 → 访问策略 → 公开阅读
可靠事件定时消费 → SearchIndexEventHandler → 重建搜索文档
```

### 文章链路（源码抽样贯通，不是本轮 HTTP 验收）

1. **建稿与保存**：[EditorPage](../../xingyu-web/src/features/studio/pages/EditorPage.tsx#L361-L405) 调 API；[CommunityArticleController](../../xingyu-server/xingyu-api/xingyu-community-api/src/main/java/top/pxczxn/xingyu/web/controller/CommunityArticleController.java#L47-L81) 将建稿、存草稿、送审交给服务。[ArticleService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleService.java#L69-L93) 插入 Article 与 WorkingDraft，初始 PRIVATE、lockVersion=0。
2. **乐观并发**：[保存方法](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleService.java#L133-L211) 检查作者，并在 UPDATE 的 WHERE 带 article_id + lock_version；更新行数为 0 抛冲突。只更新请求提供的键，显式 null 可清空；响应重读数据库，不是简单回显请求。
3. **送审冻结**：[ReviewService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ReviewService.java#L46-L93) 从草稿生成 FormalRevision 与 PENDING ReviewSubmission，将文章置 IN_REVIEW 并产生事件。
4. **审核裁决**：[管理审核页](../../xingyu-admin/src/views/community/review/index.vue) → [AdminReviewController](../../xingyu-server/xingyu-api/xingyu-admin-api/src/main/java/top/pxczxn/xingyu/admin/controller/community/AdminReviewController.java) → [decide](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ReviewService.java#L221-L270)。WHERE status=PENDING 的条件更新防重复裁决；批准交给 PublicationService。
5. **发布与读取**：[PublicationService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/PublicationService.java#L31-L84) 提升媒体并更新 PublishedRevision 指针；[ArticleAccessService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ArticleAccessService.java#L57-L96) 读取指针对应 FormalRevision，结合 [AccessPolicy](../../xingyu-server/xingyu-common/src/main/java/top/pxczxn/xingyu/common/contract/access/AccessPolicy.java) 判权。公开正文不直接读取 WorkingDraft。该判定自 2026-10-19 起是公开读取的**唯一入口**：[ReadingService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/ReadingService.java#L155) 的系列阅读进度也调用 `isReadable`，不再保留第二套可见性判断；[SearchIndexService](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/service/SearchIndexService.java#L161-L190) 仍是独立路径：按生命周期与治理状态判断公开性，并把 `underReview` 固定传 false。
6. **异步派生**：[事件支持](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/support/CommunityEventSupport.java#L68-L87) → 独立 [Publisher](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventPublisher.java#L22-L39) → [Consumer](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventConsumer.java) → [SearchIndexEventHandler](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/support/SearchIndexEventHandler.java)。索引根据最新聚合状态重建，不是把事件增量无条件累加。

## 3) Layer/Module Responsibilities

- API 层负责路由、参数、身份上下文和响应；[ApiPrefixConfig](../../xingyu-server/xingyu-starter/src/main/java/top/pxczxn/xingyu/api/ApiPrefixConfig.java) 为 admin 包加 /api/v1/admin，社区 web/api 包加 /api/v1。
- Service 层负责文章、账号、审核、治理等用例，Mapper 负责条件 SQL 与持久化。例如 [WorkingDraftMapper](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/mapper/WorkingDraftMapper.java)。
- platform 可靠事件与 job Quartz 是两套后台机制；[ScheduledArticlePublishTask](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/task/ScheduledArticlePublishTask.java) 到期调用 submitScheduledDraft，**实际送审而非直接公开发布**。
- 理想分层不是现状：pay/push/sms/social/wechat 有对 core/system 的 Maven 依赖，见 [pay POM](../../xingyu-server/xingyu-infra/xingyu-pay/pom.xml#L21)。这证明反向耦合，不单独证明依赖环。

### 管理端响应链路（可选加密层）

管理端是唯一启用响应加密的一端：前端 [request.ts](../../xingyu-admin/src/utils/request.ts#L250-L298) 建立加密会话后，每个请求带 `X-Crypto-Session-Id` 与 `X-Crypto-Request-Id`；后端 [EncryptResponseBodyAdvice](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/advice/EncryptResponseBodyAdvice.java#L41-L116) 在配置启用时把 `Result.data` 换成 XYC1 信封，明确排除 community 包控制器，且缺少会话头时**跳过加密而不是报错**。请求体解密尚未实现，[DecryptRequestBodyAdvice](../../xingyu-server/xingyu-infra/xingyu-crypto/src/main/java/top/pxczxn/xingyu/crypto/advice/DecryptRequestBodyAdvice.java) 注明留待下一阶段。因此"响应加密"不等于"全链路加密"，也不能据此推断防重放或前向安全已经在线生效。

## 4) Reused Patterns

- 乐观版本号与条件 UPDATE：草稿并发、审核裁决、定时认领。
- 不可变正式版本与发布指针：隔离正在编辑的正文与公开正文。
- Spring 注入独立 Publisher、数据库 outbox、可重建索引：降低主业务与派生读取耦合。
- React Provider：集中认证、聊天连接、通知；Vue Pinia：存储 token 并加载权限/菜单。

事务边界只确认源码设计：外层 Service 和独立 Publisher 标注 Transactional，未见该发布路径使用 REQUIRES_NEW；尚未实测代理、同一数据源、提交回滚及隔离级别，**不能声称已证明业务与事件原子提交**。定时送审内部自调用位于外层 public Transactional 方法内，不能仅凭自调用就认定没有事务。Quartz 的 DisallowConcurrentExecution 限制以 JobKey 为语义边界，未验证集群锁。

## 5) Known Architectural Risks

- 事件租约恢复（2026-10-21 修复）：[Mapper](../../xingyu-server/xingyu-core/xingyu-platform/src/main/java/top/pxczxn/xingyu/core/event/ReliableEventMapper.java) 现在每次 poll 前先回收过期租约——`attempt_count + 1 < max_attempts` 的 PROCESSING 降为 FAILED 并退避 60 秒，超限的直接 ISOLATED；outcome 写入带 `lease_until` 栅栏，失去租约的 worker 结果被丢弃（0 行）。[V053](../../sql/V053__reliable_event_recovery_index.sql) 补了 `(status, lease_until)` 索引：20 万行实测回收 UPDATE 0.95s → 0.0009s（EXPLAIN 从全索引扫描变 `range/rows=1`）。RR 下 gap lock 仍在，但持锁窗口等于执行时间，已从秒级降到毫秒级。
- 事件 handler 副作用与最终 SUCCESS 标记没有整体事务；某 handler 失败会重跑之前的 handler，不应称 exactly-once。
- 文章可见性契约（2026-10-21 统一）：已发布文章在重新送审期间仍可发现并阅读**旧发布版本**。读取侧不再把 `underReview` 传给 `AccessPolicy`；话题内容、发现筛选、关注流、空间作品去掉 `article.status='PUBLISHED'` 的二次过滤，统一信任活索引行（空间作品列表无索引兜底，改为显式 lifecycle/moderation 条件；个人主页文章数同一口径）。首次送审（无发布版本）仍 404。**状态收紧同步生效**：发布（含改为 PRIVATE）、移入/移出回收站、治理隐藏/恢复都在写事务内同步 `searchIndexService.refresh`，不再把「详情已拒绝、搜索仍返回标题」留给 5 秒事件轮询；可靠事件仅作兜底。

## 6) Evidence

主要证据已随链路逐项链接；另见 [领域实体](../../xingyu-server/xingyu-core/xingyu-community/src/main/java/top/pxczxn/xingyu/community/entity/Article.java)、[访问策略](../../xingyu-server/xingyu-common/src/main/java/top/pxczxn/xingyu/common/contract/access/AccessPolicy.java)、[认证与集成](./INTEGRATIONS.md)。本轮未运行服务端、事务实验、并发实验或端到端发布流程。

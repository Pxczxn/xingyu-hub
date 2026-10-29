# 测试与验证状态

## 0) 2026-10-29 当前基线（优先于下方历史记录）

- 后端全量：在 `xingyu-server` 下 `mvn test -Dstyle.color=never`，测试库 `xingyu_hub_test` 先用 `bash sql/rebuild-test-db.sh` 重建。最近一次 fresh DB 结果：**370 tests / 0 failures / 0 errors / 0 skipped，34:51，BUILD SUCCESS**。
- 后端定向：`mvn test -Dtest=类名1,类名2 -Dsurefire.failIfNoSpecifiedTests=false -pl xingyu-starter -am`。`-pl` 必须带 `-am`，否则会解析本地仓库里的旧核心模块 jar。
- 前端：`npm test` 223 个文件 / 2617 个测试通过；`npm run typecheck`、`lint`、`format:check`、`build`、`check:bundle` 通过。
- CI 已按路径拆分：
  - `.github/workflows/ci-web.yml`：`xingyu-web/**` 变更触发，跑 typecheck/lint/format/test/build/bundle。
  - `.github/workflows/ci-server.yml`：`xingyu-server/**`、`sql/**`、`scripts/**`、`.gitattributes` 变更触发，使用 MySQL 8 + Redis 7，`SET GLOBAL time_zone='+08:00'`、`TZ=Asia/Shanghai`，先重建测试库再跑 `mvn -B test`。
  - `.github/workflows/ci-admin.yml`：`xingyu-admin/**` 变更触发，用 Node 24 跑 `npm run test:audit`（5/5）与 `npm run build`。Node 24 是必要的：naive-ui 2.43.2 的 ESM named exports 在 Node 22 的解析下会报 `does not provide an export named 'NButton'`。
- `xingyu-admin` 的 `npm run type-check` 仍有 85 个历史 TS 错误（未使用变量/类型不匹配等），暂不纳入 CI；清理后再加 type-check step。Windows 本地 `npm run build` 若报 `esbuild ... Access is denied`，把 `TMP`/`TEMP` 指到可写目录即可，CI 的 Ubuntu runner 不受影响。
- `xingyu-uniapp` 没有测试脚本/依赖安装目录，未纳入 CI。
- 测试依赖：Spring Boot 3.2.2 BOM 默认的 Mockito 5.7.0 / ByteBuddy 1.14.11 在 Temurin 21.0.13 上 inline mock maker 无法启动；`xingyu-server/pom.xml` 已显式覆盖为 Mockito 5.24.0 / ByteBuddy 1.18.16。
- 测试库新鲜度：全量套件必须从重建后的 `xingyu_hub_test` 开始；连续跑会累积 `search_document` 行，把 `DiscoverCursorIntegrationTest` 的探针挤出 10 页窗口，表现为与代码无关的分页失败。

## 1) Test Stack and Commands

| 工程 | 测试工具与命令 | 证据 |
|---|---|---|
| Web | Vitest（声明 ^3.0.5，本轮运行 3.2.7）、Testing Library、happy-dom；npm test / npm run typecheck | [manifest](../../xingyu-web/package.json)、[配置](../../xingyu-web/vitest.config.ts) |
| Admin | Node 内置 node:test；npm run test:audit 仅运行 admin-data-audit.test.mjs | [manifest](../../xingyu-admin/package.json) |
| Backend | Spring Boot Test、JUnit 等；cwd xingyu-server 下 `mvn test`（全量，先重建 xingyu_hub_test）；定向用 `-pl xingyu-starter -am` | [starter POM](../../xingyu-server/xingyu-starter/pom.xml)、[application-test.yml](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml) |
| uni-app | 未检出 package 测试脚本；HBuilderX/真机验收 `[TODO]` | [manifest](../../xingyu-uniapp/package.json) |

服务端测试可能写库，不能在未准备隔离环境时盲跑；下列通过结果仅来自本轮确切执行的前端命令。

## 2) Test Layout

Web 按 `src/**/*.{test,spec}.{ts,tsx}` 扫描，setup 为 [vitest.setup.ts](../../xingyu-web/vitest.setup.ts)。示例有 [API client](../../xingyu-web/src/api/client.test.ts)、[路由](../../xingyu-web/src/router/routes.test.tsx)、[编辑器](../../xingyu-web/src/features/studio/editor-page.test.tsx)。

Admin 放在 tests 目录：[审计测试](../../xingyu-admin/tests/admin-data-audit.test.mjs)、[dashboard 源码测试](../../xingyu-admin/tests/dashboard-source.test.mjs)、[治理逻辑测试](../../xingyu-admin/tests/governance-status.logic.test.mjs)。后两组不在 test:audit 脚本内，需要显式执行。注意断言强度不同：dashboard-source 是纯源码字符串断言（只证明文件里出现了某个调用名），governance-status.logic 导入真实逻辑模块断言队列类型与端点，admin-data-audit 里既有正则扫源码也有导入 `table-cells` 的跨时区日期断言。

Java 分模块 src/test/java，共 84 个测试源文件；starter 集成测试使用 [application-test.yml](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml) 与 [TestDatabaseGuard](../../xingyu-server/xingyu-starter/src/test/java/top/pxczxn/xingyu/TestDatabaseGuard.java)。不沿用旧文档过时的测试文件数量。

## 3) Test Scope Matrix

| 范围 | 当前证据 | 状态 |
|---|---|---|
| Web 类型 | tsc --noEmit | 最近记录通过（2026-10-20） |
| Web API/组件/路由 | Vitest | 218 个测试文件；最近记录 2536 条通过 |
| Admin 审计/日期 | node:test | 5/5 通过（2026-10-20） |
| Admin dashboard 源码/治理逻辑 | node:test | 6/6 通过（2026-10-20） |
| Backend 单元/集成 | 84 个测试源文件，存在分层测试和隔离配置 | 部分运行（2026-10-21，见下） |
| HTTP、事务/并发、浏览器、真机 | 需运行环境与目标数据 | 未验证 |

> 2026-10-21 分两步：上午只做源码核对、未跑测试；下午修复 outbox 租约恢复后跑了 platform 全量测试、两个 outbox 恢复集成测试类与两个索引链路集成测试（真实 MySQL 测试库）。Web/Admin 的数字仍来自 2026-10-20；代码自那之后没有 web/admin 改动。

### 2026-10-22 系列创作者管理体验审计（cwd xingyu-web）

- 调查结论：章节编排页面已经具备本地草稿 + 全量替换保存（`PUT /me/series/{id}` + `lockVersion`）、上移/下移 + 拖拽、移除撤销、409 冲突不覆盖本地、保存后回读校验、`useBlocker` + `beforeunload` 双层离开保护；后端 `PUT /me/series/{id}/chapters` 契约测试已覆盖重排/清空/重复/越权。
- 修正：保存成功后清除“已移除…撤销”入口（此前该提示会残留，让已持久化的移除看起来仍可本地撤销）。
- 测试：`npx vitest run src/features/series` → **140 passed**（新增 `drops the undo affordance once the removal is persisted`）；`npm run typecheck` 无输出；`eslint` 两文件 exit 0；回归 `src/features/series src/features/studio src/router` → **59 files / 665 tests passed**。
- 浏览器验证（Playwright + vite dev + API route mock，临时目录已删除）：2 章列表 → 移除第一章出现撤销与“有未保存的修改” → 保存提交 `{chapterArticleIds:["a2"],lockVersion:3}`，撤销入口消失、剩 1 章 → 再移除最后 1 章 → 点击“返回系列管理”被拦截（URL 不变、弹窗文案正确）→ 点“留在本页”后仍在编排页且本地 0 章状态保留。

### 2026-10-22 跨标签切换账号的认证一致性（cwd xingyu-web）

- `auth.flow.test.tsx` 新增 4 项：另一标签以 B 登录后身份从 A 替换为 B；新 token 验证失败清空会话；B 的 `/me` 迟到而 C 已就绪时不覆盖 C；退出后迟到的 `/me` 不复活会话。
- `client.test.ts` 新增 1 项：旧 token 发起的请求迟到返回 401 时，不得清掉已经切换的新 token。
- 对照：把 `sync` 临时改回“已认证则忽略 token 变化”，4 项全部失败（`Tests 4 failed | 11 passed`）；把 401 条件改回不比较当前 token，client 用例失败（`expected null to be 'token-b'`）。恢复后 **31 passed**（client 10 + auth.flow 15 + guards 6）。
- 命令与结果：`npx vitest run src/api/client.test.ts src/features/auth/auth.flow.test.tsx src/router/guards.test.tsx` → 31 passed；`npm run typecheck` 无输出；`eslint` 五文件 exit 0；`npx vitest run src/api src/features/auth src/router src/lib src/layouts` → **94 files / 738 tests passed**。

### 2026-10-22 Web 认证状态同步（cwd xingyu-web）

- 新增/扩展 `src/features/auth/auth.flow.test.tsx`：401 清 token 后 UI 转 unauthenticated、并发 401 不产生额外 `/me` 请求、跨标签清除与跨标签登录、以及“外部 token 被 adopt”共 4 项。
- `src/router/guards.test.tsx`：受保护页面在会话失效后立即重定向 `/login`。
- 命令：`npx vitest run src/features/auth/auth.flow.test.tsx src/router/guards.test.tsx` → **17 passed**；`npm run typecheck` 无输出；`npx eslint` 三个改动文件 exit 0。
- 回归：`npx vitest run src/features/auth src/router src/lib src/layouts` → **58 files / 340 tests passed**（stderr 仍有既有的 `ECONNREFUSED :3000`，与本次无关）。
- 未做浏览器端验证；未跑全量 `npm test`。

### 2026-10-21 索引窗口审计（禁用异步消费后的确定性验证）

- 新增 `ArticleVisibilityIndexWindowIntegrationTest`：**3 passed / 0 failed**。用 `@MockBean ReliableEventConsumer` 关闭异步索引，验证：
  - 转 PRIVATE 并批准后，详情 404 的同时搜索/话题/发现立即不含（修复前会继续返回标题）；
  - 删除后同上；恢复后立即重新可发现。
- 回归 7 个测试类（窗口 + 可见性一致性 + 系列可见性 + 文章流程 + 索引管线/维护 + 事件恢复）：**35 passed / 0 failed**。
- 结论：状态收紧不再依赖 5 秒轮询；异步可靠事件仍保留为兜底。

### 2026-10-21 文章可见性一致性验证（cwd xingyu-server，test profile）

- 新增 `ArticleRevisionVisibilityConsistencyIntegrationTest`：**6 passed / 0 failed**。覆盖首次发布、重新送审（详情/搜索/话题/发现/空间/关注流）、审核通过、审核拒绝、治理隐藏、PRIVATE。
- 更新 `SeriesReadingProgressVisibilityIntegrationTest` 的旧契约断言（已发布 + 送审现在对读者可读）：**4 passed / 0 failed**。
- 回归 11 个测试类：`ArticleFlowIntegrationTest`、`SeriesReadingProgressIntegrationTest`、`SearchIndexPipelineIntegrationTest`、`SearchIndexMaintenanceIntegrationTest`、`EventsCorrectnessRecoveryIntegrationTest`、`DiscoverFilterIntegrationTest`、`FollowingFeedBaselineIntegrationTest`、`CommentPreviewTest`、`TopicContentEnrichmentIntegrationTest` 等，合计 **55 passed / 0 failed**，BUILD SUCCESS。
- 个人主页计数与用户详情回归：`NotificationContractIntegrationTest` 9 项、`Batch4IntegrationTest` 1 项，连同两个可见性测试类共 **21 passed / 0 failed**。
- 构建注意：`xingyu-community-api` 必须重新 `install`，否则 starter 用本地仓库旧 jar，`GET /me/series/{id}/reading-progress` 会 404（本次实际踩到）。

### 2026-10-21 outbox 修复验证（cwd xingyu-server，test profile 指向 xingyu_hub_test）

- `mvn -o -pl xingyu-core/xingyu-platform test`：**15 passed / 0 failed**（含 `ReliableEventConsumerTest` 5 项）。
- `mvn -o -pl xingyu-starter test -Dtest=ReliableEventLeaseRecoveryIntegrationTest`：**6 passed / 0 failed**（过期回收、未过期不动、超限隔离、fencing、并发认领、并发回收）。
- `mvn -o -pl xingyu-starter test -Dtest=ReliableEventRecoveryEndToEndIntegrationTest`：**2 passed / 0 failed**（真实 consumer 从崩溃遗留恢复到完成；崩溃循环在 max_attempts 处隔离）。
- 回归：`SearchIndexPipelineIntegrationTest` **4 passed**、`SearchIndexMaintenanceIntegrationTest` **2 passed**，正常事件消费与索引维护未受影响。
- 环境：Java 21.0.11、Maven 3.9.16、本机 MySQL 3306、Redis 6379；库名由 `TestDatabaseGuard` 校验。未跑全量后端测试，未做生产规模数据量测。

### 2026-10-21 V053 索引验证（测试库手工执行）

- 迁移 `sql/V053__reliable_event_recovery_index.sql` 连续执行两次均退出码 0；第二次走 `SELECT 1` 分支，索引未重复创建（幂等）。
- `SHOW INDEX` 确认 `idx_reliable_event_status_lease (status, lease_until)`；`EXPLAIN` 回收 UPDATE 从 `type=index/PRIMARY/rows≈199066` 变为 `type=range/rows=1`。
- 20 万行探针表实测（MySQL 8.0.46，REPEATABLE READ）：回收 UPDATE 0.946s → 0.000926s；`findClaimable` 0.320s → 0.006s（含 filesort，匹配 2 行）。
- 锁实验：一个会话执行回收 UPDATE 并保持事务 4 秒，另一会话 `innodb_lock_wait_timeout=2` 插入 PENDING 事件——无索引时 `ERROR 1205 Lock wait timeout exceeded`，有索引后冲突窗口等于执行时间（约 1ms）。结论：索引不消除 RR gap lock，但把持锁窗口从秒级降到毫秒级。
- 探针表 `zz_probe_reliable_event` 已在验证后删除；测试库 `reliable_event` 保留 V053 索引。开发库未执行该迁移。

### 最近一次前端确切命令与结果（2026-10-20）

- cwd xingyu-web：`npm run typecheck; npm test`。类型检查输出无错误；Vitest **218 passed / 2536 passed**，耗时 69.58 秒。
- cwd xingyu-admin：`npm run test:audit`。**5 passed / 0 failed**。
- cwd xingyu-admin：`node --test tests/dashboard-source.test.mjs tests/governance-status.logic.test.mjs`。**6 passed / 0 failed**（只读子代理执行后，主代理独立复跑同样通过）。
- 环境：Node v24.18.0、npm 11.16.0；没有安装依赖、修改测试或启动替代服务器。

**日志不干净**：Web 虽通过，仍出现 `ECONNREFUSED ::1:3000`、`ECONNREFUSED 127.0.0.1:3000`，以及 React 更新未包裹 act(...)、KaTeX quirks-mode 等警告。这表明部分测试有未隔离网络请求或异步收尾问题；通过不能证明这些分支或真实接口可用。畸形 URL 测试中的解码警告可能是预期输入，不能把所有 stderr 一概视为业务故障。

## 4) Mocking and Isolation Strategy

Web 使用 Vitest mock 与 Testing Library，但本轮网络日志说明隔离并不完全。Admin dashboard 部分断言检查源码字符串，只能证明静态约束，不能证明页面状态、网络和数据库联动。

服务端 test profile 显式选择 xingyu_hub_test、专用账号、Redis db7，与 dev 的业务库和 db6 分离；运行期数据库守卫检查实际连接目标。需要 TEST_DB_PASSWORD，schema migration 关闭，测试前由重建脚本准备结构。见 [test profile](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml)、[重建工具](../../sql/rebuild-test-db.sh)。本轮未验证守卫触发、权限或测试前后数据库快照，不声称已证明数据库零变化。

## 5) Coverage and Quality Signals

[CI](../../.github/workflows/ci.yml) 已存在，用户端依次 npm ci、typecheck、lint、format:check、test、build、bundle budget；旧文档“无 GitHub Actions”不符合现状。该工作流未定义后端、管理端或移动端 job；本地脚本存在不等于已接入 CI。线上最近流水线状态 `[TODO]`。

代码覆盖率比例/阈值 `[TODO]`，未运行覆盖率报告。测试通过数量不表示覆盖全部需求。未执行 lint、format:check、构建、bundle budget、Admin type-check、服务端 Maven 测试、数据库迁移、浏览器/真机和第三方调用，因此不能宣称全项目可启动或完整验收。

## 6) Evidence

- [Vitest 配置](../../xingyu-web/vitest.config.ts)、[Web scripts](../../xingyu-web/package.json)
- [Admin tests](../../xingyu-admin/tests/admin-data-audit.test.mjs)、[test profile](../../xingyu-server/xingyu-starter/src/test/resources/application-test.yml)
- [CI](../../.github/workflows/ci.yml)、[风险](./CONCERNS.md)

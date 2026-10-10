# Studio Static Design Final Fix — Acceptance Report

> 2026-10-09 · CB-1 / CB-2 / SB-1 + 两项有限视觉修整全部实施并验证。
> 隔离 test 环境真实浏览器取证（1440/768/390/320 四档）；fixture 已清零、隔离服务已停止。
> 未 commit；未触碰 dev 数据；历史 WIP（273 个文件）与外部 web-v2 提交全程未动。

---

## 1. 修复前后证据

### CB-1 内容管理页"审核中/被退回"
- **修复前**（浏览器实测）：1 篇 IN_REVIEW 时计数卡"审核中=0"、`?tab=reviewing` 显示"没有审核中的文章"；"被退回" tab 永久空（article.status 不存在 RETURNED）。
- **修复后**（同环境实测）：计数卡 `1 已发布 / 2 草稿 / 1 审核中 / 1 被退回`；"审核中" tab = [审核中文章]；"被退回" tab = [被退回文章]；"草稿" tab = [普通草稿文章, 被退回文章]（被退回文章同时是 DRAFT——重叠语义符合真实状态，普通 DRAFT 未被误标）。

### CB-2 系列编排草稿章节标题
- **修复前**（实测）：`GET /me/series/{id}` chapters 对草稿章节 `title=null` → 编排页显示"无标题文章"+裸 articleId。
- **修复后**（实测 API + 编排页 UI）：`chapters = [{t:"已发布文章",pos:1},{t:"普通草稿文章",pos:2}]`；编排页 UI 同步显示真实标题，顺序与 position 不变。

### SB-1 移动端编辑器溢出
- **修复前**（实测）：390px overflow=285px，元凶 `_toolbarCombined_`（702px，内含 nowrap 的 `_formatBar_` 475px）。
- **修复后**（CDP 设备仿真逐档实测）：

| viewport | overflow | 关键控件 |
|---|---|---|
| 320 | 0 | 正文编辑器在、保存/提交/预览同排可见（y=96）、模式切换换行第二行可达（y=171）；MARKDOWN 真实输入 → 保存 → DB 含 "320OK" ✅ |
| 390 | 0 | RICH_TEXT 真实键盘输入 → DB 含 "RICH390" ✅；"已保存"反馈真实 |
| 768 | 0 | 保存/送审入口可达 |
| 1440 | 0 | 布局无退化，工具栏标题可见 |

### 排障说明（如实记录）
CB-2 运行时复验初查返回 null，根因是 **7788 后端 spring-boot:run 未带 `-am`，xingyu-community 依赖解析自 ~/.m2 的过时 jar**（workspace 新 class 未进 classpath）——集成测试（`-am`，reactor 内新 class）通过而运行时不一致。处置：`-am install -DskipTests` 将含修复的模块 jar 同步进 m2 后重启，运行时与测试一致。此坑已登记（dev 后端启动命令同源风险）。

## 2. "被退回"筛选的最终处理

**保留并最小接通（非隐藏）**：`GET /me/submissions?limit=N` 的 `limit` 是客户端参数（无分页游标），单创作者送审量级下 `limit=200` 即事实全量历史（默认 20 不满足契约）。前端 `collectReturnedArticleIds`（content-list.ts:147-166）按"每篇文章最新一条 submission 是否 REJECTED/RETURNED"判定；普通 DRAFT 永不混入（有专项测试钉死）。**残余限制如实登记为 Product Debt**： submissions 无分页协议，">200 条送审历史的极早期驳回"不在窗口内；若未来需要协议级全量，需后端游标（不做复杂后端扩展）。

## 3. 两项有限视觉修整

- **危险操作区分**：ContentListPage "移入回收站"按钮 `text-muted-foreground` → **`text-destructive hover:opacity-80`**（实测 DOM class），与 SubmissionDetail 撤回/categories 删除的 destructive 语言一致；确认机制与业务行为未动。
- **Analytics 口径**：核实 `insights.draftCount`（MeEngagementService:36，按 article.status 统计、**含回收站 DRAFT**）与"稿件状态"卡（`/me/articles`，不含回收站）为**不同口径且都真实**。最小修：标签改为"草稿（含回收站）"（StudioAnalyticsPage.tsx:98-101，含口径注释）+ 测试同步更新。未改任何统计 SQL。

## 4. 测试结果

| 套件 | 结果 |
|---|---|
| 后端：StudioSeriesChapterTitleIntegrationTest（新增，5 项断言：草稿回退标题/正式标题/非作者404/公开不泄露/顺序） | 1/1 ✅ |
| 后端：StudioSchedulingRecovery + StudioDraftPersistenceRecovery（既有） | 6/6 + 8/8 ✅ |
| 后端：ArticleFlow + ArticleSeriesContext + SchemaGuard | 1+1+2 ✅（**合计 19/19**） |
| 前端：content-list.test.ts（新增 IN_REVIEW/collectReturnedArticleIds 用例，重写 returned 契约用例）+ content-list-page.test.tsx（补 submissionsApi mock） | 55/55 ✅ |
| 前端定向（studio+series+router 全部） | **539/539** ✅ |
| tsc --noEmit / ESLint | 0 错误（33 个既有 warning，非本轮引入） |
| 前端全量 | **2324/2324** ✅（含本轮新增 6 例） |

失败甄别记录：集成测试首跑公开侧断言失败=发布→搜索索引为异步 outbox 链路，测试补 `drainReliableEvents()`（与 SearchIndexPipelineIntegrationTest 同法）后通过——非产品缺陷；前端页面测试首跑失败=新依赖 submissionsApi 未 mock（ECONNREFUSED 挂起），补 mock 后通过；countByStatus 用例首跑失败=测试数据缺 id，修正用例。**无删除断言、无 Mock 制造通过。**

## 5. 清理证据

- 隔离服务：7788（java PID 55008）与 7777（node PID 13020）**进程身份核实后停止**，两端口归零。
- fixture：`ffix%` / `sbfix%`（含此前 `ssadesign%`）用户及 15 表关联数据级联删除，复检 **users/arts/series = 0/0/0**。
- 临时文件：`.tmp-ffix-fixture.mjs`、`.tmp-sb1-fixture.mjs`、`.tmp-sb1-backend.log`、`.tmp-sb1-vite.log`、`.tmp-vite-audit.config.ts`、`.tmp-vite-audit.log` 已删除。

## 6. 实际变更文件范围（全部未 commit）

**后端（1 个，叠加于既有 WIP 之上）**
- `xingyu-community/.../service/SeriesService.java`：注入 WorkingDraftMapper + `toChapterView(chapter, includeDraftTitle)`（owner=true 回退 working_draft.title / public=false 保持 null）。

**前端（5 个）**
- `src/features/studio/content-list.ts`：isReviewing + IN_REVIEW；filterByTab/countByStatus 接 returnedIds；新增 collectReturnedArticleIds。
- `src/features/studio/pages/ContentListPage.tsx`：双数据源（articles+submissions@200）、trash 按钮 destructive、计数/筛选传参。
- `src/features/studio/editor/editor-workspace.module.css`：.toolbarCombined/.formatBar wrap。
- `src/features/studio/pages/StudioAnalyticsPage.tsx`：草稿标签口径注明。
- 测试：`content-list.test.ts`、`content-list-page.test.tsx`、`studio-analytics-page.test.tsx`。

**新增测试文件（1 个）**：`xingyu-starter/src/test/.../StudioSeriesChapterTitleIntegrationTest.java`。

## 7. 尚未解决的 Product Debt

1. "被退回"窗口边界：submissions 无分页协议，>200 条送审的极早期驳回不可见（需后端游标，暂不做）。
2. 编辑器图片上传占位、协作 accept 不落库、回收站无永久删除、分类无排序、编排无移除控件（既有，未动）。
3. `/files/**` 无鉴权静态直出（既有设计，隐私敏感场景需产品重审）。
4. dev 后端 `spring-boot:run` 无 `-am` 时同样存在 m2 过时 jar 风险（本轮实测踩坑；建议后续统一启动脚本带 -am 或改 install 流程）。

---

# Studio Seal Final Closure（2026-10-09 深夜）

## 被退回筛选：暂时隐藏（最终处理）

按裁决执行：「被退回」Tab、计数卡与 submissions 辅助请求**全部下线**。
原因（与裁决一致）：`GET /me/submissions` 无分页协议，任何客户端窗口都是**有限数据伪装成全量**；
且 article 行永不出现 RETURNED 状态（驳回后回 DRAFT），该筛选的正确实现需要"每篇文章最新审核结果"
的完整后端查询能力。`filterByTab` 无 returned 分支（TypeScript 穷尽 switch 编译期保证）。
**恢复条件（Product Debt）**：后端提供能正确识别每篇文章最新审核结果的完整查询后，恢复 Tab 与计数。
被驳回的稿件数据无损——status 仍为 DRAFT，正常出现在「草稿」Tab（测试钉死）。

## 本轮（Seal Closure）变更文件

- `xingyu-web/src/features/studio/content-list.ts`：CONTENT_TABS 五项（去 returned）+ 弃用注释、
  ContentTab/ContentCounters 收窄、filterByTab/countByStatus 去 returned 分支、删除 collectReturnedArticleIds。
- `xingyu-web/src/features/studio/pages/ContentListPage.tsx`：恢复单请求（去 submissions）、移除被退回计数卡
  （含口径注释）与 emptyTitle/emptyHint 的 returned 分支。
- 测试同步：`content-list.test.ts`（CONTENT_TABS 五项断言 + "returned 不可作为 Tab"防回归断言 + 移除
  collectReturned describe）、`content-list-page.test.tsx`（移除 submissionsApi mock）。

## 验证结果（本轮真实执行）

- 前端定向：content-list.test.ts + content-list-page.test.tsx **52/52** ✅
- 前端定向全套（studio+series+router）：**536/536** ✅（telemetry：清理前后各跑一次）
- `tsc --noEmit`：**0 错误**（抓到并修复两处残留：ContentListPage emptyTitle/emptyHint returned 分支、
  测试中 "returned" 与 ContentTab 的无效比较）
- ESLint：0 错误（33 个既有 warning）
- 防回归：CONTENT_TABS 不含 returned（untyped 字符串比较断言）；IN_REVIEW 识别、系列标题回退、
  响应式 wrap、destructive 按钮、口径标签全部保留。

## 排障记录

定向单测首跑 collect 阶段报 `123:3 Expected ";" but found ")"`——esbuild 报错属实：
Seal Closure 某次 Edit 边界失误把 filterByTab items 结尾 `];` 写成了 `]);`（语法错误），
而 Seal 轮验证缺失使其未暴露。修复 `]);` → `];` 后全绿。**「工具通道污染」假设正式撤回**：
esbuild/磁盘/Read 三方一致，语法错误真实存在且已修复。

## Product Debt（累积登记）

1. 被退回筛选：需后端"每篇文章最新审核结果"完整查询后恢复（本轮隐藏）。
2. 编辑器图片上传占位、协作 accept 不落库、回收站无永久删除、分类无排序、编排无移除控件（既有）。
3. `/files/**` 无鉴权静态直出（既有设计）。
4. `spring-boot:run -pl xingyu-starter` 无 `-am` 会用 ~/.m2 过时 jar（实测踩坑，建议启动脚本统一 -am）。

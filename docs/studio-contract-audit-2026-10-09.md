# Studio — Contract & Data Lifecycle Audit Report

> 2026-10-09 · 只审计，不实施。全部结论基于代码与隔离 test 环境运行时反证，未触碰 dev 数据。
> 探针测试已用毕删除，test 库 fixture 已清零（articles/users/submissions = 0）。

---

## 1. Studio 真实路由与功能矩阵

15 条路由全部真实（无占位空壳），全部包裹 `RequireAuth`（`xingyu-web/src/router/routes.tsx:980-1189`、`guards.tsx:25-50`）。

| 路由 | 页面 | 核心 API | Controller → Service | 数据表 |
|---|---|---|---|---|
| `/studio` | StudioPage（入口枢纽） | — | — | — |
| `/studio/content` | ContentListPage | listMine / listTrash / trash / restore | GET `/me/articles`、GET `/me/trash`、POST `/me/articles/{id}/trash`、POST `/me/articles/{id}/restore`（CommunityArticleController）→ ArticleService / TrashService | `article`、`content_trash` |
| `/studio/content/new` | EditorPage（新建） | createDraft + saveDraft | POST `PUT /me/articles/{id}/draft` → ArticleService.createShell / saveDraft | `article` + `working_draft` |
| `/studio/content/:articleId` | EditorPage（编辑） | getDraft / saveDraft / submitForReview | 同上 + ReviewService.submitForReview | + `formal_revision`、`review_submission` |
| `/studio/content/:articleId/versions` | ArticleVersionsPage | listRevisions / restoreRevision | GET/POST `/me/articles/{id}/revisions…` → ArticleService.restoreRevision | `formal_revision` |
| `/studio/analytics` | StudioAnalyticsPage | meInsightsApi.get | `/me/insights` | — |
| `/studio/submissions`、`/:id` | 我的投稿 + 撤回 | submissionsApi | GET/POST `/me/submissions…` → ReviewService.withdraw | `review_submission` |
| `/studio/series`、`/new`、`/:id/edit`、`/:id/articles` | 系列 CRUD + 编排 | seriesApi | CommunitySeriesController → SeriesService | `series`、`series_chapter` |
| `/studio/collaboration`（×2） | 邀请链接 | collaborationApi | ⚠️ accept 不落库（后端无协作关系表，UI 已用文案披露） | 无 |
| `/studio/categories` | 创作空间分类 | creationSpaceApi | CommunityCreationSpaceController | `creation_space_category` |

**明确不存在的能力（未实现，非缺陷）**：自动保存（服务端无接口，前端纯手动保存并有测试钉死）；文章图片/封面上传（编辑器上传是显式占位，永远拒绝，`editor-image-upload.ts:17-32`）；文章归档状态（仅系列有 ARCHIVED）；回收站永久删除；分类排序写入；系列编排"移除单篇"控件；创作者直接发布（唯一生命周期动作是 submit 送审，管理员 APPROVED 才 PUBLISHED）。

## 2. 创作数据生命周期（还原）

1. **创建**：`POST /me/articles`（createShell，`ArticleService.java:71-96`）立即插入 `article` 行（DRAFT/ACTIVE/NORMAL）+ 同事务建 `working_draft` 空行（body=null, lockVersion=0）。**正文首次持久化 = 第一次 PUT /draft**。
2. **编辑保存**：`PUT /me/articles/{id}/draft`（saveDraft :118-183）——纯手动、无自动保存。前端无本地暂存（无 localStorage/IndexedDB 暂存），dirty 由内存状态判定。
3. **乐观锁**：lockVersion 应用层比对（:126-131）→ 通过则 `expected+1` 写回（:167）。**非条件 UPDATE**（见缺陷 D0）。
4. **离开/刷新/断网**：dirty 时 `beforeunload` + React Router `useBlocker` 确认框（`editor-leave-guard.tsx:26-63`）；无服务端兜底，未保存内容即丢（现状，测试钉死无自动保存）。
5. **保存确认**：保存成功提示来自真实 PUT 响应（含新 lockVersion 回填），非假状态。
6. **提交**：前端 dirty 先保存再 submit（两个请求非原子，但保存成功提交失败不丢内容）；后端 submitForReview 冻结 `formal_revision` 快照 + 建 `review_submission` + status=IN_REVIEW；IN_REVIEW 全编辑面禁用（前后端一致，`canEditDraft`）。
7. **审核**：APPROVED → `published_revision` 指针指向新 formal_revision + status=PUBLISHED（幂等键 `publication:{submissionId}`）；REJECTED/RETURNED → 回 DRAFT。**PUBLISHED 文章可继续编辑 working_draft（草稿 v2），公开版不受影响**（设计如此）。
8. **撤回/回收站**：withdraw 只回 DRAFT 不动 working_draft；trash/restore 只动 `lifecycleStatus`。**无草稿丢失路径**（版本恢复的显式覆盖除外，前端有「当前草稿的内容会被覆盖」确认框）。
9. **版本恢复**：restoreRevision（:211-235）把 formal_revision 整体拷回 working_draft、lockVersion+1；**是真实持久化操作**；列表接口不含 body（页面诚实标注"历史版本=发布时定格"，草稿返回空是正常态）。
10. **公开读取**：`GET /articles/{id}` 从 `published_revision → formal_revision` 取冻结快照（标题/正文/可见性均来自快照），HIDDEN 对非 owner 404，`published==null`（未发布过）404。**草稿与公开版天然隔离，无展示不一致路径**——除缺陷 D3 外。

## 3. 已证实的 P0/P1 缺陷（运行时反证）

**根因共性：MyBatis-Plus `updateById` 默认 NOT_NULL 字段策略——实体 `WorkingDraft` 无任何 `@TableField(updateStrategy)` 注解、全局无覆盖，所有置 null 的字段不会写库。** 三个缺陷同一根因，均已用隔离 test 环境真实 HTTP 探针反证（探针跑完已删）：

### D2（P0 · 数据一致性/系统污染）定时发布清除失效 → 无限送审循环
- `ScheduledArticlePublishTask.java:42-43` 送审成功后 `draft.setScheduledPublishAt(null); updateById(draft)` → **列未清除**（实测残留 `2020-01-01 08:00:00`，submissions=1）。
- 推论链（每步均有代码证据）：残留行 `scheduled_publish_at <= now` 且 `lifecycle=ACTIVE` → 每 60s 永久命中任务扫描 → IN_REVIEW 期间每 60s 一次 409 + warn 日志；管理员批准 → PUBLISHED → 下一个周期又被 submitForReview（ReviewService 只挡 IN_REVIEW）→ **文章在公开站反复下线/上线，formal_revision 与 review_submission 每 60s 无限增长，管理员审核队列被 PENDING 项刷屏**。
- 可达性：前端虽未接入 schedule UI，但 **API 对任意登录用户开放**（4 个 HTTP 调用即可触发），不是"不可达"。

### D1（P1）取消定时发布不生效
- `ArticleService.cancelSchedule:203` 同样置 null + updateById → 实测 `scheduled_publish_at = 2030-01-01 08:00:00` 残留。
- 用户取消后 UI 显示已取消，但到点文章照样进 IN_REVIEW（意外下线）。

### D3（P1 · 用户高频路径）草稿字段清空保存失效 + DB 与响应不一致
- saveDraft `draft.setSummary(trimToNull(...))` 置 null 后 updateById 不落库：实测清空 summary 后 **DB 仍是 'keep-me'，而保存响应返回 null**（内存对象）。
- 影响 title/summary/coverUrl/slug/body 全部可空字段：用户清空 → 显示保存成功 → 刷新后旧值回来。title 清空最终被 submit 校验拦截，summary/coverUrl/slug/body 清空则静默失效。

### D0（P1 · 高可信推断，代码级证实，未做运行时并发反证）乐观锁非原子
- saveDraft 是 check-then-set：`updateById` 的 WHERE 只有 id，不含 `lock_version`（无 `@Version` 注解）。REPEATABLE READ 下两客户端基于同一 lockVersion 并发保存 → 双双通过校验 → 后提交者静默覆盖前者正文，且**两次都写 `expected+1`（版本号不增），事后无法察觉**。
- 先后顺序的旧请求会被 409 正确拦截（前端有冲突文案）；只有真正并发窗口才静默覆盖。

## 4. 证据不足、仍需反证的风险假设

| 假设 | 现状 |
|---|---|
| D0 并发双写静默覆盖 | 代码级证实；建议后续用双线程/双事务隔离测试实证 |
| 定时任务 `lifecycle_status IN ('DRAFT','ACTIVE')`（WorkingDraftMapper.java:22，'DRAFT' 非 lifecycle 合法值） | 恒假子句，当前行为恰好正确（=ACTIVE）；属语义混乱而非缺陷，修 D2 时顺带清理即可 |
| PUBLISHED 文章人工重新 schedule 是否为支持场景（定时更新公开版） | 需产品定义；D2 修复前该场景必然触循环 |
| 搜索索引与 draft-changed 事件的一致性 | trash/restore 已有对账测试（SearchIndexPipelineIntegrationTest:187）；draft/PUBLICATION_SUCCEEDED 事件的索引消费者未逐一核对 |

## 5. 测试覆盖与缺口

**后端（有）**：创建→送审→批准→发布→公开读取全链路（ArticleFlowIntegrationTest）、coverUrl 保存、投稿详情、系列上下文、trash/restore 索引对账。
**后端（缺口，均无任何测试）**：withdraw、restoreRevision、schedulePublish/cancelSchedule（D1/D2 因此长期潜伏）、lockVersion 409 与并发、非 owner 访问 404（IDOR）、REJECTED/RETURNED 分支、moderation HIDDEN 遮蔽、D3 清空字段语义。
**前端**：覆盖充分且质量高（编辑器 1200+ 行测试钉死无自动保存、lockVersion 携带、409/404 文案、离开守卫、/new 不重复建文；页面/路由/纯逻辑层均有）。

## 6. Static Design 观察（只审计）

已覆盖的状态反馈：未保存（dirty 标记 + 离开守卫双通道）、正在保存/保存失败/保存成功（SaveStatusLabel 三态 + describeSaveError 区分 409/404）、冲突恢复（409 提供刷新指引 + 系列/分类页 409 重载按钮）、版本恢复确认框、IN_REVIEW 只读与 PUBLISHED 横幅。信息架构与守卫完整。
**观察项**：提交中/提交失败的过程态反馈与保存态是两套（需产品级统一）；"保存成功"在 D3 修复前会给出与 DB 不一致的假象（缺陷而非设计问题）；响应式布局本轮未专门核验（如实标注）。

## 7. Product Debt 与功能缺失（非缺陷）

编辑器图片上传占位（UI 全接好、只等后端）；协作 accept 不落库（UI 已诚实披露）；无创作者直接发布/归档/永久删除；封面 coverUrl 为裸 URL 字符串（无上传校验，外链失效风险）；`/files/**` 静态直出无鉴权（FileAccessController 类注释自认，封面/头像可匿名拉取——已知设计，隐私敏感场景需重审）；无孤儿媒体清理（编辑器上传未接入前不适用）；`tools/generate-api-inventory.mjs` 失效（既有债务）。

## 8. 推荐最小修复顺序

1. **D3**（一处修复覆盖用户高频路径）：给 `WorkingDraft` 可空字段加 `@TableField(updateStrategy = ALWAYS)`，或 saveDraft 改条件化 UPDATE SQL；补"清空字段持久化"回归。
2. **D2 + D1**（同根因）：scheduledPublishAt 清除同样依赖该策略——D3 修复即同时治愈；另需防御性修正：任务成功后确认列已清（受影响行数断言）+ `listDueScheduledPublish` 恒假子句清理 + 送审循环兜底（如按 submissionId 幂等）。
3. **D0**：`UPDATE ... WHERE id=? AND lock_version=?` 条件更新（受影响行数=0 → 409），或 MyBatis-Plus `@Version`。
4. **补后端回归**：上述缺口清单按 1→3 对应补齐，先 D1/D2/D3 后 D0 并发。

---

**证据索引**：ArticleService.java:71-96/118-183/199-235/237-321、ReviewService.java:44-92、PublicationService.java:28-71、ScheduledArticlePublishTask.java:28-48、WorkingDraftMapper.java:17-25、WorkingDraft.java（无策略注解）、editor-leave-guard.tsx:26-63、editor-image-upload.ts:17-32、EditorPage.tsx:353-453。探针输出（已删档前记录）：D1 cancel 后 `2030-01-01 08:00:00` 残留；D2 任务后 `2020-01-01 08:00:00` 残留、submissions=1；D3 DB='keep-me' vs 响应=null。

# Studio Draft Persistence Recovery — 验收结论

> 2026-10-09 · Studio Contract Recovery 第一交付物（对应缺陷 D3 与其同根因的字段清空语义）。
> 全部验证在隔离 test 库完成，fixture 已清零；未触碰 dev 数据；未 commit。

## 1. 修复前反证（审计阶段实测）

- 用户清空 summary 后保存（HTTP 200）：**DB 仍为 'keep-me'，保存响应返回 null**——响应与持久化结果不一致。
- 根因：`ArticleService.saveDraft` 用 `draft.setX(...) + draftMapper.updateById(draft)`，MyBatis-Plus 默认 NOT_NULL 字段策略把 null 吞掉。波及 title/summary/coverUrl/slug/body（categoryId 在 article 表上同理）。

## 2. 修改的真实代码范围

- `xingyu-core/xingyu-community/.../service/ArticleService.java`
  - `saveDraft`：改用 `UpdateWrapper` 显式 SET——**只包含本次提交的键**（显式 null = 用户清空），未提交键绝不出现在 SET 子句；`categoryId` 同样显式落库；保存后**从 DB 重读**构造响应（不再用内存实体）；事件里带上精确的新 lockVersion。
  - 未对实体启用全字段 ALWAYS 更新（按约束），未改 createShell/提交/发布路径。
- 响应 DTO 无变化，前端契约不变。

## 3. 修复后 DB / HTTP 验证

- 清空 summary/coverUrl/slug 后：DB 三列真实为 NULL；响应、重新 GET、DB 三方一致；lockVersion 恰好 +1。
- `scheduledPublishAt` 显式 null 同样真实清空（saveDraft 路径）。
- 未提交字段（只提交 title）summary/body 保持原值。
- 必填规则不变：title 清空在 submit 校验处按既有规则拒绝；visibility 显式 null 仍按既有 `parseVisibility` 拒绝（400）。

## 4. 新增回归（StudioDraftPersistenceRecoveryIntegrationTest，7/7 绿）

1. clearingFieldsReallyPersistsNullsAndResponseMatchesDb（DB/响应/GET 三方一致）
2. unsubmittedFieldsAreUntouched
3. expiredLockVersionIsRejectedAndDoesNotOverwrite（与 D0 交付重叠覆盖）
4. concurrentSavesWithSameLockVersionExactlyOneWins（与 D0 交付重叠覆盖）
5. nonOwnerCannotSaveAnotherUsersDraft
6. restoreRevisionOverwritesDraftIncludingStaleCover（历史 null coverUrl 也要清掉新值）
7. scheduledPublishAtCanBeClearedViaSaveDraft

## 5. 是否引入新问题

无。既有回归全绿：ArticleFlowIntegrationTest、ArticleCoverUrlIntegrationTest、ArticleSubmissionDetailIntegrationTest、ArticleSeriesContextIntegrationTest（4/4）；SchemaGuard 2/2（新测试零 DDL）；前端定向 24 文件 / 377 用例全绿（契约未变）。

## 6. 剩余债务与未验证假设

- 并发场景的极端形态（3 端以上同时保存、跨事务重试）未穷举，D0 修复后语义由条件 UPDATE 保证。
- 编辑器图片上传占位、协作 accept 不落库等产品缺口维持原状（本轮范围外）。
- `categoryId` 清空语义随 D3 一并修复，但无独立前端入口（记录为顺带修复）。

---

## Final Result — Studio Draft Persistence Recovery（Final Integrity Verification，2026-10-09）

**PATCH 三态语义（源码级核实，无需修复）**：
- Controller 接收 `@RequestBody Map<String,Object>`（CommunityArticleController.java:62-67）——**不是普通 DTO**。Jackson 下：字段缺失 → key 不存在；显式 null → key 存在值 null。`body.containsKey(key)` 严格区分，UpdateWrapper 的"只 SET 提交键"依赖成立。用户担心的"DTO 无法区分缺失与 null"不适用于本项目。
- `trimToNull`（ArticleService.java:500-506）：null/空白串 → null，非空 → trim。即 **空字符串 ≡ 显式 null ≡ 清空**。
- 逐字段契约：title（清空允许，submit 必填拒绝）· summary/coverUrl/slug/body（清空允许）· visibility（显式 null 被 parseVisibility 400 拒绝，不可清空——业务必须恒有值）· bodyMode（可清空，submit 必填拦截）· categoryId（null=清空关联，非空校验归属）· scheduledPublishAt（null=清空）· lockVersion（缺省=当前值）。
- 新增回归 `bodyOnlySaveDoesNotTouchAnyOtherField`：只传 body → title/summary/coverUrl/slug 全部原值、响应与 DB 一致。

**最终验证**：定向后端 14/14 绿（DraftPersistence 8 + Scheduling 6）；既有文章类 4/4；SchemaGuard 2/2；tsc --noEmit 0 错误；ESLint 0 错误（33 个既有 react-refresh warning，非本轮引入）；前端定向 377 用例绿；前端全量首跑 1 个失败、复跑 2318/2318 全绿——零前端 diff 且未复现，判定为已知并行偶发 flaky，非本轮回归。

**已验证安全边界**：字段级 PATCH 语义、响应=DB=GET 三方一致、未提交字段不可触碰、必填校验保留、非作者 404、乐观锁原子性、版本恢复受保护。
**尚未覆盖**：三端以上并发穷举、真实浏览器 E2E（本轮为 MockMvc/隔离库层验证）。

**Studio Draft Persistence Recovery — Final Result：通过。**

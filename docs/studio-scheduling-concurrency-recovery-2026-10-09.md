# Studio Scheduling & Concurrency Recovery — 验收结论

> 2026-10-09 · Studio Contract Recovery 第二交付物（对应缺陷 D2 / D1 / D0）。
> 全部验证在隔离 test 库完成，fixture 已清零；未触碰 dev 数据；未 commit。

## 1. 修复前反证（两阶段，均为隔离环境实测）

**D2 计划时间残留（审计阶段）**：定时任务送审成功后 `scheduled_publish_at` 残留（实测 `2020-01-01 08:00:00`），根因=MyBatis-Plus NOT_NULL 策略吞掉 null 清除。

**D2 重复送审/公开状态影响（本轮反证探针，跑完即删）**：
- 到期计划 → 任务第 1 轮：submissions=1、status=IN_REVIEW、scheduled 残留；
- 第 2 轮：IN_REVIEW 挡住（submissions 仍 1）；
- 管理员批准 → PUBLISHED；
- 第 3 轮：**submissions=2（重复送审实测成立）、status=IN_REVIEW**。
- 诚实修正：探针草稿当时未设 PUBLIC，"公开读取 404" 混入了 PRIVATE 语义，不能单独作为下线证据；重复送审本身（submissions=2 + IN_REVIEW 回退）是无混杂的实测。结合 `AccessPolicy`（`underReview && !owner → NOT_FOUND`，AccessPolicy.java:23）与批准后 200 的对照，重复送审必然导致已发布文章对公众下线——修复后回归以 PUBLIC 文章实测了「批准后公开 200、第三轮扫描后仍 200」。

**D1 取消定时残留**：取消后 `scheduled_publish_at = 2030-01-01 08:00:00` 残留。

**D0 乐观锁**：代码级证实（updateById WHERE 只有 id，无 @Version）；本轮修复后以两线程并发实测闭环（见 §4）。

## 2. 修改的真实代码范围

- `WorkingDraftMapper.java`
  - 新增 `claimDueSchedule`：条件 UPDATE（`scheduled_publish_at IS NOT NULL AND <= now` → 置 NULL），当前读 + 行锁，作为「原子认领」。
  - 修正 `listDueScheduledPublish` 恒假子句（`IN ('DRAFT','ACTIVE')` → `= 'ACTIVE'`，行为等价、语义归正）。
- `ReviewService.java`
  - 新增 `submitScheduledDraft(articleId)`（@Transactional）：**原子认领 → 同事务送审**。认领失败（0 行）= 已被并发 worker 消费 → 放弃；送审失败 → 整体回滚 → 计划恢复 → 下一轮重试（既有重试语义保留）。同一次计划绝不被重复消费是数据库级保证。
  - 新增依赖：WorkingDraftMapper、CommunityUserMapper（owner 解析移入事务内）。
- `ScheduledArticlePublishTask.java`
  - 只负责扫描 + 逐条转交 `submitScheduledDraft`；删除「送审后 updateById 清列」的失效逻辑。
- `ArticleService.java`
  - `cancelSchedule`（D1）：显式 `SET scheduled_publish_at = NULL`（实测修复前残留）。
  - `saveDraft` / `restoreRevision`（D0）：写入 WHERE 携带 `lock_version = expected`，affected=0 → 409「草稿已被他人更新」；restoreRevision 同时显式 SET 全部恢复字段（历史 null 值不再残留新草稿值）。
- 未关闭定时任务、未隐藏任何 UI、未改「提前登记 → 送审 → 审核后公开」的产品规则。

## 3. 修复后 DB / HTTP 验证

- 到期计划第 1 轮：submissions=1、article=IN_REVIEW、**scheduled_publish_at=NULL**。
- 第 2 轮扫描：submissions 仍 1（无重复消费）。
- 批准 → PUBLISHED；第 3 轮扫描：submissions 仍 1、status 仍 PUBLISHED、公开 GET 200（PUBLIC 文章实测）。
- 取消定时：列真实 NULL；任务扫描 0 送审、article 保持 DRAFT。
- 送审失败（body 缺失）：**事务回滚、计划恢复**（列回到到期值），修复草稿后下一轮成功——不静默丢弃、不重复消费。
- 未来时间不被提前消费。

## 4. 新增回归（StudioSchedulingRecoveryIntegrationTest 4/4 + StudioDraftPersistenceRecoveryIntegrationTest 7/7，全绿）

调度侧：主闭环（一次性消费+批准后稳定）、取消清列、失败回滚重试、未来不提前消费。
并发侧：**两线程同 lockVersion 并发保存 → 恰好一个 200、一个 409，正文=胜者、版本恰好 +1**（修复前推断为"双双成功静默覆盖"，修复后契约由条件 UPDATE 保证）；过期版本 409 不覆盖正文不产生新版本；非作者 404。

## 5. 是否引入新问题

无。既有回归全绿（ArticleFlow/CoverUrl/SubmissionDetail/SeriesContext 4/4 + SchemaGuard 2/2）；前端定向 24 文件 / 377 用例全绿。
一处行为差异需知悉：文章/用户不存在的僵尸计划现在会被消费后丢弃（旧实现无限重试），这是"不允许重复消费"的直接推论。

## 6. 剩余债务与未验证假设

- 定时发布=定时**送审**（仍需管理员批准才公开）是既有产品规则，本轮未改；是否提供创作者直接发布属产品决策。
- 任务多实例部署下的扫描竞争由原子认领兜底，但单机 60s fixedDelay 的节奏未调整（现状足够）。
- 编辑器图片上传占位、协作 accept 不落库、`/files/**` 无鉴权直出等产品债务维持原状（本轮范围外）。

---

## Final Result — Studio Scheduling & Concurrency Recovery（Final Integrity Verification，2026-10-09）

**定时任务事务与并发（本轮新增证据）**：
- `claimDueSchedule`（条件 UPDATE，当前读 + 行锁）→ `submitForReview` 同事务（ReviewService.submitScheduledDraft，@Transactional）。
- 新增回归 `concurrentClaimsOnTheSameDueScheduleExactlyOneWins`：两线程同时认领同一到期计划 → **恰好一个 true、只送审一次、计划清 NULL**。
- 新增回归 `cancelRacingWithScanYieldsDeterministicOutcome`：取消与扫描竞争 → **送审至多一次；无论谁赢计划列最终必为 NULL**（两条路径都显式清列）；被消费 → IN_REVIEW 完整进入审核，被取消 → 保持 DRAFT——确定的状态规则。
- 已有测试不再重复：失败回滚重试（failedSubmissionRollsBackTheClaimAndRetriesNextRound）、批准后再扫描不重复（主闭环）、未来不提前消费。
- 僵尸计划边界（已在实现中明确）：计划被认领后文章/用户不存在 → 丢弃计划不回滚（避免僵尸无限重试）；文章不存在时 claim 本身 0 行 → false。

**草稿关键写入口清单与版本保护核对**：

| 写入口 | 保护机制 | 说明 |
|---|---|---|
| saveDraft | **lockVersion 条件 UPDATE** | 正文/元数据唯一写入口 |
| restoreRevision | **lockVersion 条件 UPDATE** | 修复时同步加固 |
| schedulePublish | 经 saveDraft（同保护） | 复用乐观锁 |
| cancelSchedule | **状态条件 UPDATE**（清列） | 只 touch scheduled_publish_at/updated_at 两列，与正文字段不相交，无覆盖风险；不递增版本为既有语义 |
| submit（送审） | 只读冻结快照 | 不写 working_draft，无覆盖风险；sourceDraftLockVersion 落审计 |
| createShell | 新建空行 | 无并发对象 |
| claimDueSchedule（任务） | **状态条件 UPDATE**（原子认领） | 数据库级防重复消费 |
| admin decide（批准/驳回） | PENDING 状态条件 + admin 鉴权 | 不写 working_draft |

**最终验证**：定向后端 14/14 绿；既有文章类 4/4；SchemaGuard 2/2；前端定向 377 用例绿；tsc 0 错误；ESLint 0 错误；前端全量复跑 2318/2318 绿（首跑 1 失败未复现、零前端 diff，判定为已知并行 flaky）。

**已验证安全边界**：单次消费原子性、失败回滚重试、取消/扫描竞争确定性、批准后稳定、僵尸计划边界、乐观锁原子性。
**尚未覆盖**：多实例部署下的任务节奏调优（单实例现状足够）、真实 MySQL 死锁/重试压力测试。

**Studio Scheduling & Concurrency Recovery — Final Result：通过。**

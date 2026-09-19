# Migration ledger reconciliation（xingyu_hub）

> 本目录是 **dev 库 `xingyu_hub` 的 `schema_migration` 台账补偿记账**的唯一事实来源。
> 它**不是**迁移目录：这里不放任何 `V*.sql`，也永远不执行历史 migration 的 DDL/DML。
> 目录位置刻意选在 `maintenance/`：`sql/rebuild-test-db.sh` 与 `SchemaMigrator` 都会 glob
> `sql/V*.sql`，把维护脚本放进 `sql/` 会被当成迁移执行。

日期：2026-09-19
范围：dev 台账缺失的 **18 个版本** —— `021–025`、`028–040`
状态：**审计已完成；补录脚本已就绪；W3 状态机改造已完成（`ceeef9f`）；W5 dev 副本闭环验证已通过；真实 dev 尚未写入（等待确认）**

---

## 1. 结论摘要

| 项 | 值 |
|---|---|
| dev 台账（补录前） | 24 行 = `000–020`、`026`、`027`、`041` |
| fresh 台账 | 42 行 = `000–041`（由 `sql/V*.sql` 全量重建） |
| 缺失版本 | 18 个：`021 022 023 024 025 028 029 030 031 032 033 034 035 036 037 038 039 040` |
| 补录后目标 | 42 行（原 24 行逐字段不变 + 18 行 `RECONCILED`） |
| 结构证据 | dev 与 fresh **全结构指纹完全一致**（0 diff） |
| 结构指纹（审计快照口径，保留 CRLF） | `a8e7377274b99ec885c5066b3cb40d36c33fd1f2fbc50f11fdf3502271a0842b` |
| 结构指纹（脚本口径，CR 归一 + 字节序排序） | `3a6e6f03cdceded634e0c308b6881203249b0a4d1f8b10f0829c6ec714679457` |
| 覆盖维度 | COL 889 / IDX 386 / CON 186 / FK 15 / TBL 116 |
| checksum 口径 | 迁移文件**仓库规范 LF 原始字节**的 SHA-256，与 `SchemaMigrator` 同口径 |
| 逐版本核验 | 18/18 文件的 LF SHA-256 **全部等于** fresh 台账 checksum |
| 分类 | A=13，B=4，C=1，D=0（无版本因证据不足被排除） |

---

## 2. 为什么是 `RECONCILED` 而不是 `SUCCESS`

`SUCCESS` 是一个**执行事实**断言：该 migration 的 SQL 被完整执行且未报错。
本轮我们**没有**这个证据：

- 这 18 个版本在 dev 台账里根本没有记录，原始执行记录不可考；
- 本机 MySQL binlog 是 **ROW 格式**，无法还原历史执行的 SQL 文本
  （`SHOW BINLOG EVENTS` / `mysqlbinlog -R` 都拿不到语句文本）。

我们能证明的是**最终语义**：dev 与 fresh 结构 0 diff（DDL 后置条件全部成立），
且关键 DML 后置条件在 dev 成立（见 §4）。

所以正确的记账口径是：

> **`RECONCILED` = 该版本的最终语义已由审计确认满足，但历史执行本身未经证实。**

用 `SUCCESS` 会把「审计推断」伪装成「执行事实」，让未来的读者误以为我们亲眼见过这些迁移跑过。
用 `FAILED` 更荒谬。因此新增第三种状态。

**表结构无需变更**：`schema_migration.status` 是 `varchar(16)`
（定义见 `sql/V000__schema_migration.sql`），`RECONCILED` 只有 10 个字符，长度充裕；
`status` 列没有 ENUM/CHECK 约束，不需要 DDL。已实测确认 dev 与 fresh 的
`schema_migration` 建表语句均为 `status varchar(16) NOT NULL COMMENT '执行状态'`。

---

## 3. 18 版本矩阵

机器可读版本见同目录 [`2026-09-19-ledger-reconciliation.tsv`](./2026-09-19-ledger-reconciliation.tsv)
（`backfill-missing-ledger.sh` 的唯一输入）。

| version | provenance | non-idempotent | V041 补偿 | checksum（LF SHA-256，前 12 位） |
|---|---|---|---|---|
| 021 | A | no  | – | `9b56ffa22d82` |
| 022 | A | **yes** | – | `7225a73e4da4` |
| 023 | A | **yes** | – | `2d30c8a9b3f3` |
| 024 | A | **yes** | – | `269930938b6a` |
| 025 | A | no  | – | `56b1dbd0f2ad` |
| 028 | A | **yes** | – | `1ca2cd5f40f7` |
| 029 | A | no  | – | `12eab89f0b7f` |
| 030 | A | no  | – | `645d013092a2` |
| 031 | **B** | no  | **yes** | `50fe18576670` |
| 032 | **C** | no  | **yes** | `596ddb405d7e` |
| 033 | **B** | **yes** | **yes** | `8245d494ae3c` |
| 034 | **B** | **yes** | **yes** | `d0c13e223439` |
| 035 | **B** | no  | **yes** | `b1581fbcfa72` |
| 036 | A | **yes** | – | `d4cb638524de` |
| 037 | A | no  | – | `2d9ea3a86a9c` |
| 038 | A | no  | – | `37151d6a8188` |
| 039 | A | no  | – | `57714c3c6ef0` |
| 040 | A | no  | – | `ac698093ab82` |

**非幂等清单（7 条，绝对禁止重跑，重跑必报错）**：`022 023 024 028 033 034 036`
（无守卫 `ALTER … ADD COLUMN` / `RENAME`）。
`035` 虽幂等（`CREATE TABLE IF NOT EXISTS`），但重跑**不会补索引**——索引靠 V041 补齐。

---

## 4. provenance 分类依据

### A 类（13 个）——对象由该迁移自身创建，后置条件可观测

> **表述纪律（重要）**：下表的结论一律只到「**最终语义已满足**」为止。
> 这些后置条件足以排除"该迁移从未产生任何效果"，但**不能**证明"该 migration 在历史上确实被完整执行过"
> ——原始 ledger 记录缺失、binlog 为 ROW 格式无法还原 SQL 文本。
> 因此台账状态用 `RECONCILED` 而不是 `SUCCESS`；正文任何一处都不得写成"证明该迁移历史上执行过"。

| version | 证据（结论只到"最终语义已满足"） |
|---|---|
| 021 | `community_event(id …201, slug welcome-writing)`、`guide_page(id …301/302)` 在 dev 与 fresh 均在 |
| 022 | 群管理/用户偏好相关表列形状两库一致 |
| 023 | 消息附件/收藏相关表列形状两库一致 |
| 024 | 剩余特性相关表列形状两库一致 |
| 025 | V004 恰好播种那 4 行 `system_parameter`，V025 恰好删除这 4 个键；两库该表行数均为 0 → 空表完全由 V004+V025 解释，**不存在第三个删除者**（V004 已在 dev 台账且 checksum 一致）。据此判定 **V025 的最终语义已满足** |
| 028 | `topic.description` 两库精确等于迁移字面量（`'综合讨论与社区日常'` / `'官方公告与重要通知'`），7 个种子话题齐备 |
| 029 | 两库无 `TRASHED` 残留、无 NULL/空 `lifecycle_status`，取值集仅 `ACTIVE`；UPDATE 作用域不可回放，但**不存在反例** |
| 030 | V004 播种 `topic` 时 `status='ENABLED'`，V030 把 `ENABLED→ACTIVE`；两库均无 `ENABLED` → 据此判定 **V030 的最终语义已满足** |
| 036 | `creator_follow → user_follow` 的 RENAME/CHANGE/DROP INDEX 结果两库一致 |
| 037 | 索引优化结果与 fresh 一致（列顺序已由结构指纹覆盖） |
| 038 | `explore_domain` 24 / `content_tag` 18 / `domain_tag_relation` 21，`seed_key` 集合两库一致 |
| 039 | 创作空间置顶文章相关列/索引两库一致 |
| 040 | `working_draft.cover_url` 与 `formal_revision.cover_url` 两库均在。**来源不可区分**：该列可能由 V040 创建，也可能由历史等价的测试自愈 DDL（`addColumnIfMissing`）抢先创建——两者的定义含 `COMMENT` 完全相同。无论哪种来源，**最终定义一致** |

### B 类（4 个：031 / 033 / 034 / 035）——对象被测试侧自愈 DDL 抢先创建

历史上的测试自愈 DDL（`CommunityTestSupport.ensure*Schema` 等，已在 2A 阶段删除）用**精简定义**
抢先建表：没有 `COMMENT`、少了索引。此后 V031/V033/V035 里的
`CREATE TABLE IF NOT EXISTS` 全部退化为**空操作**，索引与注释便永久缺失，而台账仍显示"已应用"。

判定方法：**测试侧自愈 DDL 从不写 `COMMENT`**。某对象在 dev 中带着与 fresh 完全一致的
migration 声明 `COMMENT`，即证明其来源是 migration 而非测试 DDL。

**补偿关系（V041）**：`sql/V041__align_dev_schema_baseline.sql` 是 forward fix，
定义全部取自 fresh 的 `information_schema`（非手写），只补差异、不重放 V031/V033/V035、
不改任何历史 migration。它补齐了 6 个索引/唯一约束
（`user_block.idx_user_block_blocked`、`series_subscription.idx_series_subscription_series`、
`report_supplement.idx_report_supplement_report`、
`galaxy_join_request.uk_galaxy_join_request_pending`(UNIQUE) 与 `idx_galaxy_join_request_galaxy`、
`event_registration.idx_event_registration_user`）+ 7 张表 + 44 列 + 2 列的 `COMMENT`。

→ 因此 B 类的补录**必须先确认 V041 已 `SUCCESS` 且 checksum 正确**
（`18770193845ea75b8ce946551eb5cc728892962f1c497c999fd125241e961817`），
否则"最终语义已满足"这句话不成立。脚本已把该前置写成硬门槛。

**B 类记录必须标注**：`historical migration missing; final semantics reconciled by V041`。

### C 类（1 个：032）——被更早的 V001 完全抢先，两库均为 no-op

- V001 已建 `sys_file_config`（**ruoyi 形状**：`name varchar(100)`、有 `create_by`/`update_by`、
  索引 `idx_storage_type` + `idx_master`、表注释「文件存储配置表」），并 `INSERT id=1`
  （`domain=http://localhost:8080`、`base_path=D:/uploads`、`remark=默认本地存储配置`）。
- V032 用 `CREATE TABLE IF NOT EXISTS`（**另一套形状**：`name varchar(128)`、无 `create_by`、
  索引 `idx_sys_file_config_master`、注释「文件存储配置」）+ `INSERT IGNORE` id=1
  （`domain=http://localhost:7779`、`runtime/uploads`、`默认本地存储`）。
- **实测两库**：表形状、索引集、种子行取值**全部归属 V001** → V032 在 dev 与 fresh 的
  可观测效果均为**零**。

> ledger 记 `V032 SUCCESS` 只代表"该文件被完整执行且未报错"，
> **不代表 V032 声明的 schema 或种子被创建**。

→ 因此 C 类的补录前置是 **V001 形状成立**（脚本会断言 `sys_file_config` 的列类型/列集合/索引集/表注释）。
若哪天 `sys_file_config` 变成了 V032 的形状，说明 V001 基线被改过，此时补录 V032 就是错的，必须停下来。

---

## 5. 覆盖 / 替代关系

`V021–V041` 中全部"非新增类"改动只有：
`V029` 对 `review_decision`/`review_submission` 的 `MODIFY`、
`V036` 对自身表的 `RENAME`/`CHANGE`/`DROP INDEX`、
`V041` 的补注释 `MODIFY`。

→ **没有任何版本被更晚的 migration 覆盖或替代**；唯一的补偿关系来自 **V041**（见 §4 B 类）。

---

## 6. 未触碰项（本轮及补录均不改）

| 对象 | 处置 |
|---|---|
| `V001` | **不修改**。原始文件已丢失，现行文件是按执行记录恢复的等价迁移，靠 `LegacyMigrationChecksums` 精确映射兼容 |
| `V020` | **不修改** |
| `V041` | **不修改**（已 applied） |
| 历史孤儿对象 | **不动** |
| `register` / `login` 相关逻辑 | **不动** |

---

## 7. 如何执行

```bash
# 1) 默认 dry-run：只做前置校验，不写任何数据
bash maintenance/reconciliation/backfill-missing-ledger.sh

# 2) 确认输出后再真正补录
bash maintenance/reconciliation/backfill-missing-ledger.sh --apply
```

脚本的全部硬门槛、写入语义与验收标准见同目录 [`PLAN.md`](./PLAN.md) 第 3–4 节。

## 8. 脚本的锁生命周期（已审计）

`GET_LOCK('xingyu_hub_schema_migration', 30)` → 事务 → `COMMIT|ROLLBACK` → `RELEASE_LOCK`
**全部在同一条 MySQL 连接内完成**（APPLY 阶段只有一次 mysql CLI 调用；前面的 7 道前置门槛都是
取锁**之前**的短连接只读查询，不存在跨进程持锁）。

回滚是**显式 `ROLLBACK`**（经 `PREPARE/EXECUTE` 承载），不依赖"连接断开隐式回滚"。
运行时还会打印 `SAME_CONNECTION` / `LOCK_OWNED_BY_US` / `RELEASED` 三个自证标记并由脚本断言——
一旦有人把 APPLY 拆成多次 mysql 调用，`LOCK_OWNED_BY_US` 会变 0 并立即报错。
详见 [`PLAN.md`](./PLAN.md) 的「锁生命周期审计」小节。

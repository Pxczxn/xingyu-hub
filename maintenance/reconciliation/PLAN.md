# Ledger reconciliation 实施与验证规划

> 目标：**进入 ledger reconciliation 实施准备阶段，但暂不修改真实 dev ledger。**
> 范围：dev 库 `xingyu_hub` 台账缺失的 18 个版本（`021–025`、`028–040`）。
> 本规划覆盖 6 个工作流（W1–W6），每个工作流给出 **目标 / 约束 / 验收标准**。
> 日期：2026-09-19

---

## 0. 已核实的现状（本轮实测，非推断）

| 事实 | 值 | 核验方式 |
|---|---|---|
| dev 台账 | **24 行**（`000–020`、`026`、`027`、`041`） | 直连 `xingyu_hub.schema_migration` |
| fresh 台账 | **42 行**（`000–041`） | 直连 `xingyu_hub_test.schema_migration` |
| 缺失版本 | **18 个** | 集合差 |
| 文件 LF SHA-256 vs fresh 台账 checksum | **18/18 全部相等** | 逐版本 `sha256sum` 比对 |
| dev/fresh 结构指纹 | **完全一致**（0 diff） | `COL/IDX/CON/FK/TBL` 五维导出后哈希 |
| `schema_migration.status` 类型 | `varchar(16) NOT NULL` | `SHOW CREATE TABLE` |
| 迁移文件规范字节 | 全部为 **LF**（无 CR） | 逐文件 `grep -P '\r'` |

**本轮已完成（均为纯准备，未触碰真实 dev）**

1. `maintenance/reconciliation/` 三件套已落盘（W1 完成）。
2. `backfill-missing-ledger.sh` 在 dev 上 **dry-run 全绿**（7 道门槛全部通过）。
3. 脚本**写路径已在 dev 副本上真跑通过**（W5 的 5A 部分提前预演，见 §W5）。

**本轮未做（等待确认）**

- W3（SchemaMigrator 状态机改造 + 自动化测试）——**代码未改**。
- W5 的正式验收运行与 5B（应用启动验证）。
- 真实 dev 的 backfill。

---

## 1. 执行顺序与依赖（**这是本规划最关键的一节**）

```
W1 落盘三件套 ──► W3 改 SchemaMigrator + 测试 ──► W5 dev 副本闭环验证 ──► W6 停下汇报
                        ▲                                                    │
                        └──────────── 顺序不可交换 ──────────────────────────┘
                                                     ▼
                                        【待确认】真实 dev backfill
```

### ⚠️ 关键危险点：W3 必须早于任何补录（含副本验收）

当前 `SchemaMigrator.apply()` 只把 `SUCCESS` 视为"已应用"：

```java
if ("SUCCESS".equals(statuses.get(0))) { log.info("skipped schema version {}", version); return; }
if ("FAILED".equals(statuses.get(0)))  { throw new IllegalStateException("Migration " + version + " previously failed"); }
// ← status 不是 SUCCESS / FAILED 时，这里**不会** return，直接往下走
```

也就是说，一旦台账里出现 `RECONCILED` 而代码没改，它会落进"未知 status"分支并**继续执行迁移**。后果：

1. 18 个版本会被重新执行；
2. 其中 **7 个非幂等版本**（`022 023 024 028 033 034 036`）必然报错（无守卫 `ALTER ADD COLUMN` / `RENAME`）；
3. 报错走 catch 分支，执行
   `INSERT … ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'FAILED'`
   → **把刚补录的 `RECONCILED` 覆盖成 `FAILED`**；
4. 下次启动时 `FAILED` 直接 fail-fast，**应用起不来**。

**结论：W3 未完成之前，不得对任何库（含副本）做补录后启用 `xingyu.schema.migration.enabled=true` 的启动验证。**
本轮的探针预演之所以安全，是因为预演脚本只写台账、从不启动应用、跑完即销毁副本。

---

## W1 — 落盘 maintenance 三件套

**目标**：把本轮审计结论固化为可版本化、可执行、可复核的运维资产。

**产物与路径**

| 文件 | 作用 |
|---|---|
| `maintenance/reconciliation/README.md` | 证据记录（人读）：18 版本矩阵、A/B/C provenance、checksum、证据摘要、V041 补偿关系、RECONCILED 口径 |
| `maintenance/reconciliation/2026-09-19-ledger-reconciliation.tsv` | 机器可读矩阵，**脚本的唯一输入与白名单来源** |
| `maintenance/reconciliation/backfill-missing-ledger.sh` | 补录脚本（默认 dry-run） |

**约束**

- **不放 `sql/`**：`sql/rebuild-test-db.sh` 与 `SchemaMigrator` 都会 glob `sql/V*.sql`，放进去会被当迁移执行。
- 三个文件一律 **LF** 行尾；`.tsv` **不得带 UTF-8 BOM**（BOM 会污染第一行 version 字段，脚本会直接拒绝）。
- `.gitignore` 里 `*.md` 是全局忽略的，已追加 `!maintenance/reconciliation/README.md` 例外，否则 README 进不了库。

**验收标准**

- [x] 三文件存在且为 LF、无 BOM
- [x] `git check-ignore` 对三文件均不命中（README 例外已生效）
- [x] TSV 18 行数据行，version/checksum/class 三列与审计结论一致
- [x] 脚本 dry-run 可执行且 7 道门槛全绿

---

## W2 — 补录状态统一为 `RECONCILED`（而非 `SUCCESS`）

**目标**：让台账如实表达"我们证明了什么、没证明什么"。

**为什么不是 `SUCCESS`**

`SUCCESS` 是**执行事实**断言（该 migration 的 SQL 被完整执行且未报错）。本轮没有这个证据：

- 这 18 个版本在 dev 台账里**根本没有记录**，原始执行记录不可考；
- 本机 MySQL binlog 是 **ROW 格式**，无法还原历史执行的 SQL 文本（`SHOW BINLOG EVENTS` / `mysqlbinlog -R` 都拿不到语句文本）。

我们真正能证明的是**最终语义**：dev 与 fresh 结构 0 diff（DDL 后置条件全部成立），
且关键 DML 后置条件在 dev 成立（`V025`/`V030` 可解释为"不存在第三个删除者/改写者"、
`V028` 字面量精确匹配、`V038` 计数一致）。

> **表述纪律**：以上证据只支持「**最终语义已满足**」，**不**支持「该 migration 在历史上确实被完整执行过」。
> 正文任何一处都不得把前者写成后者——这正是状态取 `RECONCILED` 而不是 `SUCCESS` 的全部理由。

> **`RECONCILED` = 该版本的最终语义已由审计确认满足，但历史执行本身未经证实。**

用 `SUCCESS` 会把审计推断伪装成执行事实；用 `FAILED` 更荒谬。

**约束**

- **表结构不变更**：`status` 是 `varchar(16)`，`RECONCILED` 仅 10 字符，长度充裕；该列无 ENUM/CHECK 约束。
  **不新增 DDL、不新增迁移版本。**（已实测 dev 与 fresh 的建表语句一致。）
- `RECONCILED` 是**终态**，不允许后续被 `SUCCESS`/`FAILED` 静默覆盖（见 W4「禁止 ON DUPLICATE KEY UPDATE」）。
- B 类记录必须同时携带语义标注
  `historical migration missing; final semantics reconciled by V041`（落在 README/TSV，因为表里没有可放标注的列）。

**验收标准**

- [x] `SHOW CREATE TABLE schema_migration` 与补录前完全一致（本轮已确认 `varchar(16)`，无需改表）
- [x] 补录后 18 行 `status` 全部为 `RECONCILED`
- [x] 台账中不存在任何 `RECONCILED` 与 `SUCCESS` 混写同一 version 的情况（主键 `version` 保证）

---

## W3 — 修改 `SchemaMigrator` 状态机（**本轮未执行，待确认**）

**目标**：让状态机对 `RECONCILED` 有明确定义，且**绝不**在 checksum 不匹配或状态未知时继续执行迁移。

### 约束（逐条）

| # | 约束 | 说明 |
|---|---|---|
| 1 | **checksum 校验完全不放宽** | 唯一豁免仍是 `LegacyMigrationChecksums` 对 `version=001` 的**精确**双条件匹配；其余任何版本、任何取值不匹配一律 fail-fast |
| 2 | **校验顺序不可调** | checksum 校验必须**先于** status 短路判断 —— 否则"RECONCILED + 错 checksum"会被静默放过 |
| 3 | `SUCCESS` → skip | 保持原行为与日志 |
| 4 | `RECONCILED` → skip | 新增；日志必须显式，如 `skipped reconciled schema version 029` |
| 5 | `FAILED` → fail-fast | 保持原行为 |
| 6 | **任何未知 status → fail-fast** | 新增；**禁止**继续执行 migration（这正是 W1 危险点的根因） |

### 建议改动（`SchemaMigrator.apply()` 中 `if (!statuses.isEmpty())` 块）

```java
String status = statuses.get(0);

if (!checksum.equals(existingChecksum)) {
    if (LegacyMigrationChecksums.isEquivalent(version, checksum, existingChecksum)) {
        log.warn("schema version {} 命中 legacy checksum 兼容映射（台账遗留 checksum={}，当前文件 checksum={}），视为同一历史迁移",
                version, existingChecksum, checksum);
    } else {
        throw new IllegalStateException("Checksum mismatch for migration " + version);
    }
}

switch (status) {
    case "SUCCESS"    -> { log.info("skipped schema version {}", version); return; }
    case "RECONCILED" -> { log.info("skipped reconciled schema version {}", version); return; }
    case "FAILED"     -> throw new IllegalStateException("Migration " + version + " previously failed");
    default           -> throw new IllegalStateException(
            "Unknown migration status '" + status + "' for version " + version);
}
```

### 需补充的自动化测试

建议新建 `SchemaMigratorStatusTest`（或并入现有 `SchemaMigratorFailFastTest`）。
**测试夹具要点**：用 `@TempDir` 建一个只含**单个** `V029__t.sql` 的临时迁移目录，
把 `migrationDir` 指向它，避免遍历真实 `sql/` 的 42 个文件；
checksum 由测试自己按文件字节算出来，保证与被测代码同口径。

| 用例 | 构造 | 断言 |
|---|---|---|
| RECONCILED + 正确 checksum | 台账返回 `RECONCILED`，checksum 等于文件哈希 | **不执行 SQL**（`verify(jdbc, never()).execute(anyString())`）；不抛异常 |
| RECONCILED + 错 checksum | 台账 checksum 改成别的值 | 抛 `IllegalStateException`，消息含 `Checksum mismatch`；**不执行 SQL** |
| 未知 status（如 `PENDING`） | 台账返回 `PENDING` + 正确 checksum | 抛 `IllegalStateException`；**不执行 SQL**（fail-fast，禁止继续） |
| SUCCESS + 正确 checksum | 原行为回归 | skip，不执行 SQL |
| FAILED + 正确 checksum | 原行为回归 | 抛 `IllegalStateException`，消息含 `previously failed` |
| `001` legacy 兼容不回归 | 台账 = 历史 checksum，文件 = 当前 LF checksum | 不抛异常（`isEquivalent` 生效） |

> Mockito 注意：`JdbcTemplate.queryForObject(String, Class, Object...)` 是变参方法，
> 桩要写成 `when(jdbc.queryForObject(anyString(), eq(String.class), any()))`；
> 而 `migrationTableExists()` 用的是 2 参重载 `queryForObject(String, Class)`，按参数个数即可区分。

**验收标准**

- [x] 用例全部通过：`SchemaMigratorStatusTest` **12 个用例**（6 个方法，其中未知 status 为 6 值参数化）全绿
- [x] `LegacyMigrationChecksums` 与 `LegacyMigrationChecksumsTest` **零改动**（checksum 不放宽，7 个既有用例继续通过）
- [x] 完整 `mvn package` **BUILD SUCCESS**（含 repackage）
- [x] **反证（测试非空转）**：把 `default` 分支临时改成"落空不抛"，未知 status 的 6 个参数化用例**全部失败**
      （`Expected IllegalStateException to be thrown, but nothing was thrown`），证明这些断言真的能拦住回归

### W3 实施结果（2026-09-19）

改动文件：

| 文件 | 变更 |
|---|---|
| `xingyu-infra/xingyu-db/.../schema/SchemaMigrator.java` | 把原来的 `if SUCCESS / if FAILED` 两段改为对 status 的 `switch`：`SUCCESS`/`RECONCILED` → skip（后者日志 `skipped reconciled schema version {}`）、`FAILED` → fail-fast、`default` → `Unknown migration status ...` fail-fast。checksum 校验位置与口径**未动**，仍在状态判断之前 |
| `xingyu-starter/src/test/.../SchemaMigratorStatusTest.java` | 新增 12 个用例（含"execute 从未被调用""GET_LOCK 从未被调用"的负向断言） |

关键性质：`default -> throw` 位于 `tryLock()` **之前**，因此未知状态既不会进入锁、不会执行 migration，
也不可能落进下面的 `catch` 分支被 `ON DUPLICATE KEY UPDATE status='FAILED'` 改写。

---

## W4 — `backfill-missing-ledger.sh` 的规则（已实现，逐条对照）

| # | 规则 | 实现 |
|---|---|---|
| 1 | 默认 **dry-run**，仅 `--apply` 才写 | 无 `--apply` 时做完 7 道门槛后打印计划 SQL 并 `exit 0`，不写任何数据 |
| 2 | 目标库**严格等于 `xingyu_hub`** | `[ "$TARGET_DB" != "xingyu_hub" ] && fail`；唯一例外是 `--probe-db`，且库名被正则强制为 `^xingyu_hub_recon_probe(_YYYYMMDD-HHMMSS)?$`，**指向不到 dev / 测试库** |
| 3 | **18 个版本显式白名单** | 白名单来自 TSV；断言载入数量 == 18 |
| 4 | 当前 migration 文件 **LF SHA-256 必须与 TSV 完全一致** | 逐版本 `sha256sum` 比对，并额外拒绝含 CR 的工作区字节 |
| 5 | 18 条在目标 ledger 中**必须全部不存在** | `COUNT(*) WHERE version IN (…)` 必须为 0 |
| 6 | dev/fresh **结构指纹必须一致** | 五维（COL/IDX/CON/FK/TBL）导出 → CR 归一 → 字节序排序 → sha256，双侧相等 |
| 7 | B 类要求 **V041=SUCCESS 且 checksum 正确** | 断言 `041 = SUCCESS\|18770193845ea75b…` |
| 8 | C 类 V032 验证 **V001 形状前置条件** | 断言 `sys_file_config` 为 ruoyi 形状（`name varchar(100)`、含 `create_by`/`update_by`、索引 `idx_storage_type`+`idx_master`、表注释「文件存储配置表」）+ 台账 `001 = SUCCESS\|63a670b7…` |
| 9 | 复用与 `SchemaMigrator` **相同的锁** | `GET_LOCK('xingyu_hub_schema_migration', 30)` / `RELEASE_LOCK` |
| 10 | **单事务**插入 18 行 `status='RECONCILED'` | `START TRANSACTION` → 单条多值 `INSERT` → 事务内自校验 → `COMMIT` |
| 11 | **禁止 `ON DUPLICATE KEY UPDATE`** | INSERT 无 ODKU；撞主键即报错回滚，不做静默覆盖 |
| 12 | `applied_at` 用**当前 reconciliation 时间** | 显式 `CURRENT_TIMESTAMP`，**不伪造历史时间** |
| 13 | 任一前置条件失败则**整批不写** | 前置门槛在事务外全绿才进入写入；事务内自校验失败则**显式 `ROLLBACK`**（经 `PREPARE/EXECUTE` 承载） |
| 14 | 写后验证 | 提交后再次校验并打印 `APPLY_OK` / `SAME_CONNECTION` / `LOCK_OWNED_BY_US` / `POST_TOTAL` / `POST_RECONCILED` / `POST_ORIG_BAD` / `POST_EXTRA` / `RELEASED`，bash 侧逐个断言 |

### 锁生命周期审计（2026-09-19）

**审计问题**：`GET_LOCK` / 事务 / `COMMIT|ROLLBACK` / `RELEASE_LOCK` 是否都发生在同一个 MySQL 连接中？
会不会跨多个 `mysql` CLI 进程持锁（那样锁在第一个进程退出时就没了，事务也不再受保护）？

**审计结论：不跨进程，全部在同一连接内。** 依据：

1. 整个 APPLY 阶段只有**一次** `mysql_raw "$TARGET_DB" -N -e "$APPLY_SQL"` 调用 → 一个 CLI 进程 → 一条连接；
   `GET_LOCK → 建临时表 → START TRANSACTION → INSERT → 自校验 → COMMIT|ROLLBACK → RELEASE_LOCK`
   全部写在这一段 SQL 里。
2. 第 5–8 节的 7 道前置门槛确实各自起了短连接，但**全部发生在取锁之前**，不构成"持锁跨进程"。
3. `RELEASE_LOCK` 之前没有任何别的 mysql 调用介入。

**据此做的两处加固**（把"靠人工阅读保证"变成"运行时自证"）：

| 加固 | 内容 | 效果 |
|---|---|---|
| 显式回滚 | 自校验结果经 `PREPARE st FROM @s` 承载 `COMMIT` 或 `ROLLBACK` | 不再依赖"连接断开隐式回滚"；失败路径有明确语义 |
| 运行时自证标记 | `SAME_CONNECTION=`（`CONNECTION_ID()` 前后一致）、`LOCK_OWNED_BY_US=`（`IS_USED_LOCK(name) == @conn_id`） | 若未来有人把 APPLY 拆成多次 mysql 调用，`LOCK_OWNED_BY_US` 会变成 0，bash 断言立即失败 |

**验证证据**

| 场景 | 结果 |
|---|---|
| 正常 apply | `APPLY_OK=1 SAME_CONNECTION=1 LOCK_OWNED_BY_US=1 POST_TOTAL=42 POST_RECONCILED=18 RELEASED=1`，退出码 0 |
| 故障注入（临时改脚本强制 `@ok=0`） | `APPLY_OK=0` → **显式 ROLLBACK**；`POST_TOTAL=24 POST_RECONCILED=0`；副本台账事后独立复查仍为 24 行 / 0 条 RECONCILED；退出码 1 |

**事务内自校验的四个条件**（任一不成立即回滚）

```sql
@new_cnt  = 18                                    -- 白名单行数
@new_bad  = 0                                     -- 白名单行 status 必须全为 RECONCILED
@orig_bad = 0                                     -- 原 24 行 version/checksum/status/applied_at 逐字段未变
@total    = 24 + 18 = 42                          -- 没有多出任何行
```

**验收标准**

- [x] 在 dev 上 dry-run：7 道门槛全绿、退出码 0、**dev 台账仍为 24 行且 0 条 RECONCILED**
- [x] 防线实测有效：指向 `xingyu_hub_test` 被拒；`--probe-db xingyu_hub` 被正则拒；重复 apply 被"必须全部不存在 / 行数基线"拒
- [x] 在 dev 副本上 `--apply`：台账 24→42、18 条全 `RECONCILED`、原 24 行逐字节未变、结构指纹 0 变化
- [x] 锁生命周期运行时自证：`SAME_CONNECTION=1`、`LOCK_OWNED_BY_US=1`、`RELEASED=1`
- [x] 回滚分支实测：故障注入强制 `@ok=0` 后显式 ROLLBACK，副本台账零变化

---

## W5 — dev 副本闭环验证（**5A / 5B 均已完成**）

**目标**：在真实 dev 之前，用一份 dev 副本把"补录 + 应用启动"整条链路走通。

### 5A：副本台账补录闭环

```bash
# 1) 复制当前 dev（只读 dev，不动 dev）
mysql -e "DROP DATABASE IF EXISTS xingyu_hub_recon_probe;
          CREATE DATABASE xingyu_hub_recon_probe CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysqldump --single-transaction --routines --triggers --no-tablespaces \
          --default-character-set=utf8mb4 xingyu_hub \
  | mysql --default-character-set=utf8mb4 xingyu_hub_recon_probe

# 2) 记录副本前置快照（台账逐行 + 结构指纹）
# 3) 对副本执行补录
bash maintenance/reconciliation/backfill-missing-ledger.sh --probe-db xingyu_hub_recon_probe --apply
# 4) 独立复核，然后销毁副本
mysql -e "DROP DATABASE xingyu_hub_recon_probe;"
```

**验收标准**

| # | 项 | 期望 |
|---|---|---|
| 1 | 副本台账行数 | 24 → **42** |
| 2 | 新增行 status | 18 条**全部** `RECONCILED` |
| 3 | 原 24 行 | `version/checksum/status/applied_at` **逐字段未变**（消失行数 0、新增行数恰好 18） |
| 4 | 结构指纹 | 前后**完全不变** |
| 5 | `applied_at` | 全部等于本次 reconciliation 时间，**无一条早于当天** |
| 6 | 脚本退出码 | 0，且四个 `POST_*` 标记全部达标 |

> **已正式执行（2026-09-19 21:06 前后，探针库事后已销毁）**：以上 6 项全部通过。

**实测结果**

| # | 项 | 实测 |
|---|---|---|
| 1 | 副本台账行数 | `24 → 42` ✅ |
| 2 | 新增行 status | 18 条全部 `RECONCILED` ✅ |
| 3 | 原 24 行 | 消失行数 **0**、新增行数 **18**；`version/checksum/status/applied_at` 逐字节未变 ✅ |
| 4 | 结构指纹 | 前后完全一致（`3a6e6f03cdceded6…`）✅ |
| 5 | `applied_at` | 18 条共 **1 个**去重值 = 本次 reconciliation 时刻；早于当天的行数 **0** ✅ |
| 6 | 脚本退出码 / 标记 | 退出码 0；`APPLY_OK=1 SAME_CONNECTION=1 LOCK_OWNED_BY_US=1 POST_TOTAL=42 POST_RECONCILED=18 POST_ORIG_BAD=0 POST_EXTRA=0 RELEASED=1` ✅ |
| 7 | 业务数据指纹（附加） | 115 张表逐表行数指纹前后完全一致 ✅ |

### 5B：副本上启用 `SchemaMigrator` 的应用启动验证

**前置**：W3 必须已完成（见 §1 危险点）。

```bash
# 在副本库上临时启用迁移开关，指向副本（7779 被 dev 后端占用，故用 7780）
xingyu.schema.migration.enabled=true
spring.datasource.url=jdbc:mysql://127.0.0.1:3306/xingyu_hub_recon_probe
# 启动应用（宿主注入的 SERVER__PORT 会覆盖 server.port，需 env -u + 显式传参）
java -jar xingyu-starter/target/xingyu-starter-1.0.0.jar \
  --spring.profiles.active=dev --server.port=7780 --server.address=0.0.0.0 \
  --xingyu.schema.migration.enabled=true '--spring.datasource.url=…xingyu_hub_recon_probe…'
```

**验收标准**

| # | 项 | 期望 |
|---|---|---|
| 1 | 启动结果 | 应用**正常启动**（无 `Checksum mismatch` / `Unknown migration status` / `previously failed`） |
| 2 | 000–041 全部识别为已满足 | 日志 42 条 skip：**24** 条 `skipped schema version …`（`000–020`、`026`、`027`、`041`）+ **18** 条 `skipped reconciled schema version …` |
| 3 | **不执行任何历史 DDL/DML** | 无 `applied schema version …` 日志；`schema_migration` 无任何 INSERT/UPDATE（行数仍 42、`applied_at` 未变） |
| 4 | schema 指纹 | 启动前后**完全不变** |
| 5 | data 指纹 | 启动前后**完全不变**（115 张表逐表行数指纹） |
| 6 | 反证 A | 把副本台账某行 checksum 改错 → 启动必须 fail-fast 报 `Checksum mismatch` |
| 7 | 反证 B | 把某行 status 改成 `PENDING` → 启动必须 fail-fast 报 `Unknown migration status` |

**实测结果**

| # | 项 | 实测 |
|---|---|---|
| 1 | 启动结果 | `Started XingyuHubApplication in 20.208 seconds`，0 条 ERROR ✅ |
| 2 | skip 计数 | `skipped schema version` = **24**、`skipped reconciled schema version` = **18**（合计 42）✅ |
| 3 | 未执行迁移 | `applied schema version` = **0** ✅ |
| 4 | ledger | 42 → 42，**逐字节不变**；`applied_at` 逐字节不变 ✅ |
| 5 | schema 指纹 | 前后完全一致 ✅ |
| 6 | 业务数据指纹 | 115 张表逐表行数前后完全一致 ✅ |
| 7 | `001` legacy 映射 | 按预期打出 `命中 legacy checksum 兼容映射` 警告后 skip（未放宽校验）✅ |
| 8 | **反证 A（错 checksum）** | `IllegalStateException: Checksum mismatch for migration 029`；进程退出码 **1**；台账未被改动 ✅ |
| 9 | **反证 B（PENDING）** | `IllegalStateException: Unknown migration status 'PENDING' for version 029`；进程退出码 **1**；该行**没有**被改写成 `FAILED`（`FAILED` 行数 0）✅ |

> 期望日志样例（实测一致）：
> ```
> WARN  schema version 001 命中 legacy checksum 兼容映射（…），视为同一历史迁移
> INFO  skipped schema version 020
> INFO  skipped reconciled schema version 021
> …
> INFO  skipped reconciled schema version 040
> INFO  skipped schema version 041
> ```
>
> **收尾**：探针库已 `DROP`；真实 dev 台账仍为 24 行 / 0 条 `RECONCILED`，结构指纹仍等于基线。

---

## W6 — 停下汇报，不写真实 dev

**目标**：在没有任何未验证变更的前提下收口本轮。

**约束**

- **真实 dev 的 backfill 必须等待明确确认**，本阶段不得执行 `--apply` 指向 `xingyu_hub`。
- `V001` / `V020` / `V041` **不修改**。
- 历史孤儿对象**不动**。
- `register` / `login` 相关逻辑**不动**。

**验收标准**

- [x] 真实 dev 台账仍为 **24 行**、**0 条** `RECONCILED`（W5 前后逐字节一致，结构指纹仍等于基线）
- [x] 除 `xingyu_hub` / `xingyu_hub_test` 外无遗留探针库（`xingyu_hub_recon_probe` 已 `DROP`）
- [x] 汇报内容包含：W1/W3/W5 的实际结果、W5 的指纹前后值、下一步待确认项
- [x] W1（`4ea9675`）与 W3（`ceeef9f`）已分别提交并推送到 `pxczxn` 远端

---

## 附录 A：真实 dev backfill 的执行清单（**待确认后才执行**）

1. 确认 W3 已完成并通过测试（否则见 §1 危险点）。
2. 停 **7779 业务服务**（避免应用并发写库）；**MySQL 保持运行**——补录脚本要连库，且 `GET_LOCK` 语义依赖同一实例。
3. 备份 dev：`mysqldump --single-transaction --routines --triggers --no-tablespaces xingyu_hub > <backup>.sql`。
4. `bash maintenance/reconciliation/backfill-missing-ledger.sh`（dry-run，确认 7 道门槛全绿）。
5. `bash maintenance/reconciliation/backfill-missing-ledger.sh --apply`。
6. 独立复核：台账 42 行、18 条 `RECONCILED`、原 24 行逐字段未变、结构指纹不变。
7. 备份文件保留到确认稳定后再清理。

## 附录 B：回滚

补录是**纯台账写入**，不涉及任何 schema/数据变更，因此回滚极简：

```sql
-- 精确删除本轮补录的 18 行（只删 RECONCILED，绝不触碰原有 24 行）
DELETE FROM schema_migration
WHERE status = 'RECONCILED'
  AND version IN ('021','022','023','024','025','028','029','030',
                  '031','032','033','034','035','036','037','038','039','040');
```

回滚后台账应回到 24 行，且结构指纹不变。

## 附录 C：残留风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| W3 未完成就补录并启用迁移开关 | 7 个非幂等版本重跑失败，`RECONCILED` 被覆盖为 `FAILED`，应用起不来 | §1 已把它列为硬顺序约束；W5 的 5B 必须晚于 W3 |
| 迁移文件被再次写成 CRLF | 文件 checksum 漂移，脚本第 4 道门槛直接拒绝 | 脚本拒绝含 CR 的文件；`LegacyMigrationChecksumsTest` 已有 LF 强制用例 |
| 结构在补录前发生漂移 | "最终语义已满足"前提失效 | 脚本第 6 道门槛要求 dev/fresh 指纹相等**且**等于审计基线 |
| B 类补偿关系被后续改动破坏 | B 类 4 个版本的语义不再等价 | 脚本第 7 道门槛断言 V041 = SUCCESS 且 checksum 正确 |
| `V032` 被误认为"真的建了表" | 误判 V001 基线 | README §4 C 类已明确定性为 no-op；脚本第 8 道门槛断言 V001 形状 |
| 台账出现 `RECONCILED` 但语义漂移 | 未来误信 | `RECONCILED` 语义写死为"最终语义经审计满足，执行未经证实"；B 类附 `historical migration missing; final semantics reconciled by V041` |
| **`scripts/ci-apply-migrations.sh` 会重放全部迁移并覆盖台账** | 该脚本**无条件重放** `sql/V*.sql`，最后用 `ON DUPLICATE KEY UPDATE status='SUCCESS'` 写台账；且 `DB_NAME` 默认就是 `xingyu_hub`。对 dev 运行会重放历史迁移（禁止），并把 `RECONCILED` 静默改写成 `SUCCESS`（把审计推断伪装成执行事实） | **已加防护（本轮）**：目标台账含任何 `RECONCILED` 记录时，脚本在任何 SQL 之前拒绝执行（退出码 1）；目标为 `xingyu_hub` 时额外打印警告。实测：含 `RECONCILED` 的库被拒绝、无 `RECONCILED` 的库正常放行 |
| 其它入口误把 dev 当新库重建 | 全量 DROP/重建会丢失 `RECONCILED` 及其全部业务数据 | `sql/rebuild.ps1` 显式声明会 DROP dev；`sql/rebuild-test-db.sh` 强制目标必须严格等于 `xingyu_hub_test`，其余取值一律拒绝。两者均已有守卫 |

### 台账写入入口盘点（2026-09-19）

| 入口 | 目标库 | 是否重放迁移 | 台账写入 | 结论 |
|---|---|---|---|---|
| `SchemaMigrator` | 配置决定 | 仅执行**未登记**版本 | `SUCCESS` / `FAILED` | 已按 W3 改造；`RECONCILED` 只 skip，不覆盖 |
| `maintenance/reconciliation/backfill-missing-ledger.sh` | 严格 `xingyu_hub`（或受限探针库） | **从不** | 单事务插入 18 行 `RECONCILED`，禁用 ODKU | 本轮新增 |
| `scripts/ci-apply-migrations.sh` | 默认 `xingyu_hub` ⚠️ | **全部重放** | ODKU `status='SUCCESS'` | **已加 `RECONCILED` 防护 + dev 警告** |
| `sql/rebuild-test-db.sh` | 强制 `xingyu_hub_test` | 全部重放（预期） | ODKU `status='SUCCESS'` | 守卫完备，无需改 |
| `sql/rebuild.ps1` | 仅 `xingyu_hub`（显式 DROP） | 全部重放（预期） | ODKU `status='SUCCESS'` | 显式破坏性操作，无需改 |

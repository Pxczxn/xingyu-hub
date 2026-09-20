#!/usr/bin/env bash
# =============================================================================
# backfill-missing-ledger.sh
#
# 用途：把 dev 库 xingyu_hub 的 schema_migration 台账，按 2026-09-19 的只读审计结论，
#       补录 18 条「台账缺失、但最终语义经审计确认已满足」的版本记录，状态记为 RECONCILED。
#
# 这是**补偿性记账**，不是执行迁移：脚本绝不执行任何历史 migration 的 DDL/DML，
# 只往台账里补 18 行记录。
#
# 表述纪律：本脚本与配套文档一律只声称「**最终语义已满足**」，
#   绝不声称「该 migration 在历史上确实执行过」。这两件事不是一回事，见下。
#
# 为什么状态是 RECONCILED 而不是 SUCCESS：
#   这些版本的原始执行记录已不可考（binlog 为 ROW 格式，无法还原 SQL 文本）。
#   我们能证明的是「最终语义经审计已满足」（dev 与 fresh 结构 0 diff + 关键 DML 后置条件成立），
#   不能宣称「历史 migration 当时确已成功执行」。用 SUCCESS 会把审计推断伪装成执行事实。
#
# 前置门槛（任一不满足 -> 整批不写，进程非 0 退出）：
#   1) 目标库严格等于 xingyu_hub（拒绝任何其它库，尤其 *_test）
#   2) 18 个版本来自显式白名单（TSV 即白名单）
#   3) 当前 migration 文件的「仓库规范 LF 原始字节」SHA-256 必须与 TSV 完全一致
#   4) 18 个版本在目标台账中必须**全部不存在**
#   5) 目标库与 fresh 库的结构指纹必须完全一致
#   6) B 类前置：V041 已在目标台账中 status=SUCCESS 且 checksum 正确
#   7) C 类前置：V032 要求 V001 形状（sys_file_config 为 V001 ruoyi 形状）成立
#
# 写入语义：
#   * 复用与 SchemaMigrator 相同的 GET_LOCK('xingyu_hub_schema_migration', 30)
#   * 单事务插入 18 行，status='RECONCILED'
#   * 不使用 ON DUPLICATE KEY UPDATE（重复即报错回滚，不做静默覆盖）
#   * applied_at 取当前 reconciliation 时间（CURRENT_TIMESTAMP），不伪造历史时间
#   * 提交前在事务内自校验；提交后再次校验并打印标记
#
# 锁生命周期（2026-09-19 审计结论）：
#   GET_LOCK → 事务 → COMMIT|ROLLBACK → RELEASE_LOCK 全部由第 10 节**唯一那次**
#   mysql_raw 调用在**同一个 MySQL 连接**内完成。第 5–8 节的 7 道前置门槛都是
#   短连接只读查询，且全部发生在取锁**之前**，因此不存在"跨多个 mysql CLI 进程持锁"。
#   为防止未来重构破坏这条不变量，运行时额外打印两个自证标记并由 bash 断言：
#     SAME_CONNECTION=1    取锁与释放锁时 CONNECTION_ID() 相同
#     LOCK_OWNED_BY_US=1   IS_USED_LOCK(name) == 本次 CONNECTION_ID()
#   回滚改为**显式 ROLLBACK**（经 PREPARE/EXECUTE 承载，MySQL 8.0 支持），
#   不再依赖"连接断开时隐式回滚"。
#
# 用法：
#   bash maintenance/reconciliation/backfill-missing-ledger.sh            # dry-run（默认，只读）
#   bash maintenance/reconciliation/backfill-missing-ledger.sh --apply    # 真正写台账
#   bash maintenance/reconciliation/backfill-missing-ledger.sh --help
#
# dev 副本闭环验证（只允许指向探针副本库，无法指向 dev / 测试库）：
#   bash maintenance/reconciliation/backfill-missing-ledger.sh \
#        --probe-db xingyu_hub_recon_probe --apply
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. 路径与参数
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_DIR="${SQL_DIR:-$ROOT_DIR/sql}"
TSV="${TSV:-$SCRIPT_DIR/2026-09-19-ledger-reconciliation.tsv}"

MODE="dry-run"
PROBE_DB=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply)   MODE="apply" ;;
    --dry-run) MODE="dry-run" ;;
    --probe-db)
      shift
      if [ $# -eq 0 ]; then echo "--probe-db 需要一个库名" >&2; exit 2; fi
      PROBE_DB="$1" ;;
    -h|--help)
      sed -n '2,45p' "${BASH_SOURCE[0]}"
      exit 0 ;;
    *)
      echo "未知参数: $1（可用: --apply / --dry-run / --probe-db <name> / --help）" >&2
      exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# 1. 连接配置
# ---------------------------------------------------------------------------
# 凭据来源优先级：显式环境变量 > scripts/local-db.env（gitignored）
if [ -z "${DB_USERNAME:-}" ] || [ -z "${DB_PASSWORD:-}" ]; then
  if [ -f "$ROOT_DIR/scripts/local-db.env" ]; then
    # shellcheck disable=SC1091
    set -a; . "$ROOT_DIR/scripts/local-db.env"; set +a
  fi
fi
DB_USER="${DB_USERNAME:-${DB_USER:-}}"
DB_PASS="${DB_PASSWORD:-${DB_PASSWORD_OVERRIDE:-}}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

TARGET_DB="${TARGET_DB:-xingyu_hub}"
FRESH_DB="${FRESH_DB:-xingyu_hub_test}"

MYSQL_BIN="${MYSQL_BIN:-mysql}"
LOCK_NAME="xingyu_hub_schema_migration"
V041_CHECKSUM="18770193845ea75b8ce946551eb5cc728892962f1c497c999fd125241e961817"
V001_LEGACY_CHECKSUM="63a670b7132520cdded2be9d3ec22fa0be4971608d13abbf57207dc3f88abe78"
# 结构指纹基线。两种口径都在此登记，脚本用的是**可复现**的那种：
#   * 审计快照口径（保留 mysql 客户端输出的 CRLF，仅 Windows 可复现）：
#       a8e7377274b99ec885c5066b3cb40d36c33fd1f2fbc50f11fdf3502271a0842b
#   * 脚本口径（CR 归一为 LF + LC_ALL=C 字节序排序，跨平台一致）：
#       3a6e6f03cdceded634e0c308b6881203249b0a4d1f8b10f0829c6ec714679457
#   两者覆盖的是同一份 dev/fresh 结构（COL 889 / IDX 386 / CON 186 / FK 15 / TBL 116）。
EXPECTED_STRUCT_FP="3a6e6f03cdceded634e0c308b6881203249b0a4d1f8b10f0829c6ec714679457"
# 补录前的目标台账行数
EXPECTED_PRE_ROWS=24
EXPECTED_NEW_ROWS=18

fail() { echo "❌ 前置条件失败：$*" >&2; exit 1; }
info() { echo "   $*"; }
ok()   { echo "✅ $*"; }

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
  fail "缺少数据库凭据（DB_USERNAME / DB_PASSWORD）。可先 source scripts/local-db.env"
fi
if ! command -v "$MYSQL_BIN" >/dev/null 2>&1; then
  fail "找不到 mysql 客户端（MYSQL_BIN=$MYSQL_BIN）"
fi
[ -f "$TSV" ] || fail "找不到版本矩阵：$TSV"

# ---------------------------------------------------------------------------
# 2. 硬门槛 1：目标库必须严格等于 xingyu_hub
#    （唯一例外是 --probe-db 探针通道，且库名被正则强制约束，指向不到 dev / 测试库）
# ---------------------------------------------------------------------------
if [ -n "$PROBE_DB" ]; then
  if ! printf '%s' "$PROBE_DB" | grep -Eq '^xingyu_hub_recon_probe(_[0-9]{8}-[0-9]{6})?$'; then
    fail "--probe-db 只接受 xingyu_hub_recon_probe[_YYYYMMDD-HHMMSS] 形式的副本库名，收到 '$PROBE_DB'"
  fi
  TARGET_DB="$PROBE_DB"
  echo "⚠️  PROBE 模式：目标库 = $TARGET_DB（dev 副本，非真实 dev）"
elif [ "$TARGET_DB" != "xingyu_hub" ]; then
  fail "目标库必须是 xingyu_hub，当前 TARGET_DB='$TARGET_DB'（禁止对测试库/其它库补录）"
fi
if [ "$FRESH_DB" = "$TARGET_DB" ]; then
  fail "FRESH_DB 与 TARGET_DB 相同，无法做结构指纹比对"
fi
ok "目标库 = $TARGET_DB（严格校验通过），fresh 基线 = $FRESH_DB"

# ---------------------------------------------------------------------------
# 3. mysql 调用封装
# ---------------------------------------------------------------------------
mysql_raw() { # $1 = db, $2.. = 参数
  local db="$1"; shift
  MYSQL_PWD="$DB_PASS" "$MYSQL_BIN" -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    --default-character-set=utf8mb4 --batch --raw "$db" "$@"
}
mysql_sql() { mysql_raw "$1" -e "$2"; }          # 带列名
mysql_val() { mysql_raw "$1" -N -e "$2" | tr -d '\r'; }  # 单值/无列名

FINGERPRINT_SQL="$(cat <<'SQL'
SET SESSION group_concat_max_len = 1048576;
SELECT CONCAT('COL|',TABLE_NAME,'|',ORDINAL_POSITION,'|',COLUMN_NAME,'|',COLUMN_TYPE,'|',IS_NULLABLE,'|',IFNULL(COLUMN_DEFAULT,'~'),'|',EXTRA,'|',IFNULL(CHARACTER_SET_NAME,'-'),'|',IFNULL(COLLATION_NAME,'-'),'|',COLUMN_COMMENT) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
UNION ALL SELECT CONCAT('IDX|',TABLE_NAME,'|',INDEX_NAME,'|',NON_UNIQUE,'|',SEQ_IN_INDEX,'|',IFNULL(COLUMN_NAME,'~'),'|',IFNULL(SUB_PART,'-'),'|',INDEX_TYPE) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
UNION ALL SELECT CONCAT('CON|',TABLE_NAME,'|',CONSTRAINT_NAME,'|',CONSTRAINT_TYPE) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE()
UNION ALL SELECT CONCAT('FK|',k.TABLE_NAME,'|',k.CONSTRAINT_NAME,'|',k.COLUMN_NAME,'|',k.REFERENCED_TABLE_NAME,'|',k.REFERENCED_COLUMN_NAME,'|',r.UPDATE_RULE,'|',r.DELETE_RULE) FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
UNION ALL SELECT CONCAT('TBL|',TABLE_NAME,'|',ENGINE,'|',ROW_FORMAT,'|',TABLE_COLLATION,'|',TABLE_COMMENT) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
ORDER BY 1;
SQL
)"
struct_fingerprint() { # $1 = db
  mysql_val "$1" "$FINGERPRINT_SQL" | sed 's/\r$//' | LC_ALL=C sort | sha256sum | awk '{print $1}'
}

# ---------------------------------------------------------------------------
# 4. 硬门槛 2/3：显式白名单 + 文件 LF SHA-256 与 TSV 完全一致
# ---------------------------------------------------------------------------
# TSV 是本脚本的唯一输入与白名单来源，它的字节必须干净：BOM 会让第一行版本号解析失败。
bom="$(head -c 3 "$TSV" | od -An -tx1 | tr -d ' \n')"
[ "$bom" != "efbbbf" ] \
  || fail "$TSV 带 UTF-8 BOM，请去掉后再运行（BOM 会污染第一行的 version 字段）"

VERSIONS=()
CHECKSUMS=()
CLASSES=()
while IFS=$'\t' read -r ver cksum cls _rest; do
  ver="${ver%$'\r'}"
  case "$ver" in ''|\#*) continue ;; esac
  [ -n "${ver:-}" ] && [ -n "${cksum:-}" ] && [ -n "${cls:-}" ] || fail "TSV 行格式不合法: $ver"
  VERSIONS+=("$ver"); CHECKSUMS+=("$cksum"); CLASSES+=("$cls")
done < "$TSV"

[ "${#VERSIONS[@]}" -eq "$EXPECTED_NEW_ROWS" ] \
  || fail "白名单版本数必须为 $EXPECTED_NEW_ROWS，实际 ${#VERSIONS[@]}"
ok "显式白名单载入 ${#VERSIONS[@]} 个版本：${VERSIONS[*]}"

for i in "${!VERSIONS[@]}"; do
  ver="${VERSIONS[$i]}"; want="${CHECKSUMS[$i]}"
  files=( "$SQL_DIR"/V"$ver"__*.sql )
  [ -f "${files[0]}" ] || fail "缺少迁移文件：sql/V${ver}__*.sql"
  [ "${#files[@]}" -eq 1 ] || fail "版本 $ver 匹配到多个迁移文件"
  f="${files[0]}"
  # 规范字节必须是 LF：CRLF 工作区会算出另一个 checksum
  # 注意：不要用 grep 匹配 CR 字符——Git Bash 下把裸 CR 当参数传递不可靠，
  # 改用 tr 按转义序列计数（'\\r' 是反斜杠+r，由 tr 自己解释）。
  cr_bytes="$(tr -dc '\r' < "$f" | wc -c | tr -d ' ')"
  if [ "$cr_bytes" -ne 0 ]; then
    fail "$f 含 $cr_bytes 个 CR（工作区字节非规范 LF），先 git show HEAD:${f#$ROOT_DIR/} 重写"
  fi
  got="$(sha256sum "$f" | awk '{print $1}')"
  [ "$got" = "$want" ] \
    || fail "版本 $ver 的 LF SHA-256 与 TSV 不一致：file=$got tsv=$want"
done
ok "18 个迁移文件的 LF SHA-256 与 TSV 逐版本一致（且均为规范 LF 字节）"

# ---------------------------------------------------------------------------
# 5. 硬门槛 4：18 个版本在目标台账中必须全部不存在
# ---------------------------------------------------------------------------
IN_LIST="$(printf "'%s'," "${VERSIONS[@]}")"; IN_LIST="${IN_LIST%,}"
pre_rows="$(mysql_val "$TARGET_DB" "SELECT COUNT(*) FROM schema_migration")"
[ "$pre_rows" = "$EXPECTED_PRE_ROWS" ] \
  || fail "目标台账行数应为 $EXPECTED_PRE_ROWS（补录前基线），实际 $pre_rows"

already="$(mysql_val "$TARGET_DB" "SELECT COUNT(*) FROM schema_migration WHERE version IN ($IN_LIST)")"
[ "$already" = "0" ] \
  || fail "目标台账已存在 $already 条白名单版本记录（补录必须是幂等前置失败，不允许覆盖）"
ok "目标台账 $pre_rows 行；18 个白名单版本全部不存在"

# ---------------------------------------------------------------------------
# 6. 硬门槛 5：dev/fresh 结构指纹必须一致
# ---------------------------------------------------------------------------
fp_target="$(struct_fingerprint "$TARGET_DB")"
fp_fresh="$(struct_fingerprint "$FRESH_DB")"
[ "$fp_target" = "$fp_fresh" ] \
  || fail "结构指纹不一致：$TARGET_DB=$fp_target  $FRESH_DB=$fp_fresh（DDL 后置条件不成立，禁止补录）"
[ "$fp_target" = "$EXPECTED_STRUCT_FP" ] \
  || fail "结构指纹与审计基线不符：实际 $fp_target 期望 $EXPECTED_STRUCT_FP"
ok "dev/fresh 结构指纹一致 = $fp_target（= 审计基线）"

# ---------------------------------------------------------------------------
# 7. 硬门槛 6：B 类要求 V041 已 SUCCESS 且 checksum 正确
# ---------------------------------------------------------------------------
has_b=0; for c in "${CLASSES[@]}"; do [ "$c" = "B" ] && has_b=1; done
if [ "$has_b" = "1" ]; then
  v041="$(mysql_val "$TARGET_DB" "SELECT CONCAT(status,'|',checksum) FROM schema_migration WHERE version='041'")"
  [ "$v041" = "SUCCESS|$V041_CHECKSUM" ] \
    || fail "B 类前置不满足：V041 需 status=SUCCESS 且 checksum=$V041_CHECKSUM，实际 '$v041'"
  ok "B 类前置满足：V041 = SUCCESS 且 checksum 正确（补偿关系已落地）"
fi

# ---------------------------------------------------------------------------
# 8. 硬门槛 7：C 类 V032 要求 V001 形状前置条件成立
# ---------------------------------------------------------------------------
has_c=0; for c in "${CLASSES[@]}"; do [ "$c" = "C" ] && has_c=1; done
if [ "$has_c" = "1" ]; then
  v001="$(mysql_val "$TARGET_DB" "SELECT CONCAT(status,'|',checksum) FROM schema_migration WHERE version='001'")"
  [ "$v001" = "SUCCESS|$V001_LEGACY_CHECKSUM" ] \
    || fail "C 类前置不满足：V001 台账需 SUCCESS|$V001_LEGACY_CHECKSUM，实际 '$v001'"

  shape="$(mysql_val "$TARGET_DB" "
    SELECT IF(
      (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME='sys_file_config' AND COLUMN_NAME='name' AND COLUMN_TYPE='varchar(100)')=1
      AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME='sys_file_config' AND COLUMN_NAME IN ('create_by','update_by'))=2
      AND (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME='sys_file_config' AND INDEX_NAME IN ('idx_storage_type','idx_master'))=2
      AND (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME='sys_file_config' AND TABLE_COMMENT='文件存储配置表')=1,
      'PASS','FAIL');")"
  [ "$shape" = "PASS" ] \
    || fail "C 类前置不满足：sys_file_config 不是 V001 ruoyi 形状（V032 应为 no-op 的前提不成立）"
  ok "C 类前置满足：V001 台账正确，且 sys_file_config 为 V001 形状（V032 确为 no-op）"
fi

# ---------------------------------------------------------------------------
# 9. 组装 18 行 INSERT（applied_at 取当前时间，不伪造历史）
# ---------------------------------------------------------------------------
VALUES=""
for i in "${!VERSIONS[@]}"; do
  VALUES+="('${VERSIONS[$i]}','${CHECKSUMS[$i]}','RECONCILED',CURRENT_TIMESTAMP),"$'\n'
done
VALUES="${VALUES%$'\n'}"
VALUES="${VALUES%,}"
INSERT_SQL="INSERT INTO schema_migration (version, checksum, status, applied_at) VALUES
$VALUES;"

echo
echo "──────────────────────────────────────────────────────────────"
if [ "$MODE" = "dry-run" ]; then
  echo "DRY-RUN：以上前置条件全部通过，但**未写入任何数据**。"
  echo "计划执行（单事务、$EXPECTED_NEW_ROWS 行、status='RECONCILED'）："
  echo "$INSERT_SQL"
  echo
  echo "如确认无误，用 --apply 真正补录。"
  echo "──────────────────────────────────────────────────────────────"
  exit 0
fi

# ---------------------------------------------------------------------------
# 10. APPLY：单会话 + 同一把锁 + 单事务 + 事务内自校验
# ---------------------------------------------------------------------------
echo "APPLY：开始补录（库=$TARGET_DB，锁=$LOCK_NAME）..."
echo "──────────────────────────────────────────────────────────────"

APPLY_SQL="$(cat <<SQL
-- 记录本连接的 CONNECTION_ID，后面用它自证"锁没被换到别的连接上"
SET @conn_id = CONNECTION_ID();
SET @lock = (SELECT GET_LOCK('$LOCK_NAME', 30));
-- 锁内二次确认：白名单版本仍必须全部不存在（防并发/防重复执行）
SET @already = (SELECT COUNT(*) FROM schema_migration WHERE version IN ($IN_LIST));
SET @pre_cnt = (SELECT COUNT(*) FROM schema_migration);
SET @gate = IF(@lock = 1 AND @already = 0 AND @pre_cnt = $EXPECTED_PRE_ROWS, 1, 0);
-- 取锁失败或基线已变：此时事务尚未开启，硬失败不会留下任何写入
SET @s = IF(@gate = 1, 'SELECT 1', 'SELECT 1 FROM _ABORTED_reconciliation_precondition_changed');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TEMPORARY TABLE _pre AS
  SELECT version, checksum, status, applied_at FROM schema_migration;

START TRANSACTION;
$INSERT_SQL

-- 事务内自校验
SET @new_cnt  = (SELECT COUNT(*) FROM schema_migration WHERE version IN ($IN_LIST));
SET @new_bad  = (SELECT COUNT(*) FROM schema_migration WHERE version IN ($IN_LIST) AND status <> 'RECONCILED');
SET @orig_bad = (SELECT COUNT(*) FROM _pre p LEFT JOIN schema_migration m ON m.version = p.version
                 WHERE m.version IS NULL
                    OR NOT (m.checksum   <=> p.checksum)
                    OR NOT (m.status     <=> p.status)
                    OR NOT (m.applied_at <=> p.applied_at));
SET @total = (SELECT COUNT(*) FROM schema_migration);
SET @ok = IF(@new_cnt = $EXPECTED_NEW_ROWS AND @new_bad = 0 AND @orig_bad = 0
             AND @total = $EXPECTED_PRE_ROWS + $EXPECTED_NEW_ROWS, 1, 0);

-- 显式提交或回滚（都在同一连接内完成），不再依赖连接断开的隐式回滚
SET @s = IF(@ok = 1, 'COMMIT', 'ROLLBACK');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 自证标记 + 提交后校验（bash 侧逐个断言）
SELECT CONCAT('APPLY_OK=',          @ok);
SELECT CONCAT('SAME_CONNECTION=',   CONNECTION_ID() = @conn_id);
SELECT CONCAT('LOCK_OWNED_BY_US=',  IFNULL(IS_USED_LOCK('$LOCK_NAME') = @conn_id, 0));
SELECT CONCAT('POST_TOTAL=',        (SELECT COUNT(*) FROM schema_migration));
SELECT CONCAT('POST_RECONCILED=',   (SELECT COUNT(*) FROM schema_migration WHERE status = 'RECONCILED'));
SELECT CONCAT('POST_ORIG_BAD=',     (SELECT COUNT(*) FROM _pre p LEFT JOIN schema_migration m ON m.version = p.version
                                     WHERE m.version IS NULL
                                        OR NOT (m.checksum   <=> p.checksum)
                                        OR NOT (m.status     <=> p.status)
                                        OR NOT (m.applied_at <=> p.applied_at)));
SELECT CONCAT('POST_EXTRA=',        (SELECT COUNT(*) FROM schema_migration m LEFT JOIN _pre p ON p.version = m.version
                                     WHERE p.version IS NULL AND m.status <> 'RECONCILED'));
SELECT CONCAT('RELEASED=',          RELEASE_LOCK('$LOCK_NAME'));
SQL
)"

set +e
OUT="$(mysql_raw "$TARGET_DB" -N -e "$APPLY_SQL")"
rc=$?
set -e
echo "$OUT"
[ "$rc" -eq 0 ] || fail "补录事务失败（已回滚或已中止），mysql 退出码=$rc"

assert_marker() { # $1 = marker, $2 = expected
  local line got
  line="$(printf '%s\n' "$OUT" | tr -d '\r' | grep -E "^$1" | tail -1)"
  [ -n "$line" ] || fail "缺少校验标记 $1"
  got="${line#*=}"
  [ "$got" = "$2" ] || fail "校验标记 $1=$got，期望 $2"
}

# 先判事务内自校验结果：失败说明已显式 ROLLBACK，台账未被改动
apply_ok="$(printf '%s\n' "$OUT" | tr -d '\r' | grep -E '^APPLY_OK=' | tail -1)"
apply_ok="${apply_ok#*=}"
[ "$apply_ok" = "1" ] \
  || fail "事务内自校验未通过，已显式 ROLLBACK（APPLY_OK=$apply_ok），台账未做任何修改"

# 锁生命周期自证：取锁/提交/释放必须同连接，且释放前锁仍归本连接
assert_marker "SAME_CONNECTION="   "1"
assert_marker "LOCK_OWNED_BY_US="  "1"
assert_marker "RELEASED="          "1"

assert_marker "POST_TOTAL="      "$((EXPECTED_PRE_ROWS + EXPECTED_NEW_ROWS))"
assert_marker "POST_RECONCILED=" "$EXPECTED_NEW_ROWS"
assert_marker "POST_ORIG_BAD="   "0"
assert_marker "POST_EXTRA="      "0"

echo "──────────────────────────────────────────────────────────────"
ok "补录完成：台账 $EXPECTED_PRE_ROWS -> $((EXPECTED_PRE_ROWS + EXPECTED_NEW_ROWS)) 行"
ok "新增 $EXPECTED_NEW_ROWS 条 status='RECONCILED'；原有 $EXPECTED_PRE_ROWS 行逐字段未变"
echo
echo "后续：确认 xingyu.schema.migration.enabled=true 时应用能识别 000-041 全部已满足。"

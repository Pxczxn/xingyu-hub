#!/usr/bin/env bash
# =============================================================================
# ci-apply-migrations.sh —— **fresh-only** 迁移应用脚本（CI / 本地全新库）
#
# 用途：对一个**全新**数据库按序应用 sql/V*.sql，并把成功版本写入 schema_migration。
#
# ⚠️ 本脚本会**无条件重放**全部迁移，因此它只允许作用于 fresh 库。
#    它没有任何理由操作历史 dev 库 —— dev 的重建由 sql/rebuild.ps1 负责（会显式 DROP）。
#
# 硬约束（任一不满足都在执行任何 migration SQL 之前退出）：
#   1) DB_NAME 必须由调用方显式提供（**无默认值**，不再默认 xingyu_hub）
#   2) DB_PASSWORD 必须由调用方显式提供（**无默认值**；仓库内不得存在可用的密码默认值）
#   3) DB_NAME 必须匹配 ^[A-Za-z0-9_]{1,64}$（该值会被插值进 SQL 标识符）
#   4) DB_NAME 无条件硬拒绝 xingyu_hub
#   5) 目标库必须确为 fresh：不存在（允许创建并继续），或存在但
#      information_schema.TABLES 中**一张表都没有**。只要已存在**任何**表即拒绝 ——
#      刻意不只检查 schema_migration，因为"没有 ledger 但已有业务表"的库同样禁止重放。
#
# defense-in-depth（不是主要防线，第 5 条已覆盖，保留以防第 5 条将来被放宽）：
#   * 目标台账若含 RECONCILED（审计补偿记账）记录，给出更具体的拒绝提示。
#   * 最终写台账用**普通 INSERT**，没有 ON DUPLICATE KEY UPDATE；
#     出现 duplicate 直接失败 —— 作为"目标其实不是 fresh"的最后一道保险。
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${SQL_DIR:-$ROOT_DIR/sql}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

fail() { echo "❌ 拒绝执行：$*" >&2; echo "   未执行任何 migration SQL。" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. 连接前校验：全部发生在建立任何连接之前
# ---------------------------------------------------------------------------
[ -n "$DB_NAME" ] \
  || fail "必须显式提供 DB_NAME（本脚本不再默认 xingyu_hub）"
[ -n "$DB_PASSWORD" ] \
  || fail "必须显式提供 DB_PASSWORD（仓库内不得存在可用的密码默认值）"
printf '%s' "$DB_NAME" | grep -Eq '^[A-Za-z0-9_]{1,64}$' \
  || fail "DB_NAME 只允许字母/数字/下划线且长度 1-64，收到 '$DB_NAME'"
[ "$DB_NAME" != "xingyu_hub" ] \
  || fail "本脚本是 fresh-only，禁止操作开发库 xingyu_hub（重建 dev 请用 sql/rebuild.ps1）"

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --default-character-set=utf8mb4)

if ! "${MYSQL[@]}" -N -B -e "SELECT 1;" >/dev/null 2>&1; then
  fail "无法连接 MySQL ${DB_HOST}:${DB_PORT}（用户 ${DB_USER}）"
fi

# ---------------------------------------------------------------------------
# 2. 新鲜度校验
# ---------------------------------------------------------------------------
# (a) defense-in-depth：台账含 RECONCILED 时给出更具体的提示（表/库不存在时无输出，直接放行）
if "${MYSQL[@]}" "$DB_NAME" -N -B \
     -e "SELECT 1 FROM schema_migration WHERE status = 'RECONCILED' LIMIT 1;" 2>/dev/null | grep -q 1; then
  fail "${DB_NAME}.schema_migration 含 RECONCILED 记录（审计补偿记账）；本脚本会重放迁移并覆盖台账状态"
fi

# (b) 主要防线：库已存在且含任何表 -> 不是 fresh
db_exists="$("${MYSQL[@]}" -N -B \
  -e "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${DB_NAME}';")"
if [ "$db_exists" != "0" ]; then
  table_count="$("${MYSQL[@]}" -N -B \
    -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${DB_NAME}';")"
  if [ "$table_count" != "0" ]; then
    sample="$("${MYSQL[@]}" -N -B -e "
      SELECT GROUP_CONCAT(TABLE_NAME ORDER BY TABLE_NAME SEPARATOR ', ')
      FROM (SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = '${DB_NAME}' ORDER BY TABLE_NAME LIMIT 10) AS t;")"
    fail "${DB_NAME} 已存在且含 ${table_count} 张表（例如：${sample}），不是 fresh 库"
  fi
  echo "ℹ️  ${DB_NAME} 已存在但为空（0 张表），按 fresh 处理。"
else
  echo "ℹ️  ${DB_NAME} 不存在，将创建。"
fi

# ---------------------------------------------------------------------------
# 3. 应用迁移
# ---------------------------------------------------------------------------
echo "Preparing database ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."
"${MYSQL[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

inserts=()
while IFS= read -r file; do
  name="$(basename "$file")"
  echo "Applying ${name}..."
  "${MYSQL[@]}" "$DB_NAME" < "$file"

  version="${name#V}"
  version="${version%%__*}"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  inserts+=("('${version}', '${checksum}', 'SUCCESS')")
done < <(ls -1 "$SQL_DIR"/V*.sql | sort -V)

# ---------------------------------------------------------------------------
# 4. 写台账：fresh-only => 普通 INSERT，绝不 ON DUPLICATE KEY UPDATE
# ---------------------------------------------------------------------------
if ((${#inserts[@]} > 0)); then
  sql="INSERT INTO schema_migration (version, checksum, status) VALUES $(IFS=,; echo "${inserts[*]}");"
  if ! "${MYSQL[@]}" "$DB_NAME" -e "$sql"; then
    echo "❌ 写入 schema_migration 失败（极可能是 duplicate key：目标库并非 fresh）。" >&2
    echo "   按 fresh-only 约定中止，未做任何覆盖/补救。" >&2
    exit 1
  fi
fi

echo "Migrations applied: ${#inserts[@]} files."

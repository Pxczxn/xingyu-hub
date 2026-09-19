#!/usr/bin/env bash
# CI / 本地：按序应用 sql/V*.sql 并写入 schema_migration 校验记录
#
# ⚠️ 本脚本会**无条件重放**全部 sql/V*.sql，并最终用
#    ON DUPLICATE KEY UPDATE status='SUCCESS' 覆盖台账。
#    因此它只适用于**全新库**；对已有台账的库（尤其 dev xingyu_hub）重放历史迁移是禁止的。
#    防护：目标台账若已含 RECONCILED（审计补偿记账）记录，脚本在任何 SQL 之前拒绝执行。
#    背景见 maintenance/reconciliation/PLAN.md。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${SQL_DIR:-$ROOT_DIR/sql}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-root}"
DB_NAME="${DB_NAME:-xingyu_hub}"

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --default-character-set=utf8mb4)

if [ "$DB_NAME" = "xingyu_hub" ]; then
  echo "⚠️  注意：目标库是开发库 xingyu_hub。本脚本会重放全部迁移，通常你不该这么做" >&2
  echo "   （重建 dev 请用 sql/rebuild.ps1）。" >&2
fi

# 防护：RECONCILED 是"最终语义经审计已满足、但历史执行未经证实"的补偿记账，
# 不能被本脚本的 ON DUPLICATE KEY UPDATE 静默改写成 SUCCESS。
# 表不存在（全新库）时该查询无输出，脚本继续执行。
if "${MYSQL[@]}" "$DB_NAME" -N -B \
     -e "SELECT 1 FROM schema_migration WHERE status = 'RECONCILED' LIMIT 1;" 2>/dev/null | grep -q 1; then
  echo "❌ 拒绝执行：${DB_NAME}.schema_migration 含 RECONCILED 记录。" >&2
  echo "   本脚本会无条件重放全部迁移并覆盖台账状态，会破坏 reconciliation 语义。" >&2
  echo "   未执行任何 SQL。若确实要重建该库，请用 sql/rebuild.ps1（会显式 DROP）。" >&2
  exit 1
fi

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

if ((${#inserts[@]} > 0)); then
  sql="INSERT INTO schema_migration (version, checksum, status) VALUES $(IFS=,; echo "${inserts[*]}") ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), status='SUCCESS', applied_at=CURRENT_TIMESTAMP;"
  "${MYSQL[@]}" "$DB_NAME" -e "$sql"
fi

echo "Migrations applied: ${#inserts[@]} files."

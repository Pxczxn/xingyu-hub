#!/usr/bin/env bash
# CI / 本地：按序应用 sql/V*.sql 并写入 schema_migration 校验记录
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${SQL_DIR:-$ROOT_DIR/sql}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-root}"
DB_NAME="${DB_NAME:-xingyu_hub}"

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --default-character-set=utf8mb4)

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

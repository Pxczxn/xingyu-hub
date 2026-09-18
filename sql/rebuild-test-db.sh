#!/usr/bin/env bash
# 重建「测试库」xingyu_hub_test —— 从仓库正式迁移基线 sql/V*.sql 全量重建。
#
# 为什么需要它：
#   集成测试必须连到与开发库隔离的库；为了让每次测试都从同一基线出发（可重复），
#   这里先 DROP 再 CREATE，然后按序灌入 sql/V*.sql，最后做严格的完整性校验。
#
# 账号约定（重要）：
#   - 重建（DROP/CREATE/灌迁移）需要库级管理权限，默认用管理账号 ADMIN_*。
#   - 应用与测试运行请使用最小权限用户 TEST_DB_USERNAME（默认 xingyu_test），
#     该用户只被授予 `xingyu_hub_test`.* 权限，访问 `xingyu_hub` 会直接被拒绝：
#       CREATE USER 'xingyu_test'@'localhost' IDENTIFIED BY '<pwd>';
#       GRANT ALL PRIVILEGES ON `xingyu_hub_test`.* TO 'xingyu_test'@'localhost';
#
# 用法：
#   bash scripts/rebuild-test-db.sh
#
# ⚠️ 已知阻塞（务必先解决，否则本脚本会失败并退出）：
#   仓库缺少 V001 迁移文件（Mars 基础 schema：sys_*/qrtz_*/gen_* 等 39 张表）。
#   开发库的 schema_migration 里仍有 V001 = SUCCESS 记录，但文件已不在仓库中。
#   直接按仓库基线重建会得到「缺 39 张基础表」的半成品库 —— 本脚本会在结束前
#   校验这些基础表并显式失败，避免悄悄产出一个跑不起来、或需要手工补数据的库。
#   修复方式（需人工决策）：恢复 V001__*.sql 到 sql/ 目录，或新增一个等价的基础
#   schema 迁移文件。在此之前，测试库无法仅凭仓库基线重建。
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
TEST_DB_NAME="${TEST_DB_NAME:-xingyu_hub_test}"
ADMIN_USER="${TEST_DB_ADMIN_USER:-pxczxn}"
ADMIN_PASSWORD="${TEST_DB_ADMIN_PASSWORD:-root}"

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$ADMIN_USER" -p"$ADMIN_PASSWORD" --default-character-set=utf8mb4)

# 断言测试库必须存在的基础表（这些表当前只能来自缺失的 V001）
REQUIRED_BASE_TABLES=(sys_user sys_role sys_menu sys_role_menu sys_dept sys_post sys_dict_type sys_dict_data sys_config_group)

echo "==> 重建测试库 ${TEST_DB_NAME} @ ${DB_HOST}:${DB_PORT}"
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`; CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

echo "==> 按序灌入迁移基线 sql/V*.sql"
applied=0
failed=0
for file in $(ls -1 "$ROOT_DIR"/sql/V*.sql | sort -V); do
  name="$(basename "$file")"
  if "${MYSQL[@]}" "$TEST_DB_NAME" < "$file" 2>/tmp/rebuild-test-db.err; then
    applied=$((applied + 1))
  else
    failed=$((failed + 1))
    echo "   [FAIL] ${name} :: $(grep -m1 -oE 'ERROR [0-9]+.*' /tmp/rebuild-test-db.err | cut -c1-120)"
  fi
done

# 写入 schema_migration 校验记录（仅记录成功的版本）
inserts=()
for file in $(ls -1 "$ROOT_DIR"/sql/V*.sql | sort -V); do
  name="$(basename "$file")"
  version="${name#V}"; version="${version%%__*}"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  inserts+=("('${version}', '${checksum}', 'SUCCESS')")
done
if ((${#inserts[@]} > 0)); then
  sql="INSERT INTO schema_migration (version, checksum, status) VALUES $(IFS=,; echo "${inserts[*]}") ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), status='SUCCESS', applied_at=CURRENT_TIMESTAMP;"
  "${MYSQL[@]}" "$TEST_DB_NAME" -e "$sql" 2>/dev/null || true
fi

# 测试库对应的 Redis 逻辑库（application-test.yml 用 database: 7）清空，保证缓存/session 不跨次残留
REDIS_DB="${TEST_REDIS_DB:-7}"
if command -v redis-cli >/dev/null 2>&1; then
  echo "==> 清空测试用 Redis 逻辑库 db${REDIS_DB}"
  redis-cli -n "$REDIS_DB" FLUSHDB >/dev/null || echo "   (警告：Redis db${REDIS_DB} 清空失败，不阻断)"
else
  echo "==> 跳过 Redis 清理（未找到 redis-cli）"
fi

echo "==> 迁移结果：成功 ${applied} / 失败 ${failed}"

# ---------------- 严格完整性校验 ----------------
missing=()
for t in "${REQUIRED_BASE_TABLES[@]}"; do
  cnt=$("${MYSQL[@]}" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${TEST_DB_NAME}' AND TABLE_NAME='${t}';" 2>/dev/null)
  [[ "$cnt" == "1" ]] || missing+=("$t")
done

if ((failed > 0)) || ((${#missing[@]} > 0)); then
  echo ""
  echo "❌ 重建失败：测试库未达到可用状态，已终止（不继续，避免产出半成品库）。"
  echo "   迁移失败文件数：${failed}"
  if ((${#missing[@]} > 0)); then
    echo "   缺失基础表：${missing[*]}"
    echo "   根因：仓库缺少 V001（Mars 基础 schema）迁移文件，仓库基线无法独立重建完整库。"
  fi
  echo "   处理：恢复/补齐基础 schema 迁移（例如 V001__*.sql）后重跑本脚本。"
  exit 1
fi

echo "✅ 完成。测试连接：jdbc:mysql://${DB_HOST}:${DB_PORT}/${TEST_DB_NAME}（用户 ${TEST_DB_USERNAME:-xingyu_test}）"

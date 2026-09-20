#!/usr/bin/env bash
# 重建「测试库」xingyu_hub_test —— 从仓库正式迁移基线 sql/V*.sql 全量重建。
#
# 设计目标只有一个固定测试库，因此**不提供"任意数据库重建"的灵活性**：
# 库名固定为 xingyu_hub_test，任何其它取值（包括 xingyu_hub、空值、其它 *_test 库）
# 都会在执行任何 SQL 之前被拒绝。
#
# 破坏性操作硬保护（均为 fail-fast，且都发生在任何 SQL 之前）：
#   1. TEST_DB_NAME 必须严格等于 xingyu_hub_test；
#   2. 管理员密码必须由环境变量 TEST_DB_ADMIN_PASSWORD 提供 —— 仓库不提交任何默认密码。
#
# 凭据约定：
#   - 重建（DROP/CREATE/灌迁移）需要库级管理权限 → TEST_DB_ADMIN_USER + TEST_DB_ADMIN_PASSWORD（必填）
#   - 应用与测试运行使用最小权限用户 → 默认 xingyu_test，仅被授予 `xingyu_hub_test`.* 权限，
#     访问 xingyu_hub 会被 MySQL 直接拒绝。其密码由 TEST_DB_PASSWORD 提供（见 application-test.yml），
#     本地可放在 gitignore 的 scripts/local-test-db.env 里，不要提交任何可用密码。
#
# 用法：
#   TEST_DB_ADMIN_PASSWORD='<pwd>' bash sql/rebuild-test-db.sh
#
# ⚠️ V001 为「历史兼容恢复」文件，不是原始文件的字节副本：
#   原始 V001__*.sql 已丢失（开发库 schema_migration 仍保留其历史记录，见下方常量），
#   现行 V001__mars_base_schema_and_seed.sql 按 MySQL binlog 中 2026-08-26 实际执行记录
#   + mars-system.sql 种子数据恢复而成，checksum 与历史值不同。
#   应用侧由 SchemaMigrator + LegacyMigrationChecksums 对 version=001 做精确兼容映射；
#   本脚本直接灌文件、不读兼容映射，因此会把**新** checksum 写入测试库台账（正确行为）。
# 说明：本脚本**刻意不启用 set -e** —— 迁移文件需要"逐个执行、收集全部失败后统一汇报"，
# 不能在第 1 个迁移失败时就中断。代价是每一步都必须显式检查返回值：
# 凡属**关键命令**（DROP/CREATE、最终台账写入、凭据预检等）失败，一律立即 exit 1，
# 绝不因缺少 set -e 而继续执行或打印成功。
set -uo pipefail

# 统一收集子命令的 stderr，失败时原样回显（避免静默吞掉 MySQL 报错）
ERR_LOG="$(mktemp)"
trap 'rm -f "$ERR_LOG"' EXIT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ============================================================================
# 固定目标 & 破坏性操作硬保护（必须在任何 SQL 之前完成）
# ============================================================================
readonly EXPECTED_TEST_DB="xingyu_hub_test"

# TEST_DB_NAME 的存在只是为了让上面的保护可被验证；它必须严格等于固定库名。
TEST_DB_NAME="${TEST_DB_NAME:-$EXPECTED_TEST_DB}"

if [[ -z "$TEST_DB_NAME" || "$TEST_DB_NAME" != "$EXPECTED_TEST_DB" ]]; then
  cat >&2 <<EOF
❌ 拒绝执行（未执行任何 SQL）。
   本脚本只允许重建固定测试库：${EXPECTED_TEST_DB}
   当前 TEST_DB_NAME = '${TEST_DB_NAME}'
   为防止误删开发库或其它数据库，脚本不提供"任意数据库重建"能力。请去掉 TEST_DB_NAME 后重试。
EOF
  exit 1
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
ADMIN_USER="${TEST_DB_ADMIN_USER:-pxczxn}"

if [[ -z "${TEST_DB_ADMIN_PASSWORD:-}" ]]; then
  cat >&2 <<EOF
❌ 拒绝执行（未执行任何 SQL）。
   缺少环境变量 TEST_DB_ADMIN_PASSWORD。
   仓库不提供管理员密码默认值（避免把可用凭据写进版本库）。
   用法：TEST_DB_ADMIN_PASSWORD='<pwd>' bash sql/rebuild-test-db.sh
EOF
  exit 1
fi

ADMIN_PASSWORD="$TEST_DB_ADMIN_PASSWORD"
TEST_DB_USERNAME="${TEST_DB_USERNAME:-xingyu_test}"

MYSQL=(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$ADMIN_USER" -p"$ADMIN_PASSWORD" --default-character-set=utf8mb4)

# 断言测试库必须存在的 V001 基础表（全部来自 V001__mars_base_schema_and_seed.sql，
# 且未被后续迁移删除）。V001 原有 45 张，其中 coder_banner / student / sys_chat_* 共 6 张
# Mars 演示对象由 V019__drop_mars_demo.sql 删除，故最终库应存在其余 39 张。
REQUIRED_BASE_TABLES=(
  sys_user sys_role sys_menu sys_role_menu sys_role_dept sys_user_role sys_user_post
  sys_dept sys_post sys_dict_type sys_dict_data sys_config_group
  sys_file sys_file_group sys_file_config sys_server sys_job sys_job_log
  sys_login_log sys_oper_log sys_api_access_log sys_sms_log
  sys_notice sys_notice_send_log sys_user_notice sys_user_blacklist
  gen_table gen_table_column
  qrtz_triggers qrtz_cron_triggers qrtz_simple_triggers qrtz_simprop_triggers
  qrtz_blob_triggers qrtz_calendars qrtz_fired_triggers qrtz_job_details
  qrtz_locks qrtz_paused_trigger_grps qrtz_scheduler_state
)

# ============================================================================
# 目标确认输出（执行前让人看清将要对谁执行破坏性操作）
# ============================================================================
echo "=============================================================="
echo " 测试库重建"
echo "--------------------------------------------------------------"
echo " MySQL 实例      : ${DB_HOST}:${DB_PORT}"
echo " 管理员账号      : ${ADMIN_USER}"
echo " 将被 DROP/CREATE: ${TEST_DB_NAME}   (固定值，不可更改)"
echo " 测试连接账号    : ${TEST_DB_USERNAME}"
echo " 迁移来源        : ${ROOT_DIR}/sql/V*.sql"
echo "=============================================================="

# 连通性预检：凭据错误要在 DROP 之前暴露，绝不先删库再失败
if ! "${MYSQL[@]}" -e "SELECT 1;" >/dev/null 2>"$ERR_LOG"; then
  echo "❌ 拒绝执行：管理员账号无法连接 ${DB_HOST}:${DB_PORT}（未执行任何 SQL）。" >&2
  sed 's/^/   /' "$ERR_LOG" >&2
  exit 1
fi

echo "==> DROP/CREATE ${TEST_DB_NAME}"
# 关键命令：必须显式检查返回值，失败即终止（不能依赖 set -e）
if ! "${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\`; CREATE DATABASE \`${TEST_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" >/dev/null 2>"$ERR_LOG"; then
  echo "❌ 失败：DROP/CREATE ${TEST_DB_NAME} 未成功，后续步骤已终止（测试库当前处于不确定状态）。" >&2
  sed 's/^/   /' "$ERR_LOG" >&2
  exit 1
fi

# ============================================================================
# 按序应用迁移，逐个记录"实际成功"的版本
# ============================================================================
echo "==> 按序灌入迁移基线 sql/V*.sql"
applied=0
failed_versions=()
failed_messages=()
success_versions=()
success_checksums=()

for file in $(ls -1 "$ROOT_DIR"/sql/V*.sql | sort -V); do
  name="$(basename "$file")"
  version="${name#V}"; version="${version%%__*}"
  # 迁移文件本体：允许逐个收集失败后统一汇报（不因单个失败中断）
  if "${MYSQL[@]}" "$TEST_DB_NAME" < "$file" 2>"$ERR_LOG"; then
    checksum="$(sha256sum "$file" | awk '{print $1}')"
    if [[ -z "$checksum" || ${#checksum} -ne 64 ]]; then
      failed_versions+=("$version")
      failed_messages+=("${name} :: 无法计算 checksum（sha256sum 失败）")
      continue
    fi
    applied=$((applied + 1))
    success_versions+=("$version")
    success_checksums+=("$checksum")
  else
    failed_versions+=("$version")
    failed_messages+=("${name} :: $(grep -m1 -oE 'ERROR [0-9]+.*' "$ERR_LOG" | cut -c1-110)")
  fi
done

echo "==> 迁移结果：成功 ${applied} / 失败 ${#failed_versions[@]}"
if (( ${#failed_messages[@]} > 0 )); then
  for msg in "${failed_messages[@]}"; do echo "   [FAIL] ${msg}"; done
fi

# ============================================================================
# 台账与成功判定：只有"全部迁移成功 + 基础表齐全"才写 SUCCESS 台账
# ============================================================================
missing=()
for t in "${REQUIRED_BASE_TABLES[@]}"; do
  cnt=$("${MYSQL[@]}" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${TEST_DB_NAME}' AND TABLE_NAME='${t}';" 2>/dev/null)
  [[ "$cnt" == "1" ]] || missing+=("$t")
done

if (( ${#failed_versions[@]} > 0 )) || (( ${#missing[@]} > 0 )); then
  echo ""
  echo "❌ 重建失败：测试库未达到可用状态，已终止。"
  echo "   迁移失败 ${#failed_versions[@]} 个：${failed_versions[*]:-无}"
  if (( ${#missing[@]} > 0 )); then
    echo "   基础表完整性校验失败：缺失 ${#missing[@]} 张必需表 -> ${missing[*]}"
    echo "   排查方向："
    echo "     1. 上述迁移失败清单是否已包含建这些表的迁移文件；"
    echo "     2. 迁移基线 sql/V*.sql 是否缺少承载基础 schema 的迁移（含其 DROP/CREATE 是否成功）；"
    echo "     3. 是否有迁移在后续步骤删除/重命名了这些表。"
  fi
  echo "   ⚠️ 未写入 schema_migration 台账：本次是完整重建，存在任何失败都不登记为成功版本。"
  exit 1
fi

# 全部成功才写台账，且只写实际执行成功的版本
inserts=()
for i in "${!success_versions[@]}"; do
  inserts+=("('${success_versions[$i]}', '${success_checksums[$i]}', 'SUCCESS')")
done
if (( ${#inserts[@]} > 0 )); then
  sql="INSERT INTO schema_migration (version, checksum, status) VALUES $(IFS=,; echo "${inserts[*]}") ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), status='SUCCESS', applied_at=CURRENT_TIMESTAMP;"
  # 关键命令：台账写入失败必须立即失败，绝不能打印"✅ 完成"
  if ! "${MYSQL[@]}" "$TEST_DB_NAME" -e "$sql" >/dev/null 2>"$ERR_LOG"; then
    echo "❌ 失败：写入 schema_migration 台账未成功，重建判定为失败。" >&2
    sed 's/^/   /' "$ERR_LOG" >&2
    exit 1
  fi
  ledger_rows=$("${MYSQL[@]}" -N -B -e "SELECT COUNT(*) FROM \`${TEST_DB_NAME}\`.schema_migration;" 2>/dev/null)
  if [[ -z "$ledger_rows" || "$ledger_rows" -lt ${#inserts[@]} ]]; then
    echo "❌ 失败：台账行数校验不通过（期望 >= ${#inserts[@]}，实际 ${ledger_rows:-无法读取}）。" >&2
    exit 1
  fi
  echo "==> 已写入 schema_migration 台账 ${#inserts[@]} 条（仅成功版本）"
  echo "==> 台账行数校验通过：${ledger_rows} 行"
fi

# 测试库对应的 Redis 逻辑库（application-test.yml 用 database: 7）清空，保证缓存/session 不跨次残留
REDIS_DB="${TEST_REDIS_DB:-7}"
if command -v redis-cli >/dev/null 2>&1; then
  echo "==> 清空测试用 Redis 逻辑库 db${REDIS_DB}"
  redis-cli -n "$REDIS_DB" FLUSHDB >/dev/null || echo "   (警告：Redis db${REDIS_DB} 清空失败，不阻断)"
else
  echo "==> 跳过 Redis 清理（未找到 redis-cli）"
fi

echo "✅ 完成。测试连接：jdbc:mysql://${DB_HOST}:${DB_PORT}/${TEST_DB_NAME}（用户 ${TEST_DB_USERNAME}，密码由 TEST_DB_PASSWORD 提供）"

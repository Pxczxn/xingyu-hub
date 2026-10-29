# 重建本地测试库 xingyu_hub_test（Windows / PowerShell）
#
# 这是 sql/rebuild-test-db.sh 的 Windows 等价实现，供没有 Git Bash 的开发机使用。
# 安全约束与 bash 版保持一致：
#   1. 目标库固定为 xingyu_hub_test，任何其它 TEST_DB_NAME 都拒绝；
#   2. 必须先提供 TEST_DB_ADMIN_PASSWORD，仓库不内置任何可用密码；
#   3. 逐个应用 sql/V*.sql，任何失败都不写 schema_migration 台账，并以非零退出。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File sql/rebuild-test-db.ps1
# 凭据可放在被 gitignore 的 scripts/local-test-db.env，或由当前进程环境变量提供。

$ErrorActionPreference = 'Continue'
chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = $PSScriptRoot
$root = Split-Path -Parent $scriptDir
$expectedDb = 'xingyu_hub_test'

# 本地凭据文件只补充未显式设置的变量，不覆盖调用者传入的环境。
$envFile = Join-Path $root 'scripts/local-test-db.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -Encoding UTF8) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim().Trim("'").Trim('"')
            if (-not (Test-Path "Env:$key")) {
                Set-Item -Path "Env:$key" -Value $value
            }
        }
    }
}

$dbName = if ($env:TEST_DB_NAME) { $env:TEST_DB_NAME } else { $expectedDb }
if ($dbName -ne $expectedDb) {
    Write-Host "拒绝执行：本脚本只能重建固定的测试库 $expectedDb（当前 TEST_DB_NAME='$dbName'）" -ForegroundColor Red
    exit 1
}

$adminUser = if ($env:TEST_DB_ADMIN_USER) { $env:TEST_DB_ADMIN_USER } else { 'pxczxn' }
$adminPassword = $env:TEST_DB_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminPassword)) {
    Write-Host "拒绝执行：缺少 TEST_DB_ADMIN_PASSWORD（可写入 scripts/local-test-db.env，或先设置环境变量）" -ForegroundColor Red
    exit 1
}
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }
$testUser = if ($env:TEST_DB_USERNAME) { $env:TEST_DB_USERNAME } else { 'xingyu_test' }

$mysql = $env:MYSQL_EXE
if ([string]::IsNullOrWhiteSpace($mysql)) {
    $command = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($command) {
        $mysql = $command.Source
    } elseif (Test-Path 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe') {
        $mysql = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
    }
}
if ([string]::IsNullOrWhiteSpace($mysql) -or -not (Test-Path $mysql)) {
    Write-Host "拒绝执行：找不到 mysql.exe（可设置 MYSQL_EXE 指向 MySQL 8 客户端）" -ForegroundColor Red
    exit 1
}

$conn = @(
    "--user=$adminUser",
    "--password=$adminPassword",
    "--host=$dbHost",
    "--port=$dbPort",
    '--default-character-set=utf8mb4'
)

function Fail([string]$message) {
    Write-Host $message -ForegroundColor Red
    exit 1
}

Write-Host "=============================================================="
Write-Host ' 测试库重建（PowerShell）'
Write-Host "--------------------------------------------------------------"
Write-Host " MySQL 实例      : ${dbHost}:${dbPort}"
Write-Host " 管理员账号      : ${adminUser}"
Write-Host " 目标库          : ${dbName}（DROP/CREATE）"
Write-Host " 应用连接账号    : ${testUser}（密码由 TEST_DB_PASSWORD 提供）"
Write-Host " 迁移目录        : $(Join-Path $root 'sql')"
Write-Host " mysql 客户端    : ${mysql}"
Write-Host "=============================================================="

& $mysql @conn -e 'SELECT 1;' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Fail "拒绝执行：管理员账号无法连接 ${dbHost}:${dbPort}，未执行任何 SQL。"
}

Write-Host "==> DROP/CREATE ${dbName}"
& $mysql @conn -e "DROP DATABASE IF EXISTS ``$dbName``; CREATE DATABASE ``$dbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" 2>$null
if ($LASTEXITCODE -ne 0) {
    Fail "失败：DROP/CREATE ${dbName} 未成功，重建终止（数据库可能处于不完整状态）。"
}

$files = Get-ChildItem (Join-Path $root 'sql') -Filter 'V*.sql' |
    Sort-Object { [int](($_.Name -replace '^V', '') -replace '__.*$', '') }

$ok = @()
$bad = @()
$checksums = @{}
foreach ($file in $files) {
    $version = ($file.Name -replace '^V', '') -replace '__.*$', ''
    $path = $file.FullName -replace '\\', '/'
    $output = & $mysql @conn $dbName --execute="source $path" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $checksums[$version] = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower()
        $ok += $version
        Write-Host "OK   V$version ($($file.Name))"
    } else {
        $bad += $version
        Write-Host "FAIL V$version ($($file.Name))" -ForegroundColor Red
        $output | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" }
    }
}

Write-Host "==> 迁移结果：成功 $($ok.Count) / 失败 $($bad.Count)"
if ($bad.Count -gt 0) {
    Write-Host "失败版本：$($bad -join ',')" -ForegroundColor Red
}

$required = @(
    'sys_user', 'sys_role', 'sys_menu', 'sys_role_menu', 'sys_role_dept', 'sys_user_role', 'sys_user_post',
    'sys_dept', 'sys_post', 'sys_dict_type', 'sys_dict_data', 'sys_config_group',
    'sys_file', 'sys_file_group', 'sys_file_config', 'sys_server', 'sys_job', 'sys_job_log',
    'sys_login_log', 'sys_oper_log', 'sys_api_access_log', 'sys_sms_log',
    'sys_notice', 'sys_notice_send_log', 'sys_user_notice', 'sys_user_blacklist',
    'gen_table', 'gen_table_column',
    'qrtz_triggers', 'qrtz_cron_triggers', 'qrtz_simple_triggers', 'qrtz_simprop_triggers',
    'qrtz_blob_triggers', 'qrtz_calendars', 'qrtz_fired_triggers', 'qrtz_job_details',
    'qrtz_locks', 'qrtz_paused_trigger_grps', 'qrtz_scheduler_state'
)
$tableRows = & $mysql @conn -N -B --execute="SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$dbName';" 2>$null
$missing = @($required | Where-Object { $tableRows -notcontains $_ })
if ($missing.Count -gt 0) {
    Write-Host "基础表完整性校验失败，缺少：$($missing -join ',')" -ForegroundColor Red
}

if ($bad.Count -gt 0 -or $missing.Count -gt 0) {
    Write-Host '重建失败：测试库未达到可用状态，未写入 schema_migration 台账。' -ForegroundColor Red
    exit 1
}

$values = $ok | ForEach-Object { "('$_','$($checksums[$_])','SUCCESS')" }
$insert = "INSERT INTO schema_migration (version, checksum, status) VALUES " + ($values -join ',') +
    " ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), status='SUCCESS', applied_at=CURRENT_TIMESTAMP;"
$insert | & $mysql @conn $dbName 2>$null
if ($LASTEXITCODE -ne 0) {
    Fail '失败：写入 schema_migration 台账未成功。'
}

$ledger = & $mysql @conn -N -B --execute="SELECT COUNT(*), MIN(version), MAX(version) FROM ``$dbName``.schema_migration;" 2>$null
$tableCount = & $mysql @conn -N -B --execute="SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$dbName';" 2>$null
if (-not $ledger -or [int](($ledger -split "`t")[0]) -lt $ok.Count) {
    Fail "失败：台账行数校验不通过（期望 >= $($ok.Count)，实际 $ledger）。"
}

$redisDb = if ($env:TEST_REDIS_DB) { $env:TEST_REDIS_DB } else { '7' }
$redis = Get-Command redis-cli.exe -ErrorAction SilentlyContinue
if ($redis) {
    & $redis.Source -n $redisDb FLUSHDB | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告：Redis db${redisDb} 清空失败，不阻断重建。" -ForegroundColor Yellow
    }
} else {
    Write-Host '==> 跳过 Redis 清理（未找到 redis-cli）'
}

Write-Host "==> 台账：$ledger"
Write-Host "==> 表数量：$tableCount"
Write-Host "完成：jdbc:mysql://${dbHost}:${dbPort}/${dbName}（用户 ${testUser}，密码由 TEST_DB_PASSWORD 提供）" -ForegroundColor Green
exit 0

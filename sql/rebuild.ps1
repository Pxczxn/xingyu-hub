param(
    [string]$User = "pxczxn",
    # 仓库不提交任何可用密码：默认留空，必须由参数或环境变量 DB_PASSWORD 提供，否则立即退出。
    [string]$Password = $env:DB_PASSWORD,
    [string]$Database = "xingyu_hub",
    [string]$MySql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"

# 破坏性操作前硬保护：没有密码、或目标库名不是预期值，一律不执行任何 SQL
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Error "缺少数据库密码。请通过 -Password 参数或环境变量 DB_PASSWORD 提供（本地可 source scripts/local-db.env）。已终止，未执行任何 SQL。"
    exit 1
}
if ($Database -ne "xingyu_hub") {
    Write-Error "本脚本仅服务开发库 xingyu_hub，当前 -Database=$Database。已终止，未执行任何 SQL。"
    exit 1
}

Write-Host "即将 DROP 并重建开发库：host=localhost  user=$User  database=$Database" -ForegroundColor Yellow
Write-Host "（该库所有数据将被清空；测试库请改用 sql/rebuild-test-db.sh）" -ForegroundColor Yellow

$versionsDir = $PSScriptRoot

Write-Host "Dropping and creating database $Database..."
& $MySql -u $User --password=$Password -e "DROP DATABASE IF EXISTS $Database; CREATE DATABASE $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

$files = Get-ChildItem $versionsDir -Filter "V*.sql" | Sort-Object { [int]($_.Name -replace '^V(\d+)__.*','$1') }
foreach ($f in $files) {
    Write-Host "Applying $($f.Name)..."
    Get-Content -Path $f.FullName -Raw -Encoding UTF8 | & $MySql -u $User --password=$Password --default-character-set=utf8mb4 $Database
}

$inserts = @()
foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text))
    $checksum = -join ($hashBytes | ForEach-Object { '{0:x2}' -f $_ })
    $version = $f.Name.Substring(1, $f.Name.IndexOf('__') - 1)
    $inserts += "('$version', '$checksum', 'SUCCESS')"
}
$sql = "INSERT INTO schema_migration (version, checksum, status) VALUES " + ($inserts -join ',') + " ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), status='SUCCESS', applied_at=CURRENT_TIMESTAMP;"
& $MySql -u $User --password=$Password $Database -e $sql

Write-Host "Done. Admin login: admin / admin123"

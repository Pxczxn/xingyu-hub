param(
    [string]$User = "pxczxn",
    [string]$Password = "root",
    [string]$Database = "xingyu_hub",
    [string]$MySql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"
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

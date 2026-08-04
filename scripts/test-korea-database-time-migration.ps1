param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"
$container = "writeloop-korea-time-test-$PID"
$database = "writeloop_korea_time_test"
$password = "korea_time_test_pw"

function Invoke-TestMySql {
    param([string]$Sql)

    $result = $Sql | docker exec -i -e "MYSQL_PWD=$password" $container `
        mysql --batch --skip-column-names --default-character-set=utf8mb4 -uroot $database
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL client failed with exit code $LASTEXITCODE"
    }
    return @($result)
}

try {
    docker run --name $container `
        -e "MYSQL_ROOT_PASSWORD=$password" `
        -e "MYSQL_DATABASE=$database" `
        -d mysql:8 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start temporary MySQL"
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        docker exec -e "MYSQL_PWD=$password" $container mysql -uroot -e "SELECT 1" 2>&1 | Out-Null
        $pingExitCode = $LASTEXITCODE
        $ErrorActionPreference = $previousErrorAction
        if ($pingExitCode -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw "Temporary MySQL did not become ready"
    }

    Invoke-TestMySql @"
SET time_zone = '+00:00';
CREATE TABLE feedback_diagnosis_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP(6) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE saved_expressions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  last_saved_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
INSERT INTO feedback_diagnosis_logs (created_at)
VALUES ('2026-08-04 12:00:00.000000');
INSERT INTO saved_expressions (created_at, updated_at, last_saved_at)
VALUES (
  '2026-08-04 12:00:00.000000',
  '2026-08-04 12:00:00.000000',
  '2026-08-04 12:00:00.000000'
);
"@ | Out-Null

    $migration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/101-normalize-database-times-to-korea.sql")
    Invoke-TestMySql $migration | Out-Null
    Invoke-TestMySql $migration | Out-Null

    $normalizedTimes = @(Invoke-TestMySql @"
SET time_zone = '+09:00';
SELECT CONCAT(
  DATE_FORMAT((SELECT created_at FROM feedback_diagnosis_logs WHERE id=1), '%Y-%m-%d %H:%i:%s'),
  ':',
  DATE_FORMAT((SELECT created_at FROM saved_expressions WHERE id=1), '%Y-%m-%d %H:%i:%s'),
  ':',
  DATE_FORMAT((SELECT updated_at FROM saved_expressions WHERE id=1), '%Y-%m-%d %H:%i:%s'),
  ':',
  DATE_FORMAT((SELECT last_saved_at FROM saved_expressions WHERE id=1), '%Y-%m-%d %H:%i:%s')
);
"@)
    if ($normalizedTimes -notcontains "2026-08-04 21:00:00:2026-08-04 21:00:00:2026-08-04 21:00:00:2026-08-04 21:00:00") {
        throw "TIMESTAMP display or DATETIME normalization did not produce Korea Standard Time"
    }

    $markerCount = @(Invoke-TestMySql @"
SELECT COUNT(*)
FROM writeloop_data_migrations
WHERE migration_key='101-normalize-database-times-to-korea';
"@)
    if ($markerCount -notcontains "1") {
        throw "Korea time migration was not idempotent"
    }

    Write-Output "Korea database time migration passed conversion and idempotency checks."
} finally {
    docker rm -f $container 2>$null | Out-Null
}

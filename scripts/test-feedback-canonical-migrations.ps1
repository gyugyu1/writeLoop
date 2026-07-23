param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"
$container = "writeloop-feedback-canonical-test-$PID"
$database = "writeloop_feedback_canonical_test"
$password = "feedback_canonical_test_pw"

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
CREATE TABLE feedback_diagnosis_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  diagnosis_on_topic BIT(1) NULL,
  diagnosis_task_completion VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE answer_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  score INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO feedback_diagnosis_logs(diagnosis_on_topic) VALUES (b'1'), (b'0'), (NULL);
INSERT INTO answer_attempts(score) VALUES (80);
"@ | Out-Null

    $topicMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/089-add-feedback-topic-relevance.sql")
    $scoreMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/090-retire-answer-feedback-score.sql")
    $utteranceMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/091-add-feedback-utterance-form.sql")
    Invoke-TestMySql $topicMigration | Out-Null
    Invoke-TestMySql $topicMigration | Out-Null
    Invoke-TestMySql $scoreMigration | Out-Null
    Invoke-TestMySql $scoreMigration | Out-Null
    Invoke-TestMySql $utteranceMigration | Out-Null
    Invoke-TestMySql $utteranceMigration | Out-Null

    $topicRows = Invoke-TestMySql @"
SELECT COALESCE(diagnosis_topic_relevance, 'NULL')
FROM feedback_diagnosis_logs
ORDER BY id;
"@
    if ((Compare-Object @("ON_TOPIC", "OFF_TOPIC", "NULL") $topicRows)) {
        throw "Topic relevance backfill did not preserve the canonical states"
    }

    $scoreNullable = @(Invoke-TestMySql @"
SELECT IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='answer_attempts'
  AND COLUMN_NAME='score';
"@)
    if ($scoreNullable -notcontains "YES") {
        throw "answer_attempts.score is still required"
    }

    $utteranceColumn = @(Invoke-TestMySql @"
SELECT CONCAT(DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME='diagnosis_utterance_form';
"@)
    if ($utteranceColumn -notcontains "varchar:YES") {
        throw "feedback_diagnosis_logs.diagnosis_utterance_form was not added as a nullable varchar"
    }

    Invoke-TestMySql "INSERT INTO answer_attempts(score) VALUES (NULL);" | Out-Null
    Write-Output "Canonical topic, utterance form, and retired score migrations passed syntax, backfill, and idempotency checks."
} finally {
    docker rm -f $container 2>$null | Out-Null
}

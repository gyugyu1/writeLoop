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
CREATE TABLE answer_attempts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL DEFAULT 'test-session',
  attempt_type VARCHAR(24) NOT NULL DEFAULT 'INITIAL',
  score INT NOT NULL,
  feedback_payload_json JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO answer_attempts(score, feedback_payload_json) VALUES (
  80,
  JSON_OBJECT(
    'loopComplete', false,
    'coachMove', JSON_OBJECT(
      'focus', '문법 한 곳 바로잡기',
      'instruction', '동사 형태를 고쳐 보세요.'
    )
  )
);
"@ | Out-Null

    $diagnosisBaseMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/031-create-feedback-diagnosis-logs.sql")
    $diagnosisResponseBodyMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/033-add-feedback-diagnosis-response-bodies.sql")
    $topicMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/089-add-feedback-topic-relevance.sql")
    $scoreMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/090-retire-answer-feedback-score.sql")
    $utteranceMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/091-add-feedback-utterance-form.sql")
    $contractRetryMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/096-add-feedback-contract-retry-observability.sql")
    $visibleFeedbackMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/097-add-visible-feedback-attempt-lifecycle.sql")
    $unifiedDiagnosisMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/098-unify-feedback-diagnosis-logs.sql")
    $tokenUsageMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/099-add-feedback-token-usage.sql")
    $providerRetryMigration = Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/100-add-feedback-provider-retry-observability.sql")
    Invoke-TestMySql $diagnosisBaseMigration | Out-Null
    Invoke-TestMySql $diagnosisResponseBodyMigration | Out-Null
    Invoke-TestMySql @"
INSERT INTO feedback_diagnosis_logs (
  prompt_id,
  prompt_topic,
  prompt_difficulty,
  prompt_question_en,
  prompt_question_ko,
  learner_answer,
  llm_provider,
  authoritative_feedback,
  diagnosis_fallback_used,
  deterministic_response_fallback_used,
  retry_attempted,
  diagnosis_on_topic
) VALUES
  ('topic-1', 'Topic', 'A', 'Question 1', '질문 1', 'Answer 1', 'openai', b'1', b'0', b'0', b'0', b'1'),
  ('topic-2', 'Topic', 'A', 'Question 2', '질문 2', 'Answer 2', 'openai', b'1', b'0', b'0', b'0', b'0'),
  ('topic-3', 'Topic', 'A', 'Question 3', '질문 3', 'Answer 3', 'openai', b'1', b'0', b'0', b'0', NULL);
"@ | Out-Null
    Invoke-TestMySql $topicMigration | Out-Null
    Invoke-TestMySql $topicMigration | Out-Null
    Invoke-TestMySql $scoreMigration | Out-Null
    Invoke-TestMySql $scoreMigration | Out-Null
    Invoke-TestMySql $utteranceMigration | Out-Null
    Invoke-TestMySql $utteranceMigration | Out-Null
    Invoke-TestMySql $contractRetryMigration | Out-Null
    Invoke-TestMySql $contractRetryMigration | Out-Null
    Invoke-TestMySql $visibleFeedbackMigration | Out-Null
    Invoke-TestMySql $visibleFeedbackMigration | Out-Null
    Invoke-TestMySql @"
CREATE TABLE feedback_contract_execution_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  prompt_id VARCHAR(64) NOT NULL,
  attempt_no INT NULL,
  input_fingerprint CHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  model VARCHAR(64) NULL,
  reasoning_effort VARCHAR(24) NULL,
  thinking_budget INT NULL,
  initial_response_status_code INT NULL,
  retry_response_status_code INT NULL,
  contract_violation_detected BIT(1) NOT NULL,
  retry_attempted BIT(1) NOT NULL,
  retry_succeeded BIT(1) NULL,
  final_success BIT(1) NOT NULL,
  original_contract_error_reason TEXT NULL,
  final_error_reason TEXT NULL,
  elapsed_ms BIGINT NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO feedback_contract_execution_logs (
  prompt_id,
  attempt_no,
  input_fingerprint,
  provider,
  model,
  reasoning_effort,
  initial_response_status_code,
  contract_violation_detected,
  retry_attempted,
  retry_succeeded,
  final_success,
  final_error_reason,
  elapsed_ms
) VALUES (
  'topic-1',
  1,
  LOWER(SHA2(CONCAT('topic-1', CHAR(10), 'Answer 1'), 256)),
  'openai',
  'gpt-test',
  'medium',
  502,
  b'0',
  b'0',
  NULL,
  b'0',
  'Provider failure',
  150
);
"@ | Out-Null
    Invoke-TestMySql $unifiedDiagnosisMigration | Out-Null
    Invoke-TestMySql $unifiedDiagnosisMigration | Out-Null
    Invoke-TestMySql $tokenUsageMigration | Out-Null
    Invoke-TestMySql $tokenUsageMigration | Out-Null
    Invoke-TestMySql $providerRetryMigration | Out-Null
    Invoke-TestMySql $providerRetryMigration | Out-Null

    $topicRows = Invoke-TestMySql @"
SELECT COALESCE(diagnosis_topic_relevance, 'NULL')
FROM feedback_diagnosis_logs
WHERE execution_status='SUCCESS'
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

    $contractRetryColumns = @(Invoke-TestMySql @"
SELECT CONCAT(COLUMN_NAME, ':', DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME IN ('contract_retry_succeeded', 'contract_original_error_reason')
ORDER BY COLUMN_NAME;
"@)
    if ((Compare-Object @(
        "contract_original_error_reason:text:YES",
        "contract_retry_succeeded:bit:YES"
    ) $contractRetryColumns)) {
        throw "feedback_diagnosis_logs contract retry columns are incomplete"
    }

    $executionColumns = @(Invoke-TestMySql @"
SELECT CONCAT(COLUMN_NAME, ':', DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME IN (
    'execution_status',
    'input_fingerprint',
    'reasoning_effort',
    'thinking_budget',
    'contract_violation_detected',
    'contract_final_error_reason',
    'elapsed_ms'
  )
ORDER BY COLUMN_NAME;
"@)
    if ((Compare-Object @(
        "contract_final_error_reason:text:YES",
        "contract_violation_detected:bit:NO",
        "elapsed_ms:bigint:YES",
        "execution_status:varchar:NO",
        "input_fingerprint:char:NO",
        "reasoning_effort:varchar:YES",
        "thinking_budget:int:YES"
    ) $executionColumns)) {
        throw "feedback_diagnosis_logs unified execution columns are incomplete"
    }

    $tokenUsageColumns = @(Invoke-TestMySql @"
SELECT CONCAT(COLUMN_NAME, ':', DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME IN (
    'llm_input_tokens',
    'llm_cached_input_tokens',
    'llm_output_tokens',
    'llm_reasoning_tokens',
    'llm_total_tokens'
  )
ORDER BY COLUMN_NAME;
"@)
    if ((Compare-Object @(
        "llm_cached_input_tokens:bigint:YES",
        "llm_input_tokens:bigint:YES",
        "llm_output_tokens:bigint:YES",
        "llm_reasoning_tokens:bigint:YES",
        "llm_total_tokens:bigint:YES"
    ) $tokenUsageColumns)) {
        throw "feedback_diagnosis_logs token usage columns are incomplete"
    }

    $providerRetryColumns = @(Invoke-TestMySql @"
SELECT CONCAT(COLUMN_NAME, ':', DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME IN (
    'provider_retry_attempted',
    'provider_retry_succeeded',
    'provider_initial_failure_status_code',
    'provider_initial_failure_body_json'
  )
ORDER BY COLUMN_NAME;
"@)
    if ((Compare-Object @(
        "provider_initial_failure_body_json:json:YES",
        "provider_initial_failure_status_code:int:YES",
        "provider_retry_attempted:bit:NO",
        "provider_retry_succeeded:bit:YES"
    ) $providerRetryColumns)) {
        throw "feedback_diagnosis_logs provider retry columns are incomplete"
    }

    $legacyDiagnosisColumnCount = @(Invoke-TestMySql @"
SELECT COUNT(*)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_diagnosis_logs'
  AND COLUMN_NAME IN (
    'generation_response_status_code',
    'generation_response_body_json',
    'authoritative_feedback',
    'diagnosis_fallback_used',
    'deterministic_response_fallback_used',
    'diagnosis_score',
    'diagnosis_answer_band',
    'diagnosis_task_completion',
    'diagnosis_on_topic',
    'diagnosis_finishable',
    'diagnosis_grammar_severity',
    'diagnosis_primary_issue_code',
    'diagnosis_secondary_issue_code',
    'diagnosis_minimal_correction',
    'rewrite_target_action',
    'rewrite_target_skeleton',
    'rewrite_target_max_new_sentence_count',
    'expansion_budget',
    'profile_task_answer_band',
    'profile_task_completion',
    'profile_task_finishable',
    'profile_grammar_severity',
    'profile_grammar_issue_count',
    'profile_content_specificity',
    'profile_has_main_answer',
    'profile_has_reason',
    'profile_has_example',
    'profile_has_feeling',
    'profile_has_activity',
    'profile_has_time_or_place',
    'answer_profile_json',
    'section_policy_json'
  );
"@)
    if ($legacyDiagnosisColumnCount -notcontains "0") {
        throw "feedback_diagnosis_logs still contains retired diagnosis columns"
    }

    $executionTableCount = @(Invoke-TestMySql @"
SELECT COUNT(*)
FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='feedback_contract_execution_logs'
  AND TABLE_TYPE='BASE TABLE';
"@)
    if ($executionTableCount -notcontains "0") {
        throw "feedback_contract_execution_logs was not removed"
    }

    $migratedLegacyFailure = @(Invoke-TestMySql @"
SELECT CONCAT(
  execution_status, ':',
  learner_answer, ':',
  contract_final_error_reason, ':',
  elapsed_ms
)
FROM feedback_diagnosis_logs
WHERE prompt_id='topic-1'
  AND execution_status='FAILED';
"@)
    if ($migratedLegacyFailure -notcontains "FAILED:Answer 1:Provider failure:150") {
        throw "Legacy failed execution was not preserved in feedback_diagnosis_logs"
    }

    Invoke-TestMySql @"
INSERT INTO feedback_diagnosis_logs (
  execution_status,
  prompt_id,
  input_fingerprint,
  prompt_topic,
  prompt_difficulty,
  prompt_question_en,
  prompt_question_ko,
  learner_answer,
  llm_provider,
  llm_model,
  reasoning_effort,
  contract_violation_detected,
  retry_attempted,
  contract_retry_succeeded,
  elapsed_ms
) VALUES
  ('SUCCESS', 'prompt-1', REPEAT('a', 64), 'Topic', 'A', 'Question', '질문', 'Answer', 'openai', 'gpt-test', 'medium', b'1', b'1', b'1', 100),
  ('SUCCESS', 'prompt-1', REPEAT('a', 64), 'Topic', 'A', 'Question', '질문', 'Answer', 'openai', 'gpt-test', 'medium', b'0', b'0', NULL, 80),
  ('FAILED', 'prompt-1', REPEAT('a', 64), 'Topic', 'A', 'Question', '질문', 'Answer', 'openai', 'gpt-test', 'medium', b'1', b'1', b'0', 120);
"@ | Out-Null

    $contractRates = @(Invoke-TestMySql @"
SELECT CONCAT(
  execution_count, ':',
  initial_contract_failure_count, ':',
  initial_contract_failure_rate, ':',
  retry_attempt_count, ':',
  retry_recovered_count, ':',
  retry_recovery_rate, ':',
  final_contract_failure_count, ':',
  final_contract_failure_rate
)
FROM feedback_contract_failure_rates
WHERE prompt_id='prompt-1'
  AND input_fingerprint=REPEAT('a', 64);
"@)
    if ($contractRates -notcontains "3:2:0.6667:2:1:0.5000:1:0.3333") {
        throw "feedback_contract_failure_rates did not calculate repeat-run rates correctly"
    }

    $visibleFeedbackColumns = @(Invoke-TestMySql @"
SELECT CONCAT(COLUMN_NAME, ':', DATA_TYPE, ':', IS_NULLABLE)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='answer_attempts'
  AND COLUMN_NAME IN ('submission_id', 'visible_feedback_snapshot_json')
ORDER BY COLUMN_NAME;
"@)
    if ((Compare-Object @(
        "submission_id:varchar:YES",
        "visible_feedback_snapshot_json:json:YES"
    ) $visibleFeedbackColumns)) {
        throw "answer_attempts visible feedback lifecycle columns are incomplete"
    }

    $submissionIndex = @(Invoke-TestMySql @"
SELECT CONCAT(INDEX_NAME, ':', NON_UNIQUE, ':', GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX))
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME='answer_attempts'
  AND INDEX_NAME='uq_answer_attempts_session_submission'
GROUP BY INDEX_NAME, NON_UNIQUE;
"@)
    if ($submissionIndex -notcontains "uq_answer_attempts_session_submission:0:session_id,submission_id") {
        throw "answer_attempts submission idempotency index is incomplete"
    }

    $legacyVisibleFeedback = @(Invoke-TestMySql @"
SELECT CONCAT(
  JSON_UNQUOTE(JSON_EXTRACT(visible_feedback_snapshot_json, '$.state')), ':',
  JSON_UNQUOTE(JSON_EXTRACT(visible_feedback_snapshot_json, '$.legacy')), ':',
  JSON_EXTRACT(visible_feedback_snapshot_json, '$.coachMove')
    = JSON_EXTRACT(feedback_payload_json, '$.coachMove')
)
FROM answer_attempts
WHERE id=1;
"@)
    if ($legacyVisibleFeedback -notcontains "NEEDS_REWRITE:true:1") {
        throw "Legacy visible feedback backfill did not preserve the exact coach move"
    }

    Invoke-TestMySql "INSERT INTO answer_attempts(score) VALUES (NULL);" | Out-Null
    Write-Output "Unified diagnosis, contract/provider retry, token usage, and visible feedback migrations passed syntax and idempotency checks."
} finally {
    docker rm -f $container 2>$null | Out-Null
}

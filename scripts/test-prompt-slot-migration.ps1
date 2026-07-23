param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"
$container = "writeloop-slot-migration-test-$PID"
$database = "writeloop_slot_test"
$password = "slot_test_pw"

function Invoke-TestMySql {
    param([string]$Sql)

    $result = $Sql | docker exec -i -e "MYSQL_PWD=$password" $container `
        mysql --batch --skip-column-names --default-character-set=utf8mb4 -uroot $database
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL client failed with exit code $LASTEXITCODE"
    }
    return $result
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
CREATE TABLE prompts (
  id VARCHAR(64) PRIMARY KEY,
  question_en TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE prompt_answer_modes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE prompt_task_slots (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE prompt_task_profiles (
  prompt_id VARCHAR(64) PRIMARY KEY,
  answer_mode_id BIGINT NOT NULL,
  expected_tense VARCHAR(40) NOT NULL,
  expected_pov VARCHAR(40) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE prompt_task_profile_slots (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prompt_id VARCHAR(64) NOT NULL,
  slot_id BIGINT NOT NULL,
  slot_role VARCHAR(16) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_prompt_task_profile_slots_prompt_slot_role (prompt_id, slot_id, slot_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO prompt_answer_modes(code, display_order) VALUES
('ROUTINE',1),('PREFERENCE',2),('GOAL_PLAN',3),('PROBLEM_SOLUTION',4),
('BALANCED_OPINION',5),('OPINION_REASON',6),('CHANGE_REFLECTION',7),('GENERAL_DESCRIPTION',8);
INSERT INTO prompt_task_slots(code, display_order) VALUES
('MAIN_ANSWER',1),('REASON',2),('EXAMPLE',3),('FEELING',4),('ACTIVITY',5),('TIME_OR_PLACE',6);
INSERT INTO prompts(id, question_en) VALUES
('prompt-routine-test','How do you usually spend your weekend?'),
('prompt-preference-test','What is your favorite color? Why?'),
('prompt-stale-mode-test','Do you like coffee or tea? Why?'),
('prompt-balance-test','What are the benefits and drawbacks of online shopping, and what is your view?');
INSERT INTO prompt_task_profiles(prompt_id, answer_mode_id, expected_tense, expected_pov)
SELECT 'prompt-routine-test', id, 'PRESENT_SIMPLE', 'FIRST_PERSON' FROM prompt_answer_modes WHERE code='ROUTINE';
INSERT INTO prompt_task_profiles(prompt_id, answer_mode_id, expected_tense, expected_pov)
SELECT 'prompt-preference-test', id, 'PRESENT_SIMPLE', 'FIRST_PERSON' FROM prompt_answer_modes WHERE code='PREFERENCE';
INSERT INTO prompt_task_profiles(prompt_id, answer_mode_id, expected_tense, expected_pov)
SELECT 'prompt-balance-test', id, 'PRESENT_SIMPLE', 'GENERAL_OR_FIRST_PERSON' FROM prompt_answer_modes WHERE code='BALANCED_OPINION';
INSERT INTO prompt_task_profiles(prompt_id, answer_mode_id, expected_tense, expected_pov)
SELECT 'prompt-stale-mode-test', id, 'PRESENT_SIMPLE', 'FIRST_PERSON' FROM prompt_answer_modes WHERE code='GENERAL_DESCRIPTION';
"@ | Out-Null

    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/085-add-prompt-task-completion-depth.sql")) | Out-Null
    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/086-unify-prompt-task-slots.sql")) | Out-Null
    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/086-unify-prompt-task-slots.sql")) | Out-Null

    $audit = Invoke-TestMySql @"
SELECT CONCAT(
  profile.prompt_id, '|', mode.code, '|', profile.minimum_depth_slots, '|',
  GROUP_CONCAT(CONCAT(slot.code, ':', assignment.slot_role) ORDER BY assignment.display_order SEPARATOR ',')
)
FROM prompt_task_profiles profile
JOIN prompt_answer_modes mode ON mode.id=profile.answer_mode_id
JOIN prompt_task_profile_slots assignment ON assignment.prompt_id=profile.prompt_id AND assignment.is_active=1
JOIN prompt_task_slots slot ON slot.id=assignment.slot_id
GROUP BY profile.prompt_id, mode.code, profile.minimum_depth_slots
ORDER BY profile.prompt_id;
SELECT CONCAT('legacy|', COUNT(*))
FROM prompt_task_slots
WHERE code IN ('MAIN_ANSWER','ACTIVITY','TIME_OR_PLACE','SITUATION') AND is_active=1;
"@

    if ($audit -notcontains "legacy|0") {
        throw "Legacy task slots are still active"
    }
    if (-not ($audit | Where-Object { $_ -like "prompt-routine-test|ROUTINE|1|ACTION:REQUIRED,*" })) {
        throw "Routine prompt was not reclassified with ACTION and one depth requirement"
    }
    if (-not ($audit | Where-Object { $_ -like "prompt-preference-test|PREFERENCE|0|CHOICE:REQUIRED,REASON:REQUIRED,*" })) {
        throw "Preference prompt was not reclassified with CHOICE and REASON"
    }
    if (-not ($audit | Where-Object { $_ -like "prompt-stale-mode-test|PREFERENCE|0|CHOICE:REQUIRED,REASON:REQUIRED,*" })) {
        throw "A stale configured mode overrode question-based reclassification"
    }
    if (-not ($audit | Where-Object { $_ -like "prompt-balance-test|BALANCED_OPINION|0|OPINION:REQUIRED,ADVANTAGE:REQUIRED,DISADVANTAGE:REQUIRED,*" })) {
        throw "Balanced prompt was not reclassified with both sides"
    }

    Write-Output "Prompt slot migrations passed syntax, idempotency, and classification checks."
} finally {
    docker rm -f $container 2>$null | Out-Null
}

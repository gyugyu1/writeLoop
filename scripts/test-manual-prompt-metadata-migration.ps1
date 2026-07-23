param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"
$container = "writeloop-manual-metadata-test-$PID"
$database = "writeloop_manual_metadata_test"
$password = "manual_metadata_test_pw"
$metadataPath = Join-Path $RepoRoot "infra/mysql/data/prompt-task-metadata-reviewed.json"
$metadata = Get-Content -Raw -Encoding UTF8 $metadataPath | ConvertFrom-Json

if ($metadata.Count -ne 1446) {
    throw "Expected 1446 reviewed prompts, found $($metadata.Count)"
}

function Invoke-TestMySql {
    param([string]$Sql)

    $result = $Sql | docker exec -i -e "MYSQL_PWD=$password" $container `
        mysql --batch --skip-column-names --default-character-set=utf8mb4 -uroot $database
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL client failed with exit code $LASTEXITCODE"
    }
    return @($result)
}

function Invoke-TestMySqlFile {
    param([string]$Path)

    $containerPath = "/tmp/" + [System.IO.Path]::GetFileName($Path)
    docker cp $Path "${container}:$containerPath" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy SQL file into temporary MySQL container"
    }
    docker exec -e "MYSQL_PWD=$password" $container `
        sh -c "mysql --default-character-set=utf8mb4 -uroot $database < $containerPath"
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL file execution failed with exit code $LASTEXITCODE"
    }
}

function ConvertTo-SqlLiteral {
    param([AllowEmptyString()][string]$Value)

    return "'" + $Value.Replace("\", "\\").Replace("'", "''") + "'"
}

function Invoke-ChunkedInsert {
    param(
        [string]$Prefix,
        [string[]]$Rows,
        [int]$ChunkSize = 200
    )

    for ($offset = 0; $offset -lt $Rows.Count; $offset += $ChunkSize) {
        $end = [Math]::Min($offset + $ChunkSize - 1, $Rows.Count - 1)
        $values = $Rows[$offset..$end] -join ",`n"
        Invoke-TestMySql "$Prefix`n$values;" | Out-Null
    }
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
  question_en TEXT NOT NULL,
  question_ko TEXT NULL,
  tip TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE prompt_hint_items (
  id VARCHAR(64) PRIMARY KEY,
  content VARCHAR(255) NOT NULL DEFAULT '',
  example_en VARCHAR(255) NULL,
  meaning_ko VARCHAR(255) NULL,
  usage_tip_ko VARCHAR(255) NULL
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
('MAIN_ANSWER',1),('REASON',2),('EXAMPLE',3),('FEELING',4),('ACTIVITY',5),('TIME_OR_PLACE',6),
('ADDITIONAL_ACTIVITY',7),('SITUATION',8);
"@ | Out-Null

    $promptRows = @($metadata | ForEach-Object {
        "(" + (ConvertTo-SqlLiteral $_.promptId) + "," + (ConvertTo-SqlLiteral $_.questionEn) + ")"
    })
    Invoke-ChunkedInsert "INSERT INTO prompts(id, question_en) VALUES" $promptRows

    Invoke-TestMySql @"
INSERT INTO prompt_task_profiles(prompt_id, answer_mode_id, expected_tense, expected_pov)
SELECT prompt.id, mode.id, 'PRESENT_SIMPLE', 'FIRST_PERSON'
FROM prompts prompt
JOIN prompt_answer_modes mode ON mode.code='GENERAL_DESCRIPTION';
"@ | Out-Null

    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/085-add-prompt-task-completion-depth.sql")) | Out-Null
    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/086-unify-prompt-task-slots.sql")) | Out-Null
    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/087-apply-manually-reviewed-prompt-task-metadata.sql")) | Out-Null
    Invoke-TestMySql (Get-Content -Raw (Join-Path $RepoRoot "infra/mysql/schema/087-apply-manually-reviewed-prompt-task-metadata.sql")) | Out-Null
    $rationaleMigration = Join-Path $RepoRoot "infra/mysql/schema/088-add-prompt-task-review-rationale.sql"
    Invoke-TestMySqlFile $rationaleMigration
    Invoke-TestMySqlFile $rationaleMigration
    $depthReviewMigration = Join-Path $RepoRoot "infra/mysql/schema/092-lower-overstrict-opinion-depth.sql"
    Invoke-TestMySqlFile $depthReviewMigration
    Invoke-TestMySqlFile $depthReviewMigration
    $slotContractMigration = Join-Path $RepoRoot "infra/mysql/schema/093-add-prompt-slot-contracts.sql"
    Invoke-TestMySqlFile $slotContractMigration
    Invoke-TestMySqlFile $slotContractMigration

    $expectedProfiles = @($metadata | ForEach-Object {
        "$($_.promptId)|$($_.answerMode)|$($_.expectedTense)|$($_.expectedPov)|$($_.minimumDepthSlots)"
    } | Sort-Object)
    $actualProfiles = @(Invoke-TestMySql @"
SELECT CONCAT(
  profile.prompt_id, '|', mode.code, '|', profile.expected_tense, '|',
  profile.expected_pov, '|', profile.minimum_depth_slots
)
FROM prompt_task_profiles profile
JOIN prompt_answer_modes mode ON mode.id=profile.answer_mode_id
WHERE profile.is_active=1
ORDER BY profile.prompt_id;
"@ | Sort-Object)

    if (Compare-Object $expectedProfiles $actualProfiles) {
        throw "Applied profiles do not exactly match the reviewed metadata"
    }

    $expectedRationales = @($metadata | ForEach-Object {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($_.rationaleKo)
        $hex = [System.BitConverter]::ToString($bytes).Replace('-', '')
        "$($_.promptId)|$hex"
    } | Sort-Object)
    $actualRationales = @(Invoke-TestMySql @"
SELECT CONCAT(profile.prompt_id, '|', HEX(profile.review_rationale))
FROM prompt_task_profiles profile
WHERE profile.is_active=1
ORDER BY profile.prompt_id;
"@ | Sort-Object)

    if (Compare-Object $expectedRationales $actualRationales) {
        throw "Applied review rationales do not exactly match the reviewed metadata"
    }

    $expectedSlots = @($metadata | ForEach-Object {
        $prompt = $_
        for ($index = 0; $index -lt $prompt.requiredSlots.Count; $index++) {
            "$($prompt.promptId)|$($prompt.requiredSlots[$index])|REQUIRED|$($index + 1)"
        }
        for ($index = 0; $index -lt $prompt.optionalSlots.Count; $index++) {
            "$($prompt.promptId)|$($prompt.optionalSlots[$index])|OPTIONAL|$($index + 1)"
        }
    } | Sort-Object)
    $actualSlots = @(Invoke-TestMySql @"
SELECT CONCAT(assignment.prompt_id, '|', slot.code, '|', assignment.slot_role, '|', assignment.display_order)
FROM prompt_task_profile_slots assignment
JOIN prompt_task_slots slot ON slot.id=assignment.slot_id
WHERE assignment.is_active=1
ORDER BY assignment.prompt_id, assignment.slot_role, assignment.display_order, slot.code;
"@ | Sort-Object)

    if (Compare-Object $expectedSlots $actualSlots) {
        throw "Applied slot assignments do not exactly match the reviewed metadata"
    }

    $expectedSlotContracts = @($metadata | ForEach-Object {
        $prompt = $_
        foreach ($slot in @($prompt.requiredSlots) + @($prompt.optionalSlots)) {
            $contract = $prompt.slotContracts.$slot
            $values = @(
                $contract.semanticRoleEn,
                $contract.satisfiedWhenEn,
                $contract.semanticRoleKo,
                $contract.satisfiedWhenKo
            ) | ForEach-Object {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($_)
                [System.BitConverter]::ToString($bytes).Replace('-', '')
            }
            "$($prompt.promptId)|$slot|$($values -join '|')"
        }
    } | Sort-Object)
    $actualSlotContracts = @(Invoke-TestMySql @"
SELECT CONCAT(
  assignment.prompt_id, '|', slot.code, '|',
  HEX(assignment.semantic_role_en), '|',
  HEX(assignment.satisfied_when_en), '|',
  HEX(assignment.semantic_role_ko), '|',
  HEX(assignment.satisfied_when_ko)
)
FROM prompt_task_profile_slots assignment
JOIN prompt_task_slots slot ON slot.id=assignment.slot_id
WHERE assignment.is_active=1
ORDER BY assignment.prompt_id, slot.code;
"@ | Sort-Object)

    if (Compare-Object $expectedSlotContracts $actualSlotContracts) {
        throw "Applied question-specific slot contracts do not exactly match the reviewed metadata"
    }

    $activeQuestionRevision = Join-Path $RepoRoot "infra/mysql/schema/094-manually-revise-active-prompt-questions.sql"
    $activeQuestionRevisionSql = Get-Content -Raw -Encoding UTF8 $activeQuestionRevision
    $promotionBlock = [regex]::Match(
        $activeQuestionRevisionSql,
        "INSERT INTO tmp_prompt_slot_promotions_094 \(prompt_id, slot_code\) VALUES(?<rows>.*?);\s*INSERT INTO prompt_task_profile_slots",
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    if (-not $promotionBlock.Success) {
        throw "Could not find the 094 slot-promotion manifest"
    }

    $promotionMatches = [regex]::Matches(
        $promotionBlock.Groups["rows"].Value,
        "\('([^']+)',\s*'([^']+)'\)"
    )
    $promotionRows = @($promotionMatches | ForEach-Object {
        "(" +
        (ConvertTo-SqlLiteral $_.Groups[1].Value) + "," +
        (ConvertTo-SqlLiteral $_.Groups[2].Value) +
        ")"
    })
    if ($promotionRows.Count -ne 137) {
        throw "Expected 137 explicit slot-promotion targets in 094, found $($promotionRows.Count)"
    }

    Invoke-TestMySql @"
CREATE TABLE expected_prompt_slot_promotions_094 (
  prompt_id VARCHAR(64) NOT NULL,
  slot_code VARCHAR(64) NOT NULL,
  PRIMARY KEY (prompt_id, slot_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"@ | Out-Null
    Invoke-ChunkedInsert `
        "INSERT INTO expected_prompt_slot_promotions_094(prompt_id, slot_code) VALUES" `
        $promotionRows

    Invoke-TestMySqlFile $activeQuestionRevision
    Invoke-TestMySqlFile $activeQuestionRevision

    $revisedQuestionCount = Invoke-TestMySql @"
SELECT COUNT(*)
FROM prompts
WHERE question_en IN (
  'When do you usually make a quick meal at home, and what meal do you make?',
  'What commuting delay do you sometimes experience, and what do you do when it happens?',
  'What is one important responsibility social media platforms should have, and why?',
  'What kind of person are you, and what is one example that shows it?'
);
"@
    if ($revisedQuestionCount[0] -ne "4") {
        throw "Representative active-question revisions were not applied"
    }

    $missingPromotedSlots = Invoke-TestMySql @"
SELECT COUNT(*)
FROM expected_prompt_slot_promotions_094 expected
JOIN prompt_task_slots slot
  ON slot.code=expected.slot_code
LEFT JOIN prompt_task_profile_slots required_assignment
  ON required_assignment.prompt_id=expected.prompt_id
 AND required_assignment.slot_id=slot.id
 AND required_assignment.slot_role='REQUIRED'
 AND required_assignment.is_active=1
WHERE required_assignment.id IS NULL;
"@
    if ($missingPromotedSlots[0] -ne "0") {
        throw "Some of the 137 explicit slot-promotion targets are not active required slots"
    }

    $stillActiveOptionalSlots = Invoke-TestMySql @"
SELECT COUNT(*)
FROM expected_prompt_slot_promotions_094 expected
JOIN prompt_task_slots slot
  ON slot.code=expected.slot_code
JOIN prompt_task_profile_slots optional_assignment
  ON optional_assignment.prompt_id=expected.prompt_id
 AND optional_assignment.slot_id=slot.id
 AND optional_assignment.slot_role='OPTIONAL'
 AND optional_assignment.is_active=1;
"@
    if ($stillActiveOptionalSlots[0] -ne "0") {
        throw "A promoted slot is still active as optional"
    }

    $revisedDepthMismatch = Invoke-TestMySql @"
SELECT COUNT(*)
FROM prompt_task_profiles
WHERE prompt_id IN (
  'prompt-opinion-06',
  'prompt-problem-1103',
  'prompt-intro-v2-0003',
  'prompt-general-1101'
)
  AND minimum_depth_slots<>0;
"@
    if ($revisedDepthMismatch[0] -ne "0") {
        throw "Revised questions still contain hidden depth requirements"
    }

    $questionSlotAlignment = Join-Path $RepoRoot "infra/mysql/schema/095-align-three-prompt-questions-with-slots.sql"
    Invoke-TestMySqlFile $questionSlotAlignment
    Invoke-TestMySqlFile $questionSlotAlignment

    $alignedQuestionCount = Invoke-TestMySql @"
SELECT COUNT(*)
FROM prompts
WHERE (id='prompt-a-1' AND question_en='What do you usually do after dinner, and why do you do it?')
   OR (id='prompt-a-3' AND question_en='What do you usually do on weekends, and where do you usually do it?')
   OR (id='prompt-reflection-26' AND question_en='Describe how your view of friendship has changed over time and explain what caused the change.');
"@
    if ($alignedQuestionCount[0] -ne "3") {
        throw "The three question texts were not aligned with their explicit slot requirements"
    }

    $missingAlignedRequiredSlots = Invoke-TestMySql @"
SELECT COUNT(*)
FROM (
  SELECT 'prompt-a-1' AS prompt_id, 'REASON' AS slot_code
  UNION ALL SELECT 'prompt-a-3', 'PLACE'
  UNION ALL SELECT 'prompt-reflection-26', 'CHANGE_CAUSE'
) expected
JOIN prompt_task_slots slot
  ON slot.code=expected.slot_code
LEFT JOIN prompt_task_profile_slots assignment
  ON assignment.prompt_id=expected.prompt_id
 AND assignment.slot_id=slot.id
 AND assignment.slot_role='REQUIRED'
 AND assignment.is_active=1
WHERE assignment.id IS NULL;
"@
    if ($missingAlignedRequiredSlots[0] -ne "0") {
        throw "An explicit question obligation is missing its active required slot"
    }

    $activePromotedOptionals = Invoke-TestMySql @"
SELECT COUNT(*)
FROM (
  SELECT 'prompt-a-1' AS prompt_id, 'REASON' AS slot_code
  UNION ALL SELECT 'prompt-a-3', 'PLACE'
  UNION ALL SELECT 'prompt-reflection-26', 'CHANGE_CAUSE'
) expected
JOIN prompt_task_slots slot
  ON slot.code=expected.slot_code
JOIN prompt_task_profile_slots assignment
  ON assignment.prompt_id=expected.prompt_id
 AND assignment.slot_id=slot.id
 AND assignment.slot_role='OPTIONAL'
 AND assignment.is_active=1;
"@
    if ($activePromotedOptionals[0] -ne "0") {
        throw "A newly required question obligation is still active as optional"
    }

    $alignedDepthMismatch = Invoke-TestMySql @"
SELECT COUNT(*)
FROM prompt_task_profiles
WHERE prompt_id IN ('prompt-a-1', 'prompt-a-3', 'prompt-reflection-26')
  AND minimum_depth_slots<>0;
"@
    if ($alignedDepthMismatch[0] -ne "0") {
        throw "An aligned question still contains a hidden depth requirement"
    }

    $duplicateActiveSlots = Invoke-TestMySql @"
SELECT COUNT(*)
FROM (
  SELECT prompt_id, slot_id
  FROM prompt_task_profile_slots
  WHERE is_active=1
  GROUP BY prompt_id, slot_id
  HAVING COUNT(*) > 1
) duplicate_slots;
"@
    if ($duplicateActiveSlots[0] -ne "0") {
        throw "A prompt has the same slot active in more than one role"
    }

    Write-Output "Manual prompt metadata plus active-question revisions matched all 1,446 profiles and validated 140 required-slot targets idempotently."
} finally {
    docker rm -f $container 2>$null | Out-Null
}

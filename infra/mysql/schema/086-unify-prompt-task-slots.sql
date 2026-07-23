-- Canonical prompt slots shared by DB metadata, OpenAI schema, and backend policy.
-- Legacy slot rows stay inactive for rollback visibility, but active profiles are rebuilt.

INSERT INTO prompt_task_slots (code, display_order, is_active)
VALUES
    ('ACTION', 1, 1),
    ('CHOICE', 2, 1),
    ('GOAL', 3, 1),
    ('PROBLEM', 4, 1),
    ('OPINION', 5, 1),
    ('PLAN', 6, 1),
    ('SOLUTION', 7, 1),
    ('ADVANTAGE', 8, 1),
    ('DISADVANTAGE', 9, 1),
    ('BEFORE_STATE', 10, 1),
    ('NOW_STATE', 11, 1),
    ('CHANGE_CAUSE', 12, 1),
    ('ADDITIONAL_ACTION', 13, 1),
    ('SPECIFIC_TIME', 14, 1),
    ('PLACE', 15, 1),
    ('REASON', 16, 1),
    ('DETAIL', 17, 1),
    ('EXAMPLE', 18, 1),
    ('FEELING', 19, 1),
    ('RESULT', 20, 1)
ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

UPDATE prompt_task_slots
SET is_active = 0
WHERE code IN ('MAIN_ANSWER', 'ACTIVITY', 'TIME_OR_PLACE', 'ADDITIONAL_ACTIVITY', 'SITUATION');

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_canonical_modes;
CREATE TEMPORARY TABLE tmp_prompt_canonical_modes (
    prompt_id VARCHAR(64) NOT NULL,
    answer_mode_code VARCHAR(64) NOT NULL,
    question_en TEXT NOT NULL,
    PRIMARY KEY (prompt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_prompt_canonical_modes (prompt_id, answer_mode_code, question_en)
SELECT
    prompt.id,
    CASE
            WHEN prompt.id IN ('prompt-a-1', 'prompt-a-3', 'prompt-a-4') THEN 'ROUTINE'
            WHEN prompt.id = 'prompt-a-2' THEN 'PREFERENCE'
            WHEN prompt.id = 'prompt-b-1' THEN 'PROBLEM_SOLUTION'
            WHEN prompt.id IN ('prompt-b-2', 'prompt-b-3', 'prompt-b-4', 'prompt-b-5') THEN 'GOAL_PLAN'
            WHEN prompt.id = 'prompt-c-1' THEN 'BALANCED_OPINION'
            WHEN prompt.id = 'prompt-c-2' THEN 'OPINION_REASON'
            WHEN prompt.id = 'prompt-c-3' THEN 'CHANGE_REFLECTION'
            WHEN prompt.id LIKE 'prompt-routine-%' THEN 'ROUTINE'
            WHEN prompt.id LIKE 'prompt-preference-%' THEN 'PREFERENCE'
            WHEN prompt.id LIKE 'prompt-goal-%' THEN 'GOAL_PLAN'
            WHEN prompt.id LIKE 'prompt-problem-%' THEN 'PROBLEM_SOLUTION'
            WHEN prompt.id LIKE 'prompt-balance-%' THEN 'BALANCED_OPINION'
            WHEN prompt.id LIKE 'prompt-opinion-%' THEN 'OPINION_REASON'
            WHEN prompt.id LIKE 'prompt-reflection-%' THEN 'CHANGE_REFLECTION'
            WHEN prompt.id LIKE 'prompt-general-%' THEN 'GENERAL_DESCRIPTION'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'changed over time|changed your mind|used to believe|before and now|what caused that change|how has your|how have your' THEN 'CHANGE_REFLECTION'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'benefits and drawbacks|advantages and disadvantages|pros and cons|positive and negative|mostly positive|overall opinion|what is your view' THEN 'BALANCED_OPINION'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'challenge|problem|deal with it|handle it|solve it|what do you do when' THEN 'PROBLEM_SOLUTION'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'one goal|your goal|want to learn|want to improve|want to build|want to reach|want to work on|how will you|what steps will you take|explain your plan' THEN 'GOAL_PLAN'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'usually|every day|each day|often do|typically|your routine' THEN 'ROUTINE'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'favorite|favourite|do you like|which do you prefer|would you choose|appeals to you|what do you like about' THEN 'PREFERENCE'
            WHEN LOWER(COALESCE(prompt.question_en, '')) REGEXP 'do you think|should |why or why not|your opinion|what kind of social responsibility' THEN 'OPINION_REASON'
            ELSE COALESCE(configured_mode.code, 'GENERAL_DESCRIPTION')
    END,
    COALESCE(prompt.question_en, '')
FROM prompts prompt
LEFT JOIN prompt_task_profiles profile
  ON profile.prompt_id = prompt.id
 AND profile.is_active = 1
LEFT JOIN prompt_answer_modes configured_mode
  ON configured_mode.id = profile.answer_mode_id;

INSERT INTO prompt_task_profiles (
    prompt_id,
    answer_mode_id,
    expected_tense,
    expected_pov,
    minimum_depth_slots,
    is_active
)
SELECT
    mode_plan.prompt_id,
    answer_mode.id,
    CASE mode_plan.answer_mode_code
        WHEN 'GOAL_PLAN' THEN 'FUTURE_PLAN'
        WHEN 'CHANGE_REFLECTION' THEN 'MIXED_PAST_PRESENT'
        ELSE 'PRESENT_SIMPLE'
    END,
    CASE mode_plan.answer_mode_code
        WHEN 'BALANCED_OPINION' THEN 'GENERAL_OR_FIRST_PERSON'
        WHEN 'OPINION_REASON' THEN 'GENERAL_OR_FIRST_PERSON'
        ELSE 'FIRST_PERSON'
    END,
    0,
    1
FROM tmp_prompt_canonical_modes mode_plan
JOIN prompt_answer_modes answer_mode
  ON answer_mode.code COLLATE utf8mb4_unicode_ci = mode_plan.answer_mode_code COLLATE utf8mb4_unicode_ci
LEFT JOIN prompt_task_profiles existing
  ON existing.prompt_id COLLATE utf8mb4_unicode_ci = mode_plan.prompt_id COLLATE utf8mb4_unicode_ci
WHERE existing.prompt_id IS NULL;

-- Reclassify existing profiles too; stale answer modes must not override the question.
UPDATE prompt_task_profiles profile
JOIN tmp_prompt_canonical_modes mode_plan
  ON mode_plan.prompt_id COLLATE utf8mb4_unicode_ci = profile.prompt_id COLLATE utf8mb4_unicode_ci
JOIN prompt_answer_modes answer_mode
  ON answer_mode.code COLLATE utf8mb4_unicode_ci = mode_plan.answer_mode_code COLLATE utf8mb4_unicode_ci
SET profile.answer_mode_id = answer_mode.id,
    profile.is_active = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_canonical_slots;
CREATE TEMPORARY TABLE tmp_prompt_canonical_slots (
    prompt_id VARCHAR(64) NOT NULL,
    slot_code VARCHAR(64) NOT NULL,
    slot_role VARCHAR(16) NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (prompt_id, slot_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Primary semantic obligation for each answer mode.
INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT
    mode_plan.prompt_id,
    CASE mode_plan.answer_mode_code
        WHEN 'ROUTINE' THEN 'ACTION'
        WHEN 'PREFERENCE' THEN 'CHOICE'
        WHEN 'GOAL_PLAN' THEN 'GOAL'
        WHEN 'PROBLEM_SOLUTION' THEN 'PROBLEM'
        WHEN 'BALANCED_OPINION' THEN 'OPINION'
        WHEN 'OPINION_REASON' THEN 'OPINION'
        WHEN 'CHANGE_REFLECTION' THEN 'BEFORE_STATE'
        ELSE CASE
            WHEN LOWER(TRIM(mode_plan.question_en)) REGEXP '^why[[:space:]]' THEN 'REASON'
            WHEN LOWER(mode_plan.question_en) REGEXP 'how do you feel|how did you feel|how would you feel' THEN 'FEELING'
            WHEN LOWER(TRIM(mode_plan.question_en)) REGEXP '^when[[:space:]]|what time' THEN 'SPECIFIC_TIME'
            WHEN LOWER(TRIM(mode_plan.question_en)) REGEXP '^where[[:space:]]|what place|which place|where would|where do|where did' THEN 'PLACE'
            WHEN LOWER(mode_plan.question_en) REGEXP 'what (do|did|will|would|can) you do|how (do|did|will|would|can) you|what do you say|what would you buy' THEN 'ACTION'
            ELSE 'DETAIL'
        END
    END,
    'REQUIRED',
    1
FROM tmp_prompt_canonical_modes mode_plan;

-- Change reflection always needs both sides of the comparison.
INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'NOW_STATE', 'REQUIRED', 2
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'CHANGE_REFLECTION';

-- Literal question obligations become required slots.
INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'REASON', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE LOWER(question_en) REGEXP '(^|[^a-z])why([^a-z]|$)|reason'
  AND answer_mode_code <> 'CHANGE_REFLECTION';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'PLAN', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'GOAL_PLAN'
  AND LOWER(question_en) REGEXP 'how will you|how would you|how do you plan|what steps|what will you do|your plan|make progress|work toward';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'SOLUTION', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'PROBLEM_SOLUTION'
  AND LOWER(question_en) REGEXP 'deal with|handle|solve|what do you do about|what would you do|how do you respond|how you try';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'ADVANTAGE', 'REQUIRED', 2
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'BALANCED_OPINION'
  AND LOWER(question_en) REGEXP 'benefits and drawbacks|advantages and disadvantages|pros and cons|positive and negative';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'DISADVANTAGE', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'BALANCED_OPINION'
  AND LOWER(question_en) REGEXP 'benefits and drawbacks|advantages and disadvantages|pros and cons|positive and negative';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'CHANGE_CAUSE', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'CHANGE_REFLECTION'
  AND LOWER(question_en) REGEXP '(^|[^a-z])why([^a-z]|$)|reason|caused|led to the change';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'SPECIFIC_TIME', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'ROUTINE'
  AND LOWER(TRIM(question_en)) REGEXP '^when[[:space:]]|what time';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT prompt_id, 'PLACE', 'REQUIRED', 3
FROM tmp_prompt_canonical_modes
WHERE answer_mode_code = 'ROUTINE'
  AND LOWER(TRIM(question_en)) REGEXP '^where[[:space:]]|what place|which place';

-- Depth candidates. INSERT IGNORE keeps a required role when the same slot is literal.
INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'ADDITIONAL_ACTION' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'SPECIFIC_TIME', 21
    UNION ALL SELECT 'PLACE', 22
    UNION ALL SELECT 'REASON', 23
    UNION ALL SELECT 'DETAIL', 24
    UNION ALL SELECT 'FEELING', 25
    UNION ALL SELECT 'RESULT', 26
) candidate
WHERE mode_plan.answer_mode_code = 'ROUTINE';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'REASON' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'DETAIL', 21
    UNION ALL SELECT 'EXAMPLE', 22
    UNION ALL SELECT 'FEELING', 23
    UNION ALL SELECT 'RESULT', 24
) candidate
WHERE mode_plan.answer_mode_code = 'PREFERENCE';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'PLAN' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'REASON', 21
    UNION ALL SELECT 'SPECIFIC_TIME', 22
    UNION ALL SELECT 'DETAIL', 23
    UNION ALL SELECT 'RESULT', 24
) candidate
WHERE mode_plan.answer_mode_code = 'GOAL_PLAN';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'SOLUTION' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'REASON', 21
    UNION ALL SELECT 'EXAMPLE', 22
    UNION ALL SELECT 'FEELING', 23
    UNION ALL SELECT 'RESULT', 24
) candidate
WHERE mode_plan.answer_mode_code = 'PROBLEM_SOLUTION';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'ADVANTAGE' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'DISADVANTAGE', 21
    UNION ALL SELECT 'REASON', 22
    UNION ALL SELECT 'EXAMPLE', 23
    UNION ALL SELECT 'DETAIL', 24
) candidate
WHERE mode_plan.answer_mode_code = 'BALANCED_OPINION';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'REASON' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'EXAMPLE', 21
    UNION ALL SELECT 'DETAIL', 22
    UNION ALL SELECT 'RESULT', 23
) candidate
WHERE mode_plan.answer_mode_code = 'OPINION_REASON';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'CHANGE_CAUSE' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'EXAMPLE', 21
    UNION ALL SELECT 'FEELING', 22
    UNION ALL SELECT 'RESULT', 23
) candidate
WHERE mode_plan.answer_mode_code = 'CHANGE_REFLECTION';

INSERT IGNORE INTO tmp_prompt_canonical_slots (prompt_id, slot_code, slot_role, display_order)
SELECT mode_plan.prompt_id, candidate.slot_code, 'OPTIONAL', candidate.display_order
FROM tmp_prompt_canonical_modes mode_plan
CROSS JOIN (
    SELECT 'DETAIL' AS slot_code, 20 AS display_order
    UNION ALL SELECT 'REASON', 21
    UNION ALL SELECT 'EXAMPLE', 22
    UNION ALL SELECT 'FEELING', 23
    UNION ALL SELECT 'RESULT', 24
    UNION ALL SELECT 'SPECIFIC_TIME', 25
    UNION ALL SELECT 'PLACE', 26
    UNION ALL SELECT 'ACTION', 27
) candidate
WHERE mode_plan.answer_mode_code = 'GENERAL_DESCRIPTION';

UPDATE prompt_task_profile_slots assignment
JOIN prompt_task_profiles profile
  ON profile.prompt_id = assignment.prompt_id
SET assignment.is_active = 0
WHERE profile.is_active = 1;

INSERT INTO prompt_task_profile_slots (
    prompt_id,
    slot_id,
    slot_role,
    display_order,
    is_active
)
SELECT
    slot_plan.prompt_id,
    slot.id,
    slot_plan.slot_role,
    slot_plan.display_order,
    1
FROM tmp_prompt_canonical_slots slot_plan
JOIN prompt_task_slots slot
  ON slot.code COLLATE utf8mb4_unicode_ci = slot_plan.slot_code COLLATE utf8mb4_unicode_ci
ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

UPDATE prompt_task_profiles profile
JOIN tmp_prompt_canonical_modes mode_plan
  ON mode_plan.prompt_id COLLATE utf8mb4_unicode_ci = profile.prompt_id COLLATE utf8mb4_unicode_ci
JOIN (
    SELECT prompt_id, COUNT(*) AS required_count
    FROM tmp_prompt_canonical_slots
    WHERE slot_role = 'REQUIRED'
    GROUP BY prompt_id
) required_count
  ON required_count.prompt_id COLLATE utf8mb4_unicode_ci = profile.prompt_id COLLATE utf8mb4_unicode_ci
SET profile.minimum_depth_slots = CASE
    WHEN mode_plan.answer_mode_code IN ('ROUTINE', 'PREFERENCE')
         AND required_count.required_count = 1 THEN 1
    ELSE 0
END,
    profile.is_active = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_canonical_slots;
DROP TEMPORARY TABLE IF EXISTS tmp_prompt_canonical_modes;

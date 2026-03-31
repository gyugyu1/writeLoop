DROP TABLE IF EXISTS prompt_task_profile_slots;
DROP TABLE IF EXISTS prompt_task_profiles;
DROP TABLE IF EXISTS prompt_task_slots;
DROP TABLE IF EXISTS prompt_answer_modes;

CREATE TABLE prompt_answer_modes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompt_answer_modes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prompt_task_slots (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompt_task_slots_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prompt_task_profiles (
    prompt_id VARCHAR(64) NOT NULL,
    answer_mode_id BIGINT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (prompt_id),
    KEY idx_prompt_task_profiles_answer_mode_id (answer_mode_id),
    CONSTRAINT fk_prompt_task_profiles_prompt
        FOREIGN KEY (prompt_id) REFERENCES prompts (id),
    CONSTRAINT fk_prompt_task_profiles_answer_mode
        FOREIGN KEY (answer_mode_id) REFERENCES prompt_answer_modes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prompt_task_profile_slots (
    id BIGINT NOT NULL AUTO_INCREMENT,
    prompt_id VARCHAR(64) NOT NULL,
    slot_id BIGINT NOT NULL,
    slot_role VARCHAR(16) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_prompt_task_profile_slots_prompt_slot_role (prompt_id, slot_id, slot_role),
    KEY idx_prompt_task_profile_slots_slot_id (slot_id),
    CONSTRAINT fk_prompt_task_profile_slots_profile
        FOREIGN KEY (prompt_id) REFERENCES prompt_task_profiles (prompt_id),
    CONSTRAINT fk_prompt_task_profile_slots_slot
        FOREIGN KEY (slot_id) REFERENCES prompt_task_slots (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_answer_modes (code, display_order, is_active)
VALUES
    ('ROUTINE', 1, 1),
    ('PREFERENCE', 2, 1),
    ('GOAL_PLAN', 3, 1),
    ('PROBLEM_SOLUTION', 4, 1),
    ('BALANCED_OPINION', 5, 1),
    ('OPINION_REASON', 6, 1),
    ('CHANGE_REFLECTION', 7, 1),
    ('GENERAL_DESCRIPTION', 8, 1);

INSERT INTO prompt_task_slots (code, display_order, is_active)
VALUES
    ('MAIN_ANSWER', 1, 1),
    ('REASON', 2, 1),
    ('EXAMPLE', 3, 1),
    ('FEELING', 4, 1),
    ('ACTIVITY', 5, 1),
    ('TIME_OR_PLACE', 6, 1);

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_task_meta;
CREATE TEMPORARY TABLE tmp_prompt_task_meta (
    prompt_id VARCHAR(64) NOT NULL,
    answer_mode_code VARCHAR(64) NOT NULL,
    required_slot_1 VARCHAR(64) NOT NULL,
    required_slot_2 VARCHAR(64) NULL,
    optional_slot_1 VARCHAR(64) NULL,
    optional_slot_2 VARCHAR(64) NULL,
    PRIMARY KEY (prompt_id)
) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_prompt_task_meta (
    prompt_id,
    answer_mode_code,
    required_slot_1,
    required_slot_2,
    optional_slot_1,
    optional_slot_2
)
SELECT
    p.id,
    CASE
        WHEN p.id = 'prompt-a-1' THEN 'ROUTINE'
        WHEN p.id = 'prompt-a-2' THEN 'PREFERENCE'
        WHEN p.id = 'prompt-a-3' THEN 'ROUTINE'
        WHEN p.id = 'prompt-a-4' THEN 'ROUTINE'
        WHEN p.id = 'prompt-b-1' THEN 'PROBLEM_SOLUTION'
        WHEN p.id IN ('prompt-b-2', 'prompt-b-3', 'prompt-b-4', 'prompt-b-5') THEN 'GOAL_PLAN'
        WHEN p.id = 'prompt-c-1' THEN 'BALANCED_OPINION'
        WHEN p.id = 'prompt-c-2' THEN 'OPINION_REASON'
        WHEN p.id = 'prompt-c-3' THEN 'CHANGE_REFLECTION'
        WHEN p.id LIKE 'prompt-routine-%' THEN 'ROUTINE'
        WHEN p.id LIKE 'prompt-preference-%' THEN 'PREFERENCE'
        WHEN p.id LIKE 'prompt-goal-%' THEN 'GOAL_PLAN'
        WHEN p.id LIKE 'prompt-problem-%' THEN 'PROBLEM_SOLUTION'
        WHEN p.id LIKE 'prompt-balance-%' THEN 'BALANCED_OPINION'
        WHEN p.id LIKE 'prompt-opinion-%' THEN 'OPINION_REASON'
        WHEN p.id LIKE 'prompt-reflection-%' THEN 'CHANGE_REFLECTION'
        WHEN p.id LIKE 'prompt-general-%' THEN 'GENERAL_DESCRIPTION'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'favorite|favourite|appeals to you|why do you like' THEN 'PREFERENCE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'usually spend|usually do|describe your routine|often do|typically use' THEN 'ROUTINE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'how will you|explain your plan|make progress|what steps will you take|want to improve this year|want to build this year|want to reach this year|want to work on this year' THEN 'GOAL_PLAN'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'challenge|how do you deal with it|how you deal with it|what you do about it|how you try to solve it' THEN 'PROBLEM_SOLUTION'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'benefits and drawbacks|mostly positive|mostly good|what is your view|overall opinion' THEN 'BALANCED_OPINION'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'changed over time|changed your mind|used to believe|what caused that change' THEN 'CHANGE_REFLECTION'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'responsibility|why or why not|what kind of social responsibility' THEN 'OPINION_REASON'
        ELSE 'GENERAL_DESCRIPTION'
    END AS answer_mode_code,
    'MAIN_ANSWER' AS required_slot_1,
    CASE
        WHEN p.id = 'prompt-a-1' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-a-2' THEN 'REASON'
        WHEN p.id = 'prompt-a-3' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-a-4' THEN 'REASON'
        WHEN p.id = 'prompt-b-1' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-b-2' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-b-3' THEN 'REASON'
        WHEN p.id = 'prompt-b-4' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-b-5' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-c-1' THEN 'REASON'
        WHEN p.id = 'prompt-c-2' THEN 'REASON'
        WHEN p.id = 'prompt-c-3' THEN 'REASON'
        WHEN p.id LIKE 'prompt-routine-%' THEN 'ACTIVITY'
        WHEN p.id LIKE 'prompt-preference-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-goal-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN 'REASON'
        WHEN p.id LIKE 'prompt-goal-%' THEN 'ACTIVITY'
        WHEN p.id LIKE 'prompt-problem-%' THEN 'ACTIVITY'
        WHEN p.id LIKE 'prompt-balance-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-opinion-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-reflection-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN NULL
        WHEN p.id LIKE 'prompt-reflection-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-general-%' THEN 'REASON'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'favorite|favourite|appeals to you|why do you like|why\\?' THEN 'REASON'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'usually spend|usually do|describe your routine|often do|typically use' THEN 'ACTIVITY'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'how will you|explain your plan|make progress|what steps will you take' THEN 'ACTIVITY'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'challenge|how do you deal with it|how you deal with it|what you do about it|how you try to solve it' THEN 'ACTIVITY'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'benefits and drawbacks|mostly positive|mostly good|what is your view|overall opinion|responsibility|why or why not' THEN 'REASON'
        ELSE 'REASON'
    END AS required_slot_2,
    CASE
        WHEN p.id = 'prompt-a-1' THEN 'TIME_OR_PLACE'
        WHEN p.id = 'prompt-a-2' THEN 'FEELING'
        WHEN p.id = 'prompt-a-3' THEN 'TIME_OR_PLACE'
        WHEN p.id = 'prompt-a-4' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-b-1' THEN 'REASON'
        WHEN p.id IN ('prompt-b-2', 'prompt-b-4', 'prompt-b-5') THEN 'REASON'
        WHEN p.id = 'prompt-b-3' THEN 'ACTIVITY'
        WHEN p.id = 'prompt-c-1' THEN 'EXAMPLE'
        WHEN p.id = 'prompt-c-2' THEN 'EXAMPLE'
        WHEN p.id = 'prompt-c-3' THEN 'TIME_OR_PLACE'
        WHEN p.id LIKE 'prompt-routine-%' THEN 'TIME_OR_PLACE'
        WHEN p.id LIKE 'prompt-preference-%' THEN 'FEELING'
        WHEN p.id LIKE 'prompt-goal-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN 'ACTIVITY'
        WHEN p.id LIKE 'prompt-goal-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-problem-%' THEN 'REASON'
        WHEN p.id LIKE 'prompt-balance-%' THEN 'EXAMPLE'
        WHEN p.id LIKE 'prompt-opinion-%' THEN 'EXAMPLE'
        WHEN p.id LIKE 'prompt-reflection-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN 'REASON'
        WHEN p.id LIKE 'prompt-reflection-%' THEN 'TIME_OR_PLACE'
        WHEN p.id LIKE 'prompt-general-%' THEN 'EXAMPLE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'favorite|favourite|appeals to you|why do you like' THEN 'FEELING'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'usually spend|usually do|describe your routine|often do|typically use' THEN 'TIME_OR_PLACE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'how will you|explain your plan|make progress|what steps will you take' THEN 'REASON'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'challenge|how do you deal with it|how you deal with it|what you do about it|how you try to solve it' THEN 'REASON'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'benefits and drawbacks|mostly positive|mostly good|what is your view|overall opinion|responsibility|why or why not' THEN 'EXAMPLE'
        ELSE 'EXAMPLE'
    END AS optional_slot_1,
    CASE
        WHEN p.id = 'prompt-a-1' THEN 'FEELING'
        WHEN p.id = 'prompt-a-2' THEN 'EXAMPLE'
        WHEN p.id = 'prompt-a-3' THEN 'FEELING'
        WHEN p.id = 'prompt-a-4' THEN 'TIME_OR_PLACE'
        WHEN p.id = 'prompt-b-1' THEN 'EXAMPLE'
        WHEN p.id IN ('prompt-b-2', 'prompt-b-4', 'prompt-b-5') THEN 'TIME_OR_PLACE'
        WHEN p.id = 'prompt-b-3' THEN 'TIME_OR_PLACE'
        WHEN p.id = 'prompt-c-1' THEN 'FEELING'
        WHEN p.id = 'prompt-c-3' THEN 'FEELING'
        WHEN p.id LIKE 'prompt-routine-%' THEN 'FEELING'
        WHEN p.id LIKE 'prompt-preference-%' THEN 'EXAMPLE'
        WHEN p.id LIKE 'prompt-goal-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN 'TIME_OR_PLACE'
        WHEN p.id LIKE 'prompt-goal-%' THEN 'TIME_OR_PLACE'
        WHEN p.id LIKE 'prompt-problem-%' THEN 'EXAMPLE'
        WHEN p.id LIKE 'prompt-balance-%' THEN 'FEELING'
        WHEN p.id LIKE 'prompt-reflection-%'
             AND MOD(CAST(SUBSTRING_INDEX(p.id, '-', -1) AS UNSIGNED), 5) = 0 THEN 'FEELING'
        WHEN p.id LIKE 'prompt-reflection-%' THEN 'FEELING'
        WHEN p.id LIKE 'prompt-general-%' THEN 'FEELING'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'favorite|favourite|appeals to you|why do you like' THEN 'EXAMPLE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'usually spend|usually do|describe your routine|often do|typically use' THEN 'FEELING'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'how will you|explain your plan|make progress|what steps will you take' THEN 'TIME_OR_PLACE'
        WHEN LOWER(COALESCE(p.question_en, '')) REGEXP 'benefits and drawbacks|mostly positive|mostly good|what is your view|overall opinion' THEN 'FEELING'
        ELSE 'FEELING'
    END AS optional_slot_2
FROM prompts p;

INSERT INTO prompt_task_profiles (prompt_id, answer_mode_id, is_active)
SELECT meta.prompt_id,
       mode.id,
       1
FROM tmp_prompt_task_meta meta
JOIN prompt_answer_modes mode
  ON mode.code = meta.answer_mode_code COLLATE utf8mb4_unicode_ci;

INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)
SELECT meta.prompt_id, slot.id, 'REQUIRED', 1, 1
FROM tmp_prompt_task_meta meta
JOIN prompt_task_slots slot
  ON slot.code = meta.required_slot_1 COLLATE utf8mb4_unicode_ci;

INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)
SELECT meta.prompt_id, slot.id, 'REQUIRED', 2, 1
FROM tmp_prompt_task_meta meta
JOIN prompt_task_slots slot
  ON slot.code = meta.required_slot_2 COLLATE utf8mb4_unicode_ci
WHERE meta.required_slot_2 IS NOT NULL;

INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)
SELECT meta.prompt_id, slot.id, 'OPTIONAL', 3, 1
FROM tmp_prompt_task_meta meta
JOIN prompt_task_slots slot
  ON slot.code = meta.optional_slot_1 COLLATE utf8mb4_unicode_ci
WHERE meta.optional_slot_1 IS NOT NULL;

INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)
SELECT meta.prompt_id, slot.id, 'OPTIONAL', 4, 1
FROM tmp_prompt_task_meta meta
JOIN prompt_task_slots slot
  ON slot.code = meta.optional_slot_2 COLLATE utf8mb4_unicode_ci
WHERE meta.optional_slot_2 IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_task_meta;

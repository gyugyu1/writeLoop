CREATE TABLE IF NOT EXISTS prompt_coach_profiles (
    prompt_id VARCHAR(64) NOT NULL,
    primary_category VARCHAR(64) NOT NULL,
    secondary_categories_json TEXT NOT NULL,
    preferred_expression_families_json TEXT NOT NULL,
    avoid_families_json TEXT NOT NULL,
    starter_style VARCHAR(64) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (prompt_id),
    CONSTRAINT fk_prompt_coach_profiles_prompt
        FOREIGN KEY (prompt_id) REFERENCES prompts (id)
        ON DELETE CASCADE,
    INDEX idx_prompt_coach_profiles_primary_category (primary_category),
    INDEX idx_prompt_coach_profiles_starter_style (starter_style)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'ROUTINE',
    '["habit","daily_life","after_dinner"]',
    '["starter_routine","frequency","time_marker","activity"]',
    '["generic_example_marker","formal_conclusion","compare_balance"]',
    'DIRECT',
    '루틴형 질문입니다. 시간 표현과 순서 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-a-1'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'PREFERENCE',
    '["preference","reason","personal"]',
    '["favorite","reason","adjective","example"]',
    '["compare_balance","formal_conclusion"]',
    'DIRECT',
    '선호형 질문입니다. favorite, because, 형용사 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-a-2'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'ROUTINE',
    '["habit","weekend","leisure"]',
    '["starter_routine","frequency","activity","companion","place"]',
    '["generic_example_marker","formal_conclusion","compare_balance"]',
    'DIRECT',
    '주말 루틴형 질문입니다. 활동, 장소, 함께하는 사람 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-a-3'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'ROUTINE',
    '["habit","after_work","leisure"]',
    '["starter_routine","time_marker","activity","reason"]',
    '["generic_example_marker","formal_conclusion","compare_balance"]',
    'DIRECT',
    '퇴근 후 루틴형 질문입니다. 시간 표현과 활동, 간단한 이유 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-a-4'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'PROBLEM_SOLUTION',
    '["experience","problem","solution"]',
    '["problem","response","sequence","result"]',
    '["generic_example_marker"]',
    'REFLECTIVE',
    '문제 해결형 질문입니다. 문제, 대응, 결과 흐름을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-b-1'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GOAL_PLAN',
    '["travel","place","activity"]',
    '["desire","place","activity","reason"]',
    '["formal_conclusion"]',
    'DIRECT',
    '여행 계획형 질문입니다. 가고 싶은 이유와 현지 활동 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-b-2'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GOAL_PLAN',
    '["goal","plan","habit"]',
    '["goal","plan","process","result"]',
    '["generic_example_marker","formal_conclusion"]',
    'DIRECT',
    '목표 계획형 질문입니다. 습관, 실천 루틴, 이유 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-b-3'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GOAL_PLAN',
    '["travel","place","activity"]',
    '["desire","place","activity","linker"]',
    '["formal_conclusion"]',
    'DIRECT',
    '여행 계획형 질문입니다. 이유와 활동을 연결 표현으로 이어 주는 구성을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-b-4'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'GOAL_PLAN',
    '["goal","plan","growth"]',
    '["goal","plan","process","reason"]',
    '["generic_example_marker","formal_conclusion"]',
    'DIRECT',
    '성장 목표형 질문입니다. 능력, 연습 계획, 개인적인 이유 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-b-5'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'BALANCED_OPINION',
    '["opinion","balance","technology"]',
    '["starter_topic","contrast","opinion","qualification"]',
    '["generic_example_marker"]',
    'BALANCED',
    '균형형 질문입니다. 장단점 비교와 조건부 평가 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-c-1'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'OPINION_REASON',
    '["opinion","reason","society"]',
    '["opinion","responsibility","reason","example"]',
    '["generic_example_marker","casual_habit"]',
    'DIRECT',
    '입장형 질문입니다. 주장, 근거, 예시 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-c-2'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

INSERT INTO prompt_coach_profiles (
    prompt_id,
    primary_category,
    secondary_categories_json,
    preferred_expression_families_json,
    avoid_families_json,
    starter_style,
    notes
)
SELECT
    id,
    'CHANGE_REFLECTION',
    '["reflection","change","cause"]',
    '["past_present","change","cause","realization"]',
    '["generic_example_marker"]',
    'REFLECTIVE',
    '변화 회고형 질문입니다. 과거-현재 대비와 변화 계기 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-c-3'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

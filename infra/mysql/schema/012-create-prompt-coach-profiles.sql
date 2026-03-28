CREATE TABLE prompt_coach_profiles (
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
    '저녁 이후 루틴형 질문입니다. 시간표지와 빈도 표현을 우선 추천하고, 무거운 결론형 표현은 뒤로 미룹니다.'
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
    '좋아하는 대상과 이유를 함께 말하는 질문입니다. favorite, because, 형용사 표현을 우선 추천합니다.'
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
    '주말 루틴형 질문입니다. 빈도, 활동, 함께하는 사람, 장소 표현을 우선 추천합니다.'
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
    'PROBLEM_SOLUTION',
    '["experience","problem","solution"]',
    '["problem","response","sequence","result"]',
    '["generic_example_marker"]',
    'REFLECTIVE',
    '문제 상황과 해결 과정을 말하는 질문입니다. 문제 -> 대응 -> 결과 흐름을 살리는 표현을 우선 추천합니다.'
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
    '가보고 싶은 장소와 그곳에서 하고 싶은 일을 말하는 질문입니다. desire, place, activity 표현을 우선 추천합니다.'
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
    '["generic_example_marker"]',
    'DIRECT',
    '올해 만들고 싶은 습관과 실천 계획을 말하는 질문입니다. 목표, 계획, 유지 과정 표현을 우선 추천합니다.'
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
    'BALANCED_OPINION',
    '["opinion","balance","technology"]',
    '["starter_topic","contrast","opinion","qualification"]',
    '["generic_example_marker"]',
    'BALANCED',
    '기술 변화의 장단점을 함께 다루는 균형형 질문입니다. 대조, 입장, 조건부 평가 표현을 우선 추천합니다.'
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
    '사회적 책임에 대한 입장과 근거를 말하는 질문입니다. 주장, 책임, 근거, 구체 예시 표현을 우선 추천합니다.'
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
    '시간이 지나며 바뀐 생각을 돌아보는 질문입니다. 과거-현재 대비와 변화 계기 표현을 우선 추천합니다.'
FROM prompts
WHERE id = 'prompt-c-3'
ON DUPLICATE KEY UPDATE
    primary_category = VALUES(primary_category),
    secondary_categories_json = VALUES(secondary_categories_json),
    preferred_expression_families_json = VALUES(preferred_expression_families_json),
    avoid_families_json = VALUES(avoid_families_json),
    starter_style = VALUES(starter_style),
    notes = VALUES(notes);

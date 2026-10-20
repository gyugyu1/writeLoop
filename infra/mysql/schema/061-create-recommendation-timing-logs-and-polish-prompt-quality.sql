-- Cross-reviewed prompt and hint quality pass.
-- Focus: natural English questions, Korean typo cleanup, and tighter hint-to-question matching.

-- Runtime seed alignment and obvious duplicate/similarity cleanup.
UPDATE prompts
SET difficulty = 'I'
WHERE id IN ('prompt-a-1', 'prompt-a-2', 'prompt-a-3', 'prompt-a-4');

UPDATE prompts
SET question_en = 'What is your favorite quick meal at home, and why do you like it?',
    question_ko = '집에서 간단히 먹기 좋은 음식 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?',
    tip = '음식 이름과 좋아하는 이유를 한두 가지로 말해 보세요.',
    difficulty = 'I'
WHERE id = 'prompt-a-2';

UPDATE prompt_hint_items
SET content = 'My favorite quick meal at home is ... because ...',
    meaning_ko = '집에서 간단히 먹기 좋은 내가 가장 좋아하는 음식은 ...이고, 이유는 ...',
    usage_tip_ko = '간단히 먹는 음식과 이유를 바로 연결할 때 사용하세요.',
    example_en = 'My favorite quick meal at home is fried rice because it is easy to make.'
WHERE id = 'hint-a-2-1-item-1';

UPDATE prompt_hint_items
SET content = 'quick',
    meaning_ko = '빠른, 간단한',
    usage_tip_ko = '음식이 빨리 준비된다는 점을 말할 때 사용하세요.',
    example_en = 'It is quick and easy to make.'
WHERE id = 'hint-a-2-2-item-1';

UPDATE prompts
SET question_en = 'What kind of trip would you like to take next year, and how would you prepare for it?',
    question_ko = '내년에 어떤 여행을 해 보고 싶고, 어떻게 준비하고 싶나요?',
    tip = '가고 싶은 여행의 종류와 준비 방법을 한두 가지로 연결해 보세요.',
    is_active = 1
WHERE id = 'prompt-b-4';

INSERT IGNORE INTO prompt_topic_categories (name, display_order, is_active)
VALUES ('Preference', 2, 1);

INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)
SELECT category.id, 'Quick Meal', 2, 1
FROM prompt_topic_categories category
WHERE category.name = 'Preference'
ON DUPLICATE KEY UPDATE
name = VALUES(name),
display_order = VALUES(display_order),
is_active = VALUES(is_active);

UPDATE prompts prompt
JOIN prompt_topic_categories category
  ON category.name = 'Preference'
JOIN prompt_topic_details detail
  ON detail.category_id = category.id
 AND detail.name = 'Quick Meal'
SET prompt.topic_detail_id = detail.id
WHERE prompt.id = 'prompt-a-2';

INSERT IGNORE INTO prompt_topic_categories (name, display_order, is_active)
VALUES ('Goal Plan', 3, 1);

INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)
SELECT category.id, 'Travel Preparation', 11, 1
FROM prompt_topic_categories category
WHERE category.name = 'Goal Plan'
ON DUPLICATE KEY UPDATE
name = VALUES(name),
display_order = VALUES(display_order),
is_active = VALUES(is_active);

UPDATE prompts prompt
JOIN prompt_topic_categories category
  ON category.name = 'Goal Plan'
JOIN prompt_topic_details detail
  ON detail.category_id = category.id
 AND detail.name = 'Travel Preparation'
SET prompt.topic_detail_id = detail.id
WHERE prompt.id = 'prompt-b-4';

UPDATE prompt_hint_items
SET content = 'Next year, I would like to take ... because ...',
    meaning_ko = '내년에는 ... 여행을 해 보고 싶어요. 왜냐하면 ...',
    usage_tip_ko = '가고 싶은 여행의 종류와 이유를 먼저 말할 때 사용하세요.',
    example_en = 'Next year, I would like to take a short beach trip because I want to relax.',
    expression_family = 'STARTER_GOAL_TRAVEL'
WHERE id = 'hint-b-4-1-item-1';

UPDATE prompt_hint_items
SET content = 'prepare my budget',
    meaning_ko = '예산을 준비하다',
    usage_tip_ko = '여행 전에 준비해야 할 일을 말할 때 사용하세요.',
    example_en = 'I would prepare my budget before I book anything.',
    expression_family = 'TRAVEL_PREPARATION'
WHERE id = 'hint-b-4-3-item-1';

-- English question naturalness fixes.
UPDATE prompts
SET question_en = 'What social responsibilities should successful companies have in modern society?',
    question_ko = '현대 사회에서 성공한 기업들은 어떤 사회적 책임을 가져야 할까요?'
WHERE id IN ('prompt-opinion-01', 'prompt-c-2');

UPDATE prompts
SET question_en = 'Tell me about your favorite online creator and explain why you like them so much.',
    question_ko = '가장 좋아하는 온라인 크리에이터에 대해 말하고, 왜 그렇게 좋아하는지 설명해 주세요.'
WHERE id = 'prompt-preference-1117';

UPDATE prompts
SET question_en = 'When you eat lunch with a friend, what do you usually do?',
    question_ko = '친구와 점심을 먹을 때 보통 무엇을 하나요?'
WHERE id = 'prompt-routine-2048';

UPDATE prompts
SET question_en = 'What do you usually do after you check the weather forecast?',
    question_ko = '일기예보를 확인한 뒤 보통 무엇을 하나요?',
    tip = '날씨에 맞춰 챙기는 물건이나 행동을 순서대로 말해 보세요.'
WHERE id = 'prompt-routine-2401';

UPDATE prompt_hint_items
SET content = 'After I check the weather forecast, I usually ...',
    meaning_ko = '일기예보를 확인한 뒤 나는 보통 ...',
    usage_tip_ko = '날씨 확인 뒤에 이어지는 행동을 말할 때 사용하세요.',
    example_en = 'After I check the weather forecast, I usually choose my clothes and pack my bag.'
WHERE id = 'hint-routine-2401-1-item-1';

UPDATE prompts
SET question_en = 'What do you usually do before you put on a scarf on a cold morning?',
    question_ko = '추운 아침에 목도리를 두르기 전에 보통 무엇을 하나요?'
WHERE id = 'prompt-routine-2406';

UPDATE prompts
SET question_en = 'What do you usually do after you put on lotion at night?',
    question_ko = '밤에 로션을 바른 뒤 보통 무엇을 하나요?'
WHERE id = 'prompt-routine-2470';

UPDATE prompts
SET question_en = 'What kind of bottle do you like best to carry around, and why do you like it?',
    question_ko = '가지고 다니기 좋은 병은 어떤 종류를 가장 좋아하고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2507';

UPDATE prompts
SET question_en = 'Which bottle shape feels best in your hand, and why do you like it?',
    question_ko = '손에 쥐었을 때 가장 편한 병 모양은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2514';

UPDATE prompts
SET question_en = 'What is your favorite side dish to pack in a lunchbox, and why do you like it?',
    question_ko = '도시락에 넣기 좋은 반찬 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2209';

UPDATE prompts
SET question_en = 'What is your favorite snack with a soft texture, and why do you like it?',
    question_ko = '부드러운 식감의 간식 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2229';

UPDATE prompts
SET question_en = 'What is your favorite scent for bath salts, and why do you like it?',
    question_ko = '배스 솔트 향 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2283';

UPDATE prompts
SET question_en = 'What is your favorite type of sheet mask, and why do you like it?',
    question_ko = '시트 마스크 종류 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2285';

UPDATE prompts
SET question_en = 'What is your favorite container for small frozen foods, and why do you like it?',
    question_ko = '작은 냉동식품을 보관할 때 가장 좋아하는 용기는 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2572';

UPDATE prompts
SET question_en = 'What is your favorite thermos to take with you when you go out, and why do you like it?',
    question_ko = '외출할 때 가져가기 좋은 보온병 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2574';

UPDATE prompts
SET question_en = 'What do you usually do before you turn off the ceiling light at night?',
    question_ko = '밤에 천장등을 끄기 전에 보통 무엇을 하나요?'
WHERE id = 'prompt-routine-2105';

UPDATE prompts
SET question_en = 'Introduce a teacher or mentor who influenced you and explain what you learned from them.',
    question_ko = '나에게 영향을 준 선생님이나 멘토를 소개하고, 그분에게서 무엇을 배웠는지 설명해 주세요.'
WHERE id = 'prompt-general-13';

UPDATE prompts
SET question_en = 'Introduce a memory that still matters to you and explain why it is meaningful to you.',
    question_ko = '지금도 의미 있는 기억을 소개하고, 왜 나에게 의미가 있는지 설명해 주세요.'
WHERE id = 'prompt-general-23';

UPDATE prompts
SET question_en = 'What personal care product do you like to use before bed, and why?',
    question_ko = '잠들기 전에 즐겨 쓰는 관리 제품은 무엇이고, 왜 좋아하나요?'
WHERE id = 'prompt-preference-2290';

UPDATE prompt_hint_items
SET content = 'Before bed, I like to use ... because ...',
    meaning_ko = '잠들기 전에 나는 ...을 쓰는 것을 좋아해요. 왜냐하면 ...',
    usage_tip_ko = '잠들기 전 사용하는 제품과 이유를 바로 연결할 때 사용하세요.',
    example_en = 'Before bed, I like to use a mild lotion because it feels gentle on my skin.'
WHERE id = 'hint-preference-2290-1-item-1';

-- Korean typo and particle cleanup.
UPDATE prompts
SET question_ko = '점심시간은 보통 어떻게 보내나요?'
WHERE id = 'prompt-routine-36';

UPDATE prompts
SET question_ko = '조별 과제나 팀 프로젝트를 할 때 자주 겪는 어려움은 무엇이고, 어떻게 해결하려고 하나요?'
WHERE id = 'prompt-problem-31';

UPDATE prompts
SET question_ko = REPLACE(question_ko, '가족 전통를', '가족 전통을')
WHERE id = 'prompt-general-36';

UPDATE prompts
SET question_ko = REPLACE(question_ko, '음료을', '음료를')
WHERE id = 'prompt-preference-1103';

UPDATE prompts
SET question_ko = REPLACE(question_ko, '가장 좋아하는 좋아하는', '가장 좋아하는')
WHERE id IN (
    'prompt-preference-1105', 'prompt-preference-1109', 'prompt-preference-1111',
    'prompt-preference-1114', 'prompt-preference-1123', 'prompt-preference-1126'
);

UPDATE prompts
SET question_ko = REPLACE(question_ko, '자리을', '자리를')
WHERE id = 'prompt-preference-1112';

UPDATE prompts
SET question_ko = REPLACE(question_ko, '것와', '것과')
WHERE id IN (
    'prompt-goal-1101', 'prompt-goal-1102', 'prompt-goal-1103', 'prompt-goal-1104',
    'prompt-goal-1105', 'prompt-goal-1106', 'prompt-goal-1107', 'prompt-goal-1108',
    'prompt-goal-1109', 'prompt-goal-1110', 'prompt-goal-1111', 'prompt-goal-1112',
    'prompt-goal-1113', 'prompt-goal-1114', 'prompt-goal-1115', 'prompt-goal-1116',
    'prompt-goal-1117', 'prompt-goal-1118', 'prompt-goal-1119', 'prompt-goal-1120',
    'prompt-goal-1121', 'prompt-goal-1122', 'prompt-goal-1123', 'prompt-goal-1124',
    'prompt-goal-1125', 'prompt-goal-1126', 'prompt-goal-1127'
);

UPDATE prompts
SET question_ko = REPLACE(question_ko, '것이(가)', '것이');

UPDATE prompts
SET question_ko = REPLACE(question_ko, '이(가)', '이')
WHERE question_ko LIKE '%이(가)%'
  AND (
      question_ko LIKE '%사무실이(가)%' OR
      question_ko LIKE '%청원이(가)%' OR
      question_ko LIKE '%매점이(가)%' OR
      question_ko LIKE '%박물관이(가)%' OR
      question_ko LIKE '%서점이(가)%' OR
      question_ko LIKE '%편의점이(가)%' OR
      question_ko LIKE '%캠페인이(가)%' OR
      question_ko LIKE '%기업이(가)%' OR
      question_ko LIKE '%방송이(가)%' OR
      question_ko LIKE '%프로그램이(가)%' OR
      question_ko LIKE '%기차역이(가)%' OR
      question_ko LIKE '%식당이(가)%' OR
      question_ko LIKE '%공간이(가)%' OR
      question_ko LIKE '%정원이(가)%' OR
      question_ko LIKE '%수영장이(가)%' OR
      question_ko LIKE '%의원이(가)%'
  );

UPDATE prompts
SET question_ko = REPLACE(question_ko, '이(가)', '가')
WHERE question_ko LIKE '%이(가)%'
  AND (
      question_ko LIKE '%교과서이(가)%' OR
      question_ko LIKE '%응대이(가)%' OR
      question_ko LIKE '%근무제이(가)%' OR
      question_ko LIKE '%커머스이(가)%' OR
      question_ko LIKE '%서비스이(가)%' OR
      question_ko LIKE '%매체이(가)%' OR
      question_ko LIKE '%센터이(가)%' OR
      question_ko LIKE '%지방자치단체이(가)%' OR
      question_ko LIKE '%축제이(가)%'
  );

UPDATE prompt_hint_items
SET meaning_ko = REPLACE(meaning_ko, '것이(가)', '것이')
WHERE meaning_ko LIKE '%것이(가)%';

UPDATE prompt_hint_items
SET meaning_ko = REPLACE(meaning_ko, '이(가)', '이')
WHERE meaning_ko LIKE '%이(가)%'
  AND (
      meaning_ko LIKE '%공원이(가)%' OR
      meaning_ko LIKE '%박물관이(가)%' OR
      meaning_ko LIKE '%서점이(가)%' OR
      meaning_ko LIKE '%편의점이(가)%' OR
      meaning_ko LIKE '%클럽이(가)%' OR
      meaning_ko LIKE '%캠페인이(가)%' OR
      meaning_ko LIKE '%기업이(가)%' OR
      meaning_ko LIKE '%방송이(가)%' OR
      meaning_ko LIKE '%프로그램이(가)%' OR
      meaning_ko LIKE '%기차역이(가)%' OR
      meaning_ko LIKE '%시스템이(가)%' OR
      meaning_ko LIKE '%식당이(가)%' OR
      meaning_ko LIKE '%플랫폼이(가)%' OR
      meaning_ko LIKE '%공간이(가)%' OR
      meaning_ko LIKE '%정원이(가)%' OR
      meaning_ko LIKE '%복지관이(가)%' OR
      meaning_ko LIKE '%수영장이(가)%' OR
      meaning_ko LIKE '%의원이(가)%'
  );

UPDATE prompt_hint_items
SET meaning_ko = REPLACE(meaning_ko, '이(가)', '가')
WHERE meaning_ko LIKE '%이(가)%'
  AND (
      meaning_ko LIKE '%대학교이(가)%' OR
      meaning_ko LIKE '%매체이(가)%' OR
      meaning_ko LIKE '%보호소이(가)%' OR
      meaning_ko LIKE '%센터이(가)%' OR
      meaning_ko LIKE '%학교이(가)%' OR
      meaning_ko LIKE '%지방자치단체이(가)%' OR
      meaning_ko LIKE '%축제이(가)%'
  );

-- Topic-detail labels shown in prompt lists.
UPDATE prompt_topic_details
SET name = 'Saturday Morning Routine'
WHERE name = 'The Start of Saturday';

UPDATE prompt_topic_details
SET name = 'Commute Routine'
WHERE name = 'Commute Moves';

UPDATE prompt_topic_details
SET name = 'Phone Habits'
WHERE name = 'Phone and Study Micro Habits';

UPDATE prompt_topic_details
SET name = 'Nearby Places'
WHERE name = 'Neighborhood and Simple Places';

-- Hints that described the wrong time point for "before/after" routine prompts.
UPDATE prompt_hint_items
SET content = 'stretch my body',
    meaning_ko = '몸을 가볍게 펴다',
    usage_tip_ko = '알람을 끈 뒤 바로 하는 간단한 행동을 말할 때 사용하세요.',
    example_en = 'I stretch my body before I get out of bed.',
    expression_family = 'INTRO_ROUTINE_MORNING'
WHERE id = 'hint-routine-2002-3-item-1';

UPDATE prompt_hint_items
SET content = 'wash my hands',
    meaning_ko = '손을 씻다',
    usage_tip_ko = '도시락을 열기 전에 하는 준비 행동을 말할 때 사용하세요.',
    example_en = 'I wash my hands before I open my lunch box.',
    expression_family = 'INTRO_ROUTINE_LUNCH_PREP'
WHERE id = 'hint-routine-2046-3-item-1';

UPDATE prompt_hint_items
SET content = 'pack my bag',
    meaning_ko = '가방을 챙기다',
    usage_tip_ko = '집에 가기 전에 하는 준비 행동을 말할 때 사용하세요.',
    example_en = 'I pack my bag before I head home.',
    expression_family = 'INTRO_ROUTINE_GO_HOME'
WHERE id = 'hint-routine-2061-3-item-1';

UPDATE prompt_hint_items
SET content = 'check my keys',
    meaning_ko = '열쇠를 확인하다',
    usage_tip_ko = '집에 가기 전 챙기는 물건을 말할 때 사용하세요.',
    example_en = 'I check my keys before I leave.',
    expression_family = 'INTRO_ROUTINE_GO_HOME'
WHERE id = 'hint-routine-2061-3-item-2';

UPDATE prompt_hint_items
SET content = 'say goodbye',
    meaning_ko = '인사를 하다',
    usage_tip_ko = '자리를 떠나기 전 하는 행동을 말할 때 사용하세요.',
    example_en = 'I say goodbye before I head home.',
    expression_family = 'INTRO_ROUTINE_GO_HOME'
WHERE id = 'hint-routine-2061-3-item-3';

UPDATE prompt_hint_items
SET content = 'check the route',
    meaning_ko = '경로를 확인하다',
    usage_tip_ko = '귀가 전에 길이나 교통편을 확인할 때 사용하세요.',
    example_en = 'I check the route before I go home.',
    expression_family = 'INTRO_ROUTINE_GO_HOME'
WHERE id = 'hint-routine-2061-3-item-4';

UPDATE prompt_hint_items
SET content = 'put on my shoes',
    meaning_ko = '신발을 신다',
    usage_tip_ko = '밖으로 나가기 전 마지막 준비 행동을 말할 때 사용하세요.',
    example_en = 'I put on my shoes before I head home.',
    expression_family = 'INTRO_ROUTINE_GO_HOME'
WHERE id = 'hint-routine-2061-3-item-5';

UPDATE prompt_hint_items
SET content = 'check my wallet',
    meaning_ko = '지갑을 확인하다',
    usage_tip_ko = '편의점에 들어가기 전 준비 행동을 말할 때 사용하세요.',
    example_en = 'I check my wallet before I enter the convenience store.',
    expression_family = 'INTRO_ROUTINE_STORE_PREP'
WHERE id = 'hint-routine-2416-3-item-2';

UPDATE prompt_hint_items
SET content = 'check my shopping list',
    meaning_ko = '쇼핑 목록을 확인하다',
    usage_tip_ko = '가게에 들어가기 전에 살 것을 확인할 때 사용하세요.',
    example_en = 'I check my shopping list before I go inside.',
    expression_family = 'INTRO_ROUTINE_STORE_PREP'
WHERE id = 'hint-routine-2416-3-item-3';

UPDATE prompt_hint_items
SET content = 'decide what to buy',
    meaning_ko = '무엇을 살지 정하다',
    usage_tip_ko = '편의점에 들어가기 전 구매 계획을 말할 때 사용하세요.',
    example_en = 'I decide what to buy before I enter the store.',
    expression_family = 'INTRO_ROUTINE_STORE_PREP'
WHERE id = 'hint-routine-2416-3-item-4';

UPDATE prompt_hint_items
SET content = 'check the store hours',
    meaning_ko = '영업시간을 확인하다',
    usage_tip_ko = '가게에 들어가기 전 확인하는 정보를 말할 때 사용하세요.',
    example_en = 'I check the store hours before I walk in.',
    expression_family = 'INTRO_ROUTINE_STORE_PREP'
WHERE id = 'hint-routine-2416-3-item-5';

UPDATE prompt_hint_items
SET content = 'get a clean towel',
    meaning_ko = '깨끗한 수건을 챙기다',
    usage_tip_ko = '샤워 전 준비물을 말할 때 사용하세요.',
    example_en = 'I get a clean towel before I take a shower.',
    expression_family = 'INTRO_ROUTINE_SHOWER_PREP'
WHERE id = 'hint-routine-2461-3-item-1';

UPDATE prompt_hint_items
SET content = 'prepare my pajamas',
    meaning_ko = '잠옷을 준비하다',
    usage_tip_ko = '샤워 전에 미리 준비하는 것을 말할 때 사용하세요.',
    example_en = 'I prepare my pajamas before I take a shower.',
    expression_family = 'INTRO_ROUTINE_SHOWER_PREP'
WHERE id = 'hint-routine-2461-3-item-2';

UPDATE prompt_hint_items
SET content = 'take off my watch',
    meaning_ko = '시계를 빼다',
    usage_tip_ko = '샤워 전에 몸에서 빼는 물건을 말할 때 사용하세요.',
    example_en = 'I take off my watch before I take a shower.',
    expression_family = 'INTRO_ROUTINE_SHOWER_PREP'
WHERE id = 'hint-routine-2461-3-item-3';

UPDATE prompt_hint_items
SET content = 'turn on the water',
    meaning_ko = '물을 틀다',
    usage_tip_ko = '샤워를 시작하기 직전의 행동을 말할 때 사용하세요.',
    example_en = 'I turn on the water before I get in.',
    expression_family = 'INTRO_ROUTINE_SHOWER_PREP'
WHERE id = 'hint-routine-2461-3-item-4';

UPDATE prompt_hint_items
SET content = 'set out my shampoo',
    meaning_ko = '샴푸를 꺼내 두다',
    usage_tip_ko = '샤워 전 필요한 물건을 준비할 때 사용하세요.',
    example_en = 'I set out my shampoo before I take a shower.',
    expression_family = 'INTRO_ROUTINE_SHOWER_PREP'
WHERE id = 'hint-routine-2461-3-item-5';

-- Eraser prompt had unrelated stationery/tool words in the expanded word slots.
UPDATE prompt_hint_items
SET content = 'rubber',
    meaning_ko = '고무 재질',
    usage_tip_ko = '지우개의 재질이나 느낌을 말할 때 사용하세요.',
    example_en = 'A soft rubber eraser feels easy to use.',
    expression_family = 'INTRO_PREF_ERASER'
WHERE id = 'hint-preference-2232-2-item-6';

UPDATE prompt_hint_items
SET content = 'pencil marks',
    meaning_ko = '연필 자국',
    usage_tip_ko = '지우개가 지우는 대상을 말할 때 사용하세요.',
    example_en = 'It removes pencil marks cleanly.',
    expression_family = 'INTRO_PREF_ERASER'
WHERE id = 'hint-preference-2232-2-item-7';

UPDATE prompt_hint_items
SET content = 'smudge',
    meaning_ko = '번짐',
    usage_tip_ko = '지운 뒤 종이가 지저분해지는 느낌을 말할 때 사용하세요.',
    example_en = 'It does not leave a dark smudge.',
    expression_family = 'INTRO_PREF_ERASER'
WHERE id = 'hint-preference-2232-2-item-8';

UPDATE prompt_hint_items
SET content = 'corner',
    meaning_ko = '모서리',
    usage_tip_ko = '작은 부분을 지우기 쉬운 모양을 말할 때 사용하세요.',
    example_en = 'The corner helps me erase small parts.',
    expression_family = 'INTRO_PREF_ERASER'
WHERE id = 'hint-preference-2232-2-item-9';

UPDATE prompt_hint_items
SET content = 'dust',
    meaning_ko = '지우개 가루',
    usage_tip_ko = '지우개를 쓴 뒤 생기는 가루를 말할 때 사용하세요.',
    example_en = 'It does not make too much dust.',
    expression_family = 'INTRO_PREF_ERASER'
WHERE id = 'hint-preference-2232-2-item-10';

-- Legacy general prompts had broad expansion words whose examples referenced unrelated places/apps.
UPDATE prompt_hint_items
SET content = 'convenient',
    meaning_ko = '편리한',
    usage_tip_ko = '앱이나 도구가 쓰기 편한 이유를 말할 때 사용하세요.',
    example_en = 'The app is convenient when I need quick information.',
    expression_family = 'GENERAL_APP_VOCAB'
WHERE id REGEXP '^hint-gen-0[2-5]-2-item-6$';

UPDATE prompt_hint_items
SET content = 'reliable',
    meaning_ko = '믿을 만한',
    usage_tip_ko = '앱이나 도구를 자주 믿고 쓰는 이유를 말할 때 사용하세요.',
    example_en = 'It is reliable when I need quick help.',
    expression_family = 'GENERAL_APP_VOCAB'
WHERE id REGEXP '^hint-gen-0[2-5]-2-item-7$';

UPDATE prompt_hint_items
SET content = 'time-saving',
    meaning_ko = '시간을 아껴 주는',
    usage_tip_ko = '앱이나 도구가 시간을 줄여 주는 장점을 말할 때 사용하세요.',
    example_en = 'It saves time during my daily routine.',
    expression_family = 'GENERAL_APP_VOCAB'
WHERE id REGEXP '^hint-gen-0[2-5]-2-item-8$';

UPDATE prompt_hint_items
SET content = 'cozy',
    meaning_ko = '아늑한',
    usage_tip_ko = '좋아하는 장소의 분위기를 말할 때 사용하세요.',
    example_en = 'The place feels cozy when I spend time there.',
    expression_family = 'GENERAL_PLACE_VOCAB'
WHERE id REGEXP '^hint-gen-(0[7-9]|10)-2-item-6$';

UPDATE prompt_hint_items
SET content = 'nearby',
    meaning_ko = '가까운',
    usage_tip_ko = '장소가 가까워서 자주 간다는 점을 말할 때 사용하세요.',
    example_en = 'It is nearby, so I can visit often.',
    expression_family = 'GENERAL_PLACE_VOCAB'
WHERE id REGEXP '^hint-gen-(0[7-9]|10)-2-item-7$';

UPDATE prompt_hint_items
SET content = 'peaceful',
    meaning_ko = '평화로운',
    usage_tip_ko = '장소에서 느끼는 차분한 분위기를 말할 때 사용하세요.',
    example_en = 'It feels peaceful even on busy days.',
    expression_family = 'GENERAL_PLACE_VOCAB'
WHERE id REGEXP '^hint-gen-(0[7-9]|10)-2-item-8$';

UPDATE prompt_hint_items
SET content = 'patient',
    meaning_ko = '인내심 있는',
    usage_tip_ko = '선생님이나 멘토의 성격을 설명할 때 사용하세요.',
    example_en = 'That teacher was patient when I made mistakes.',
    expression_family = 'GENERAL_MENTOR_VOCAB'
WHERE id REGEXP '^hint-gen-1[2-5]-2-item-6$';

UPDATE prompt_hint_items
SET content = 'supportive',
    meaning_ko = '힘이 되어 주는',
    usage_tip_ko = '멘토가 도와준 방식을 말할 때 사용하세요.',
    example_en = 'My mentor was supportive when I felt unsure.',
    expression_family = 'GENERAL_MENTOR_VOCAB'
WHERE id REGEXP '^hint-gen-1[2-5]-2-item-7$';

UPDATE prompt_hint_items
SET content = 'inspiring',
    meaning_ko = '영감을 주는',
    usage_tip_ko = '선생님이나 멘토가 준 긍정적 영향을 말할 때 사용하세요.',
    example_en = 'Their advice was inspiring to me.',
    expression_family = 'GENERAL_MENTOR_VOCAB'
WHERE id REGEXP '^hint-gen-1[2-5]-2-item-8$';

UPDATE prompt_hint_items
SET content = 'healthy',
    meaning_ko = '건강에 좋은',
    usage_tip_ko = '취미가 몸이나 마음에 주는 장점을 말할 때 사용하세요.',
    example_en = 'This hobby helps me stay healthy.',
    expression_family = 'GENERAL_HOBBY_VOCAB'
WHERE id REGEXP '^hint-gen-(1[7-9]|20)-2-item-6$';

UPDATE prompt_hint_items
SET content = 'creative',
    meaning_ko = '창의적인',
    usage_tip_ko = '취미가 표현이나 창의성을 도와준다는 점을 말할 때 사용하세요.',
    example_en = 'It gives me a creative outlet.',
    expression_family = 'GENERAL_HOBBY_VOCAB'
WHERE id REGEXP '^hint-gen-(1[7-9]|20)-2-item-7$';

UPDATE prompt_hint_items
SET content = 'affordable',
    meaning_ko = '부담 없이 시작할 수 있는',
    usage_tip_ko = '취미를 시작하기 쉬운 이유를 말할 때 사용하세요.',
    example_en = 'It is affordable and easy to start.',
    expression_family = 'GENERAL_HOBBY_VOCAB'
WHERE id REGEXP '^hint-gen-(1[7-9]|20)-2-item-8$';

UPDATE prompt_hint_items
SET content = 'vivid',
    meaning_ko = '생생한',
    usage_tip_ko = '기억이 아직 선명하다는 점을 말할 때 사용하세요.',
    example_en = 'The memory still feels vivid to me.',
    expression_family = 'GENERAL_MEMORY_VOCAB'
WHERE id REGEXP '^hint-gen-2[2-5]-2-item-6$';

UPDATE prompt_hint_items
SET content = 'personal',
    meaning_ko = '개인적인',
    usage_tip_ko = '기억이 나에게 특별한 이유를 말할 때 사용하세요.',
    example_en = 'It is personal because it changed how I think.',
    expression_family = 'GENERAL_MEMORY_VOCAB'
WHERE id REGEXP '^hint-gen-2[2-5]-2-item-7$';

UPDATE prompt_hint_items
SET content = 'lesson',
    meaning_ko = '교훈',
    usage_tip_ko = '기억에서 배운 점을 말할 때 사용하세요.',
    example_en = 'The memory taught me an important lesson.',
    expression_family = 'GENERAL_MEMORY_VOCAB'
WHERE id REGEXP '^hint-gen-2[2-5]-2-item-8$';

-- Small expression-level cleanups.
UPDATE prompt_hint_items
SET content = 'comforting',
    meaning_ko = '마음이 편안해지는',
    usage_tip_ko = '음식이나 음료가 주는 편안한 느낌을 말할 때 사용하세요.',
    example_en = 'Comforting soup makes me feel better.'
WHERE id = 'hint-preference-1107-2-mixed-044-item-1';

UPDATE prompt_hint_items
SET content = 'watch TV',
    example_en = REPLACE(example_en, 'watch tv', 'watch TV')
WHERE id = 'hint-rtn-16-2-mixed-044-item-4';

UPDATE prompt_hint_items
SET example_en = CONCAT(UPPER(LEFT(example_en, 1)), SUBSTRING(example_en, 2))
WHERE hint_id IN (
    'hint-preference-1104-2', 'hint-preference-1107-2', 'hint-preference-1118-2',
    'hint-goal-1116-2', 'hint-goal-1124-2', 'hint-balance-1124-2',
    'hint-opinion-1106-2', 'hint-opinion-1111-2', 'hint-opinion-1113-2',
    'hint-opinion-1115-2', 'hint-reflection-1104-2', 'hint-reflection-1108-2',
    'hint-reflection-1122-2', 'hint-reflection-1123-2', 'hint-reflection-1124-2',
    'hint-general-1124-2', 'hint-general-1125-2'
)
  AND example_en REGEXP '^[a-z]';

UPDATE prompt_hint_items
SET example_en = REPLACE(example_en, ' i ', ' I ')
WHERE hint_id IN (
    'hint-preference-1104-2', 'hint-preference-1107-2', 'hint-preference-1118-2',
    'hint-goal-1116-2', 'hint-goal-1124-2', 'hint-balance-1124-2',
    'hint-opinion-1106-2', 'hint-opinion-1111-2', 'hint-opinion-1113-2',
    'hint-opinion-1115-2', 'hint-reflection-1104-2', 'hint-reflection-1108-2',
    'hint-reflection-1122-2', 'hint-reflection-1123-2', 'hint-reflection-1124-2',
    'hint-general-1124-2', 'hint-general-1125-2'
);

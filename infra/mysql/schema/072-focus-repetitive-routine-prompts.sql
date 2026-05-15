-- Focus repetitive routine prompts into clearer, single-action questions.
-- These replace vague "things feel smoother" and awkward "rushed when" templates.

START TRANSACTION;

CREATE TEMPORARY TABLE prompt_routine_focus_reframes (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    question_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    question_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    tip TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_routine_focus_reframes (id, question_en, question_ko, tip) VALUES
    ('prompt-routine-2002', 'What do you prepare the night before to make your morning easier?', '아침을 더 편하게 보내기 위해 전날 밤에 무엇을 준비하나요?', '준비하는 것 한 가지와 다음 날 아침에 어떤 점이 쉬워지는지 말해 보세요.'),
    ('prompt-routine-2005', 'When you are rushed in the morning, what do you do to stay calm?', '아침에 서두를 때 침착하게 지내기 위해 무엇을 하나요?', '서두르는 상황에서 실제로 하는 행동과 도움이 되는 이유를 말해 보세요.'),
    ('prompt-routine-2007', 'How do you usually feel when you get ready in the morning, and why?', '아침에 준비할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '아침 준비 중 느끼는 감정과 그 이유를 간단히 말해 보세요.'),
    ('prompt-routine-2011', 'What small choice makes your morning routine better, and why?', '아침 루틴을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '작은 선택 하나와 그 선택이 아침을 어떻게 바꾸는지 말해 보세요.'),
    ('prompt-routine-2016', 'What do you check before moving from one place to another?', '다른 장소로 이동하기 전에 무엇을 확인하나요?', '이동 전에 확인하는 것과 그 이유를 말해 보세요.'),
    ('prompt-routine-2020', 'When you are rushed while moving somewhere, what do you do to stay calm?', '어딘가로 이동하면서 서두를 때 침착하게 지내기 위해 무엇을 하나요?', '이동 중 서두르는 상황에서 하는 행동을 구체적으로 말해 보세요.'),
    ('prompt-routine-2022', 'How do you usually feel when you move from one place to another, and why?', '다른 장소로 이동할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '이동할 때의 느낌과 그 이유를 한 가지 상황으로 말해 보세요.'),
    ('prompt-routine-2028', 'What small choice makes moving around easier for you, and why?', '이동을 더 쉽게 만들어 주는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '이동 전에 고르는 행동이나 물건 하나와 이유를 말해 보세요.'),
    ('prompt-routine-2032', 'What do you do at the start of a short break to make it restful?', '짧은 휴식을 시작할 때 더 잘 쉬기 위해 무엇을 하나요?', '휴식을 시작하는 순간의 행동과 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2036', 'When your break feels rushed, what do you do to slow down?', '휴식 시간이 급하게 느껴질 때 천천히 쉬기 위해 무엇을 하나요?', '짧은 휴식 중 속도를 늦추는 행동을 말해 보세요.'),
    ('prompt-routine-2039', 'How do you usually feel during a short break, and why?', '짧은 휴식 시간에는 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '쉬는 동안의 느낌과 그렇게 느끼는 이유를 말해 보세요.'),
    ('prompt-routine-2046', 'What do you prepare before lunch or a snack so it feels easier?', '점심이나 간식을 먹기 전에 더 편하게 먹으려고 무엇을 준비하나요?', '먹기 전에 준비하는 것과 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2051', 'When lunch or snack time feels rushed, what do you do to stay calm?', '점심이나 간식 시간이 급하게 느껴질 때 침착하게 지내기 위해 무엇을 하나요?', '급하게 먹는 상황에서 하는 행동과 이유를 말해 보세요.'),
    ('prompt-routine-2054', 'How do you usually feel when you eat lunch or a snack, and why?', '점심이나 간식을 먹을 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '먹는 시간의 느낌과 그 이유를 말해 보세요.'),
    ('prompt-routine-2059', 'What small choice makes lunch or snack time better, and why?', '점심이나 간식 시간을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '음식, 장소, 순서 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2061', 'What do you do when you get home to settle in quickly?', '집에 돌아왔을 때 빠르게 안정되기 위해 무엇을 하나요?', '집에 오자마자 하는 행동과 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2065', 'When you feel rushed after coming home, what do you do first?', '집에 온 뒤 마음이 급할 때 무엇을 먼저 하나요?', '집에 온 직후의 첫 행동과 침착해지는 이유를 말해 보세요.'),
    ('prompt-routine-2068', 'How do you usually feel when you come home, and why?', '집에 돌아왔을 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '집에 들어온 순간의 느낌과 그 이유를 말해 보세요.'),
    ('prompt-routine-2074', 'What small choice makes coming home feel better, and why?', '집에 돌아오는 시간을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '집에 오며 하거나 준비하는 작은 선택과 이유를 말해 보세요.'),
    ('prompt-routine-2076', 'What do you prepare before small chores or kitchen tasks, and why?', '작은 집안일이나 주방 일을 하기 전에 무엇을 준비하나요? 이유도 말해 주세요.', '일을 시작하기 전에 준비하는 것과 도움이 되는 이유를 말해 보세요.'),
    ('prompt-routine-2080', 'When chores or kitchen tasks feel rushed, what do you do to stay calm?', '집안일이나 주방 일이 급하게 느껴질 때 침착하게 하려고 무엇을 하나요?', '급하게 느껴지는 상황에서 순서를 잡는 방법을 말해 보세요.'),
    ('prompt-routine-2083', 'How do you usually feel when you do small chores or kitchen tasks, and why?', '작은 집안일이나 주방 일을 할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '일을 할 때의 느낌과 그 이유를 구체적으로 말해 보세요.'),
    ('prompt-routine-2089', 'What small choice makes chores or kitchen tasks easier, and why?', '집안일이나 주방 일을 더 쉽게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '도구, 순서, 시간 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2092', 'What helps you rest more comfortably in the evening, and why?', '저녁에 더 편하게 쉬는 데 도움이 되는 것은 무엇인가요? 이유도 말해 주세요.', '저녁 휴식 상황에서 하는 행동과 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2096', 'When your evening feels rushed, what do you do to relax?', '저녁 시간이 급하게 느껴질 때 쉬기 위해 무엇을 하나요?', '바쁜 저녁에 긴장을 푸는 행동을 말해 보세요.'),
    ('prompt-routine-2099', 'How do you usually feel when you rest in the evening, and why?', '저녁에 쉴 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '저녁 휴식 중 느끼는 감정과 이유를 말해 보세요.'),
    ('prompt-routine-2105', 'What small choice makes your evening rest better, and why?', '저녁 휴식을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '저녁에 선택하는 행동이나 환경과 이유를 말해 보세요.'),
    ('prompt-routine-2109', 'What do you plan for a relaxed weekend at home, and why?', '집에서 편안한 주말을 보내기 위해 무엇을 계획하나요? 이유도 말해 주세요.', '주말 집에서 하는 활동과 그 활동을 고른 이유를 말해 보세요.'),
    ('prompt-routine-2113', 'When a weekend at home feels rushed, what do you do to slow down?', '집에서 보내는 주말이 급하게 느껴질 때 천천히 쉬기 위해 무엇을 하나요?', '주말에 속도를 늦추는 방법과 이유를 말해 보세요.'),
    ('prompt-routine-2116', 'How do you usually feel during a weekend at home, and why?', '집에서 주말을 보낼 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '주말 집에서의 느낌과 이유를 말해 보세요.'),
    ('prompt-routine-2121', 'What do you do to keep phone time simple, and why?', '휴대폰 사용 시간을 단순하게 유지하기 위해 무엇을 하나요? 이유도 말해 주세요.', '휴대폰을 쓸 때 복잡함을 줄이는 행동과 이유를 말해 보세요.'),
    ('prompt-routine-2125', 'When phone time feels rushed, what do you do to stay focused?', '휴대폰 사용 시간이 급하게 느껴질 때 집중하기 위해 무엇을 하나요?', '휴대폰을 급하게 볼 때 한 가지에 집중하는 방법을 말해 보세요.'),
    ('prompt-routine-2128', 'How do you usually feel when you use your phone, and why?', '휴대폰을 사용할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '휴대폰 사용 중 느끼는 감정과 그 이유를 말해 보세요.'),
    ('prompt-routine-2134', 'What small choice makes phone time better for you, and why?', '휴대폰 사용 시간을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '앱, 시간, 알림 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2401', 'What do you check when the weather changes, and why?', '날씨가 바뀔 때 무엇을 확인하나요? 이유도 말해 주세요.', '날씨 변화에 맞춰 확인하는 정보와 이유를 말해 보세요.'),
    ('prompt-routine-2405', 'When the weather changes suddenly, what do you do to stay calm?', '날씨가 갑자기 바뀔 때 침착하게 대처하려고 무엇을 하나요?', '갑작스러운 날씨 변화에서 하는 행동을 말해 보세요.'),
    ('prompt-routine-2407', 'How do you usually feel when the weather changes, and why?', '날씨가 바뀔 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '날씨가 바뀌었을 때의 느낌과 이유를 말해 보세요.'),
    ('prompt-routine-2412', 'What small choice helps you handle a weather change, and why?', '날씨 변화에 대처하는 데 도움이 되는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '옷, 일정, 준비물 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2416', 'What do you prepare before a quick errand, and why?', '간단한 볼일을 보러 가기 전에 무엇을 준비하나요? 이유도 말해 주세요.', '짧은 외출 전에 챙기는 것과 이유를 말해 보세요.'),
    ('prompt-routine-2419', 'When a quick errand feels rushed, what do you do first?', '간단한 볼일이 급하게 느껴질 때 무엇을 먼저 하나요?', '볼일을 보기 전 첫 행동과 침착해지는 이유를 말해 보세요.'),
    ('prompt-routine-2422', 'How do you usually feel when you run a quick errand, and why?', '간단한 볼일을 볼 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '볼일을 보는 동안의 느낌과 이유를 말해 보세요.'),
    ('prompt-routine-2426', 'What small choice makes a quick errand easier, and why?', '간단한 볼일을 더 쉽게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '동선, 준비물, 시간 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2431', 'What do you decide before visiting a cafe or bakery, and why?', '카페나 빵집에 가기 전에 무엇을 정하나요? 이유도 말해 주세요.', '가기 전에 정하는 것과 그 이유를 말해 보세요.'),
    ('prompt-routine-2434', 'When a cafe or bakery visit feels rushed, what do you do first?', '카페나 빵집 방문이 급하게 느껴질 때 무엇을 먼저 하나요?', '주문이나 자리 선택처럼 먼저 하는 행동을 말해 보세요.'),
    ('prompt-routine-2437', 'How do you usually feel when you visit a cafe or bakery, and why?', '카페나 빵집에 갈 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '방문할 때의 느낌과 이유를 말해 보세요.'),
    ('prompt-routine-2441', 'What small choice makes a cafe or bakery visit better, and why?', '카페나 빵집 방문을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '메뉴, 자리, 시간 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2446', 'What do you prepare before a walk or light exercise, and why?', '산책이나 가벼운 운동 전에 무엇을 준비하나요? 이유도 말해 주세요.', '나가기 전에 준비하는 것과 도움이 되는 이유를 말해 보세요.'),
    ('prompt-routine-2449', 'When a walk or light exercise feels rushed, what do you do to slow down?', '산책이나 가벼운 운동이 급하게 느껴질 때 천천히 하기 위해 무엇을 하나요?', '속도를 늦추는 행동과 이유를 말해 보세요.'),
    ('prompt-routine-2452', 'How do you usually feel during a walk or light exercise, and why?', '산책이나 가벼운 운동을 할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '걷거나 운동할 때의 느낌과 이유를 말해 보세요.'),
    ('prompt-routine-2457', 'What small choice makes a walk or light exercise better, and why?', '산책이나 가벼운 운동을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '길, 시간, 준비물 중 하나를 골라 이유를 말해 보세요.'),
    ('prompt-routine-2461', 'What do you do before bed to make your night routine easier?', '밤 루틴을 더 편하게 만들기 위해 자기 전에 무엇을 하나요?', '자기 전 하는 행동과 밤 시간이 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2464', 'When bedtime feels rushed, what do you do to calm down?', '잠자기 전 시간이 급하게 느껴질 때 진정하기 위해 무엇을 하나요?', '잠들기 전에 마음을 가라앉히는 행동을 말해 보세요.'),
    ('prompt-routine-2467', 'How do you usually feel when you get ready for bed, and why?', '잠자기 위해 준비할 때 보통 어떤 기분이 드나요? 이유도 말해 주세요.', '잠들기 전 준비하면서 느끼는 감정과 이유를 말해 보세요.'),
    ('prompt-routine-2472', 'What small choice makes your bedtime routine better, and why?', '잠자기 전 루틴을 더 좋게 만드는 작은 선택은 무엇인가요? 이유도 말해 주세요.', '자기 전 선택하는 행동이나 환경과 이유를 말해 보세요.');

UPDATE prompts p
JOIN prompt_routine_focus_reframes r ON r.id = p.id
SET p.question_en = r.question_en,
    p.question_ko = r.question_ko,
    p.tip = r.tip;

DROP TEMPORARY TABLE prompt_routine_focus_reframes;

COMMIT;

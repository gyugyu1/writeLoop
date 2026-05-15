-- Refine awkward routine/preference prompts into direct beginner-friendly questions.
-- The goal is to make each card easy to answer with one action, one object, or one reason.

START TRANSACTION;

CREATE TEMPORARY TABLE prompt_routine_natural_reframes (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    question_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    question_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    tip TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_routine_natural_reframes (id, question_en, question_ko, tip) VALUES
    ('prompt-preference-2231', 'What do you use first when you start studying, and why?', '공부를 시작할 때 가장 먼저 무엇을 사용하나요? 이유도 말해 주세요.', '공부를 시작하는 순간에 쓰는 도구와 그 도구가 도움이 되는 이유를 말해 보세요.'),
    ('prompt-preference-2240', 'What do you bring when you study outside your home, and why?', '집 밖에서 공부할 때 무엇을 챙기나요? 이유도 말해 주세요.', '집 밖에서 공부하는 장면에 맞춰 챙기는 물건과 이유를 말해 보세요.'),
    ('prompt-preference-2242', 'What do you change on your desk when you study with a computer?', '컴퓨터로 공부할 때 책상 위에서 무엇을 바꾸나요?', '컴퓨터로 공부하는 상황에서 책상 배치나 도구를 어떻게 바꾸는지 말해 보세요.'),
    ('prompt-preference-2536', 'What do you use to clean your desk before studying?', '공부하기 전에 책상을 정리할 때 무엇을 사용하나요?', '공부 전 책상 정리 상황에서 사용하는 것과 이유를 말해 보세요.'),
    ('prompt-routine-2011', 'What is one thing you do in the morning that helps you feel ready, and why?', '아침에 준비된 느낌을 주는 행동 하나는 무엇인가요? 이유도 말해 주세요.', '아침에 실제로 하는 행동 하나와 그 행동이 도움이 되는 이유를 말해 보세요.'),
    ('prompt-routine-2028', 'What do you bring when you go somewhere, and why is it helpful?', '어딘가로 갈 때 무엇을 챙기나요? 그것이 왜 도움이 되나요?', '이동 전에 챙기는 물건 하나와 이동이 쉬워지는 이유를 말해 보세요.'),
    ('prompt-routine-2059', 'What do you choose for lunch or a snack, and why do you like it?', '점심이나 간식으로 무엇을 고르나요? 왜 좋아하나요?', '음식 이름과 그때 먹기 좋은 이유를 함께 말해 보세요.'),
    ('prompt-routine-2074', 'What do you do first when you get home, and why?', '집에 돌아오면 무엇을 먼저 하나요? 이유도 말해 주세요.', '집에 온 뒤 첫 행동과 그 행동이 편안하게 느껴지는 이유를 말해 보세요.'),
    ('prompt-routine-2089', 'What tool do you use for chores or kitchen tasks, and why?', '집안일이나 주방 일을 할 때 어떤 도구를 사용하나요? 이유도 말해 주세요.', '자주 쓰는 도구 하나와 실제로 일이 쉬워지는 이유를 말해 보세요.'),
    ('prompt-routine-2105', 'What do you do in the evening to relax, and why?', '저녁에 쉬기 위해 무엇을 하나요? 이유도 말해 주세요.', '저녁에 하는 행동 하나와 편해지는 이유를 말해 보세요.'),
    ('prompt-routine-2134', 'How do you use your phone in a helpful way, and why?', '휴대폰을 도움이 되게 사용하려면 어떻게 하나요? 이유도 말해 주세요.', '앱, 알림, 사용 시간 중 하나를 골라 도움이 되는 이유를 말해 보세요.'),
    ('prompt-routine-2412', 'What do you bring when the weather changes, and why?', '날씨가 바뀔 때 무엇을 챙기나요? 이유도 말해 주세요.', '날씨 변화에 대비해 챙기는 물건과 필요한 이유를 말해 보세요.'),
    ('prompt-routine-2426', 'What do you prepare before a quick errand, and why?', '간단한 볼일을 보기 전에 무엇을 준비하나요? 이유도 말해 주세요.', '짧은 외출 전에 준비하는 것과 볼일이 쉬워지는 이유를 말해 보세요.'),
    ('prompt-routine-2431', 'Do you decide what to order before you go to a cafe or bakery? Why?', '카페나 빵집에 가기 전에 무엇을 주문할지 미리 정하나요? 이유도 말해 주세요.', '미리 정하는지 아닌지와 그 이유를 간단히 말해 보세요.'),
    ('prompt-routine-2434', 'When a cafe or bakery is busy, what do you do first?', '카페나 빵집이 붐빌 때 무엇을 먼저 하나요?', '붐비는 상황에서 먼저 하는 행동을 한 가지 말해 보세요.'),
    ('prompt-routine-2441', 'What do you usually order at a cafe or bakery, and why do you like it?', '카페나 빵집에서 보통 무엇을 주문하나요? 왜 좋아하나요?', '메뉴 하나와 그 메뉴를 자주 고르는 이유를 말해 보세요.'),
    ('prompt-routine-2457', 'What do you bring or wear for a walk, and why?', '산책할 때 무엇을 챙기거나 입나요? 이유도 말해 주세요.', '산책할 때 챙기는 물건이나 옷과 그 이유를 말해 보세요.'),
    ('prompt-routine-2472', 'What do you do before bed to sleep better, and why?', '잠을 더 잘 자기 위해 자기 전에 무엇을 하나요? 이유도 말해 주세요.', '자기 전 행동 하나와 잠드는 데 도움이 되는 이유를 말해 보세요.');

UPDATE prompts p
JOIN prompt_routine_natural_reframes r ON r.id = p.id
SET p.question_en = r.question_en,
    p.question_ko = r.question_ko,
    p.tip = r.tip;

DROP TEMPORARY TABLE prompt_routine_natural_reframes;

COMMIT;

-- Broaden repetitive stationery prompt wording so questions ask about study/work situations,
-- not tiny item preferences repeated with only one noun changed.

START TRANSACTION;

CREATE TEMPORARY TABLE prompt_study_tool_reframes (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    question_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    question_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    tip TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_study_tool_reframes (id, question_en, question_ko, tip) VALUES
    ('prompt-preference-2231', 'What study or work tool helps you get started smoothly, and why?', '공부나 일을 부드럽게 시작하는 데 도움이 되는 도구는 무엇인가요? 이유도 말해 주세요.', '도구 이름만 말하지 말고, 시작할 때 어떤 점이 편해지는지 함께 말해 보세요.'),
    ('prompt-preference-2232', 'When you make mistakes while studying or working, what helps you fix them without losing focus?', '공부나 일을 하다가 실수했을 때, 집중을 잃지 않고 고치는 데 도움이 되는 것은 무엇인가요?', '실수하는 상황과 다시 집중하는 방법을 함께 말해 보세요.'),
    ('prompt-preference-2233', 'How do you usually mark important information when you study or work, and why does that method help?', '공부나 일을 할 때 중요한 내용을 보통 어떻게 표시하나요? 그 방법이 왜 도움이 되나요?', '표시하는 방법과 그 방법이 기억이나 정리에 주는 도움을 함께 말해 보세요.'),
    ('prompt-preference-2234', 'What helps you remember small tasks during study or work, and when do you use it?', '공부나 일을 할 때 작은 할 일을 기억하는 데 도움이 되는 것은 무엇인가요? 언제 사용하나요?', '무엇을 기억해야 하는지와 그것을 쓰는 상황을 함께 말해 보세요.'),
    ('prompt-preference-2235', 'How do you plan your study or work time on a busy day?', '바쁜 날에는 공부나 일할 시간을 어떻게 계획하나요?', '계획하는 방법을 한두 단계로 말하고, 그 방식이 왜 편한지도 덧붙여 보세요.'),
    ('prompt-preference-2236', 'What helps you pause and return to a study task without losing your place?', '공부하다가 잠깐 멈춘 뒤 다시 이어갈 때, 흐름을 잃지 않게 도와주는 것은 무엇인가요?', '잠깐 멈추는 상황과 다시 돌아올 때 도움이 되는 점을 함께 말해 보세요.'),
    ('prompt-preference-2237', 'What helps keep your study or work space organized, and why does it matter?', '공부나 일하는 공간을 정리된 상태로 유지하는 데 도움이 되는 것은 무엇인가요? 왜 중요한가요?', '공간이 정리되면 어떤 점이 좋아지는지 구체적으로 말해 보세요.'),
    ('prompt-preference-2238', 'When accuracy matters in a study or work task, what tool or habit helps you?', '공부나 일에서 정확함이 중요할 때, 어떤 도구나 습관이 도움이 되나요?', '정확함이 필요한 상황과 도움이 되는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2239', 'How do you keep school or work papers easy to find?', '학교나 일 관련 자료를 찾기 쉽게 보관하려면 어떻게 하나요?', '정리 방법과 나중에 찾을 때 편한 이유를 함께 말해 보세요.'),
    ('prompt-preference-2240', 'What do you like to carry so study or work feels easier outside home?', '집 밖에서 공부하거나 일할 때 더 편하게 느껴지도록 무엇을 챙기나요?', '어디에서 쓰는지와 챙기면 편한 이유를 함께 말해 보세요.'),
    ('prompt-preference-2241', 'What helps you write or type more comfortably during study or work?', '공부나 일을 할 때 더 편하게 쓰거나 타이핑하는 데 도움이 되는 것은 무엇인가요?', '편하게 쓰거나 타이핑할 수 있는 상황을 떠올려 이유와 함께 말해 보세요.'),
    ('prompt-preference-2242', 'What setup helps you use a computer more comfortably for study or work?', '공부나 일을 위해 컴퓨터를 쓸 때 더 편하게 만드는 환경은 무엇인가요?', '컴퓨터를 쓰는 상황과 편해지는 이유를 함께 말해 보세요.'),
    ('prompt-preference-2243', 'How do you manage short study or work sessions so you can stay focused?', '짧은 공부나 업무 시간을 집중해서 보내기 위해 어떻게 관리하나요?', '시간을 나누거나 집중을 유지하는 방법을 간단히 말해 보세요.');

UPDATE prompts p
JOIN prompt_study_tool_reframes r ON r.id = p.id
SET p.question_en = r.question_en,
    p.question_ko = r.question_ko,
    p.tip = r.tip;

CREATE TEMPORARY TABLE prompt_study_tool_hint_reframes (
    id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    content TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    meaning_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    usage_tip_ko TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    example_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO prompt_study_tool_hint_reframes (id, content, meaning_ko, usage_tip_ko, example_en) VALUES
    ('hint-preference-2231-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2232-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2233-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2234-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2235-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2236-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2237-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2238-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2239-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2240-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2241-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2242-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.'),
    ('hint-preference-2243-1-item-1', 'It helps me ... when ... because ...', '도움이 되는 상황과 이유를 자연스럽게 이어 말하는 시작 문장', '작은 물건 이름보다 어떤 상황에서 집중이나 정리에 도움이 되는지를 먼저 떠올려 보세요.', 'It helps me stay focused when I have many small tasks because I can see what to do next.');

UPDATE prompt_hint_items h
JOIN prompt_study_tool_hint_reframes r ON r.id = h.id
SET h.content = r.content,
    h.meaning_ko = r.meaning_ko,
    h.usage_tip_ko = r.usage_tip_ko,
    h.example_en = r.example_en;

DROP TEMPORARY TABLE prompt_study_tool_hint_reframes;
DROP TEMPORARY TABLE prompt_study_tool_reframes;

COMMIT;

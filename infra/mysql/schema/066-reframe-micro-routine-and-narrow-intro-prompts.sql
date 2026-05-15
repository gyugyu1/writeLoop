-- Reframe micro-routine and narrow intro prompts into experience-based questions.
-- Purpose: remove tiny before/after/while action prompts and object-picking prompts that do not invite personal answers.
-- Generated from active prompt audit on 2026-05-10. Rewritten with UTF-8-safe Korean text on 2026-05-11.

START TRANSACTION;

-- prompt-preference-1101
UPDATE prompts
SET question_en = 'What breakfast would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1101';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1101-1-item-1';

-- prompt-preference-1102
UPDATE prompts
SET question_en = 'What summer fruit would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1102';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1102-1-item-1';

-- prompt-preference-1103
UPDATE prompts
SET question_en = 'What rainy-day drink would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1103';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1103-1-item-1';

-- prompt-preference-1104
UPDATE prompts
SET question_en = 'What phone case would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1104';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1104-1-item-1';

-- prompt-preference-1105
UPDATE prompts
SET question_en = 'What notebook would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1105';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1105-1-item-1';

-- prompt-preference-1107
UPDATE prompts
SET question_en = 'What kind of soup would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1107';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1107-1-item-1';

-- prompt-preference-1108
UPDATE prompts
SET question_en = 'What type of bag would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1108';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1108-1-item-1';

-- prompt-preference-1109
UPDATE prompts
SET question_en = 'What board game would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1109';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1109-1-item-1';

-- prompt-preference-1111
UPDATE prompts
SET question_en = 'What flower scent would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1111';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1111-1-item-1';

-- prompt-preference-1112
UPDATE prompts
SET question_en = 'What seat on the bus would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1112';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1112-1-item-1';

-- prompt-preference-1114
UPDATE prompts
SET question_en = 'What type of sandwich would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1114';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1114-1-item-1';

-- prompt-preference-1115
UPDATE prompts
SET question_en = 'What kitchen tool would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1115';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1115-1-item-1';

-- prompt-preference-1117
UPDATE prompts
SET question_en = 'What online creator would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1117';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1117-1-item-1';

-- prompt-preference-1118
UPDATE prompts
SET question_en = 'What snack for work or study breaks would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1118';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1118-1-item-1';

-- prompt-preference-1119
UPDATE prompts
SET question_en = 'What type of pen would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1119';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1119-1-item-1';

-- prompt-preference-1120
UPDATE prompts
SET question_en = 'What bakery item would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1120';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1120-1-item-1';

-- prompt-preference-1121
UPDATE prompts
SET question_en = 'What movie snack would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1121';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1121-1-item-1';

-- prompt-preference-1122
UPDATE prompts
SET question_en = 'What travel souvenir would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1122';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1122-1-item-1';

-- prompt-preference-1123
UPDATE prompts
SET question_en = 'What candle scent would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1123';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1123-1-item-1';

-- prompt-preference-1125
UPDATE prompts
SET question_en = 'What kind of tea would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1125';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1125-1-item-1';

-- prompt-preference-1126
UPDATE prompts
SET question_en = 'What light jacket would you choose in daily life, and why would it fit that moment?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-1126';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-1126-1-item-1';

-- prompt-routine-2002
UPDATE prompts
SET question_en = 'What helps things feel smoother when you get ready in the morning, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2002';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2002-1-item-1';

-- prompt-routine-2003
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you get ready in the morning.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2003';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2003-1-item-1';

-- prompt-routine-2004
UPDATE prompts
SET question_en = 'What do you like to keep simple when you get ready in the morning, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2004';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2004-1-item-1';

-- prompt-routine-2005
UPDATE prompts
SET question_en = 'When you feel rushed when you get ready in the morning, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2005';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2005-1-item-1';

-- prompt-routine-2006
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for your morning routine, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2006';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2006-1-item-1';

-- prompt-routine-2007
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you get ready in the morning?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2007';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2007-1-item-1';

-- prompt-routine-2008
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about your morning routine?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2008';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2008-1-item-1';

-- prompt-routine-2009
UPDATE prompts
SET question_en = 'What makes your morning routine feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2009';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2009-1-item-1';

-- prompt-routine-2010
UPDATE prompts
SET question_en = 'Tell me about a recent time when your morning routine went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2010';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2010-1-item-1';

-- prompt-routine-2011
UPDATE prompts
SET question_en = 'What small choice affects your mood when you get ready in the morning?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2011';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2011-1-item-1';

-- prompt-routine-2012
UPDATE prompts
SET question_en = 'What do you usually do first when you get ready in the morning, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2012';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2012-1-item-1';

-- prompt-routine-2013
UPDATE prompts
SET question_en = 'What do you usually do last to finish your morning routine neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2013';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2013-1-item-1';

-- prompt-routine-2014
UPDATE prompts
SET question_en = 'What do you try to avoid when you get ready in the morning, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2014';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2014-1-item-1';

-- prompt-routine-2015
UPDATE prompts
SET question_en = 'How does your routine change when your morning routine does not go as planned?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2015';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2015-1-item-1';

-- prompt-routine-2016
UPDATE prompts
SET question_en = 'What helps things feel smoother when you move from one place to another, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2016';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2016-1-item-1';

-- prompt-routine-2017
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you move from one place to another.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2017';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2017-1-item-1';

-- prompt-routine-2019
UPDATE prompts
SET question_en = 'What do you like to keep simple when you move from one place to another, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2019';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2019-1-item-1';

-- prompt-routine-2020
UPDATE prompts
SET question_en = 'When you feel rushed when you move from one place to another, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2020';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2020-1-item-1';

-- prompt-routine-2021
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for your commute, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2021';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2021-1-item-1';

-- prompt-routine-2022
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you move from one place to another?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2022';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2022-1-item-1';

-- prompt-routine-2024
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about your commute?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2024';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2024-1-item-1';

-- prompt-routine-2025
UPDATE prompts
SET question_en = 'What makes your commute feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2025';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2025-1-item-1';

-- prompt-routine-2026
UPDATE prompts
SET question_en = 'Tell me about a recent time when your commute went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2026';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2026-1-item-1';

-- prompt-routine-2028
UPDATE prompts
SET question_en = 'What small choice affects your mood when you move from one place to another?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2028';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2028-1-item-1';

-- prompt-routine-2029
UPDATE prompts
SET question_en = 'What do you usually do first when you move from one place to another, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2029';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2029-1-item-1';

-- prompt-routine-2030
UPDATE prompts
SET question_en = 'What do you usually do last to finish your commute neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2030';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2030-1-item-1';

-- prompt-routine-2032
UPDATE prompts
SET question_en = 'What helps things feel smoother when you take a short break, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2032';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2032-1-item-1';

-- prompt-routine-2033
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you take a short break.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2033';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2033-1-item-1';

-- prompt-routine-2034
UPDATE prompts
SET question_en = 'What do you like to keep simple when you take a short break, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2034';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2034-1-item-1';

-- prompt-routine-2036
UPDATE prompts
SET question_en = 'When you feel rushed when you take a short break, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2036';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2036-1-item-1';

-- prompt-routine-2037
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for a short break, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2037';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2037-1-item-1';

-- prompt-routine-2039
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you take a short break?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2039';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2039-1-item-1';

-- prompt-routine-2041
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about a short break?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2041';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2041-1-item-1';

-- prompt-routine-2043
UPDATE prompts
SET question_en = 'What makes a short break feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2043';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2043-1-item-1';

-- prompt-routine-2045
UPDATE prompts
SET question_en = 'Tell me about a recent time when a short break went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2045';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2045-1-item-1';

-- prompt-routine-2046
UPDATE prompts
SET question_en = 'What helps things feel smoother when you eat lunch or a snack, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2046';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2046-1-item-1';

-- prompt-routine-2049
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you eat lunch or a snack.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2049';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2049-1-item-1';

-- prompt-routine-2050
UPDATE prompts
SET question_en = 'What do you like to keep simple when you eat lunch or a snack, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2050';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2050-1-item-1';

-- prompt-routine-2051
UPDATE prompts
SET question_en = 'When you feel rushed when you eat lunch or a snack, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2051';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2051-1-item-1';

-- prompt-routine-2052
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for lunch or snack time, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2052';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2052-1-item-1';

-- prompt-routine-2054
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you eat lunch or a snack?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2054';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2054-1-item-1';

-- prompt-routine-2055
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about lunch or snack time?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2055';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2055-1-item-1';

-- prompt-routine-2057
UPDATE prompts
SET question_en = 'What makes lunch or snack time feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2057';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2057-1-item-1';

-- prompt-routine-2058
UPDATE prompts
SET question_en = 'Tell me about a recent time when lunch or snack time went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2058';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2058-1-item-1';

-- prompt-routine-2059
UPDATE prompts
SET question_en = 'What small choice affects your mood when you eat lunch or a snack?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2059';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2059-1-item-1';

-- prompt-routine-2061
UPDATE prompts
SET question_en = 'What helps things feel smoother when you come home, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2061';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2061-1-item-1';

-- prompt-routine-2062
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you come home.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2062';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2062-1-item-1';

-- prompt-routine-2064
UPDATE prompts
SET question_en = 'What do you like to keep simple when you come home, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2064';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2064-1-item-1';

-- prompt-routine-2065
UPDATE prompts
SET question_en = 'When you feel rushed when you come home, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2065';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2065-1-item-1';

-- prompt-routine-2066
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for your coming-home routine, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2066';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2066-1-item-1';

-- prompt-routine-2068
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you come home?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2068';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2068-1-item-1';

-- prompt-routine-2069
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about your coming-home routine?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2069';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2069-1-item-1';

-- prompt-routine-2071
UPDATE prompts
SET question_en = 'What makes your coming-home routine feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2071';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2071-1-item-1';

-- prompt-routine-2072
UPDATE prompts
SET question_en = 'Tell me about a recent time when your coming-home routine went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2072';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2072-1-item-1';

-- prompt-routine-2074
UPDATE prompts
SET question_en = 'What small choice affects your mood when you come home?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2074';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2074-1-item-1';

-- prompt-routine-2075
UPDATE prompts
SET question_en = 'What do you usually do first when you come home, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2075';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2075-1-item-1';

-- prompt-routine-2076
UPDATE prompts
SET question_en = 'What helps things feel smoother when you do small chores or kitchen tasks, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2076';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2076-1-item-1';

-- prompt-routine-2077
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you do small chores or kitchen tasks.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2077';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2077-1-item-1';

-- prompt-routine-2079
UPDATE prompts
SET question_en = 'What do you like to keep simple when you do small chores or kitchen tasks, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2079';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2079-1-item-1';

-- prompt-routine-2080
UPDATE prompts
SET question_en = 'When you feel rushed when you do small chores or kitchen tasks, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2080';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2080-1-item-1';

-- prompt-routine-2082
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for small chores or kitchen tasks, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2082';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2082-1-item-1';

-- prompt-routine-2083
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you do small chores or kitchen tasks?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2083';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2083-1-item-1';

-- prompt-routine-2085
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about small chores or kitchen tasks?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2085';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2085-1-item-1';

-- prompt-routine-2086
UPDATE prompts
SET question_en = 'What makes small chores or kitchen tasks feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2086';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2086-1-item-1';

-- prompt-routine-2087
UPDATE prompts
SET question_en = 'Tell me about a recent time when small chores or kitchen tasks went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2087';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2087-1-item-1';

-- prompt-routine-2089
UPDATE prompts
SET question_en = 'What small choice affects your mood when you do small chores or kitchen tasks?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2089';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2089-1-item-1';

-- prompt-routine-2090
UPDATE prompts
SET question_en = 'What do you usually do first when you do small chores or kitchen tasks, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2090';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2090-1-item-1';

-- prompt-routine-2092
UPDATE prompts
SET question_en = 'What helps things feel smoother when you rest in the evening, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2092';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2092-1-item-1';

-- prompt-routine-2093
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you rest in the evening.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2093';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2093-1-item-1';

-- prompt-routine-2095
UPDATE prompts
SET question_en = 'What do you like to keep simple when you rest in the evening, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2095';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2095-1-item-1';

-- prompt-routine-2096
UPDATE prompts
SET question_en = 'When you feel rushed when you rest in the evening, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2096';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2096-1-item-1';

-- prompt-routine-2098
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for your evening rest, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2098';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2098-1-item-1';

-- prompt-routine-2099
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you rest in the evening?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2099';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2099-1-item-1';

-- prompt-routine-2101
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about your evening rest?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2101';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2101-1-item-1';

-- prompt-routine-2102
UPDATE prompts
SET question_en = 'What makes your evening rest feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2102';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2102-1-item-1';

-- prompt-routine-2104
UPDATE prompts
SET question_en = 'Tell me about a recent time when your evening rest went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2104';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2104-1-item-1';

-- prompt-routine-2105
UPDATE prompts
SET question_en = 'What small choice affects your mood when you rest in the evening?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2105';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2105-1-item-1';

-- prompt-routine-2109
UPDATE prompts
SET question_en = 'What helps things feel smoother when you spend time at home on the weekend, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2109';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2109-1-item-1';

-- prompt-routine-2110
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you spend time at home on the weekend.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2110';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2110-1-item-1';

-- prompt-routine-2112
UPDATE prompts
SET question_en = 'What do you like to keep simple when you spend time at home on the weekend, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2112';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2112-1-item-1';

-- prompt-routine-2113
UPDATE prompts
SET question_en = 'When you feel rushed when you spend time at home on the weekend, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2113';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2113-1-item-1';

-- prompt-routine-2115
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for a weekend at home, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2115';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2115-1-item-1';

-- prompt-routine-2116
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you spend time at home on the weekend?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2116';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2116-1-item-1';

-- prompt-routine-2118
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about a weekend at home?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2118';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2118-1-item-1';

-- prompt-routine-2119
UPDATE prompts
SET question_en = 'What makes a weekend at home feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2119';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2119-1-item-1';

-- prompt-routine-2121
UPDATE prompts
SET question_en = 'What helps things feel smoother when you use your phone, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2121';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2121-1-item-1';

-- prompt-routine-2122
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you use your phone.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2122';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2122-1-item-1';

-- prompt-routine-2124
UPDATE prompts
SET question_en = 'What do you like to keep simple when you use your phone, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2124';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2124-1-item-1';

-- prompt-routine-2125
UPDATE prompts
SET question_en = 'When you feel rushed when you use your phone, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2125';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2125-1-item-1';

-- prompt-routine-2127
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for your phone habits, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2127';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2127-1-item-1';

-- prompt-routine-2128
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you use your phone?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2128';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2128-1-item-1';

-- prompt-routine-2130
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about your phone habits?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2130';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2130-1-item-1';

-- prompt-routine-2131
UPDATE prompts
SET question_en = 'What makes your phone habits feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2131';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2131-1-item-1';

-- prompt-routine-2133
UPDATE prompts
SET question_en = 'Tell me about a recent time when your phone habits went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2133';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2133-1-item-1';

-- prompt-routine-2134
UPDATE prompts
SET question_en = 'What small choice affects your mood when you use your phone?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2134';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2134-1-item-1';

-- prompt-preference-2201
UPDATE prompts
SET question_en = 'What kind of bread for breakfast would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2201';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2201-1-item-1';

-- prompt-preference-2202
UPDATE prompts
SET question_en = 'What fried eggs would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2202';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2202-1-item-1';

-- prompt-preference-2204
UPDATE prompts
SET question_en = 'What yogurt topping would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2204';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2204-1-item-1';

-- prompt-preference-2205
UPDATE prompts
SET question_en = 'What type of cereal would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2205';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2205-1-item-1';

-- prompt-preference-2206
UPDATE prompts
SET question_en = 'What jam flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2206';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2206-1-item-1';

-- prompt-preference-2207
UPDATE prompts
SET question_en = 'What toast topping would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2207';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2207-1-item-1';

-- prompt-preference-2208
UPDATE prompts
SET question_en = 'What simple noodle dish would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2208';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2208-1-item-1';

-- prompt-preference-2213
UPDATE prompts
SET question_en = 'What rice bowl topping would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2213';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2213-1-item-1';

-- prompt-preference-2214
UPDATE prompts
SET question_en = 'What porridge for a quiet morning would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2214';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2214-1-item-1';

-- prompt-preference-2215
UPDATE prompts
SET question_en = 'What quick meal for a late morning would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2215';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2215-1-item-1';

-- prompt-preference-2216
UPDATE prompts
SET question_en = 'What cookie flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2216';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2216-1-item-1';

-- prompt-preference-2217
UPDATE prompts
SET question_en = 'What chip flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2217';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2217-1-item-1';

-- prompt-preference-2218
UPDATE prompts
SET question_en = 'What ice cream flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2218';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2218-1-item-1';

-- prompt-preference-2219
UPDATE prompts
SET question_en = 'What kind of chocolate bar would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2219';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2219-1-item-1';

-- prompt-preference-2220
UPDATE prompts
SET question_en = 'What candy flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2220';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2220-1-item-1';

-- prompt-preference-2221
UPDATE prompts
SET question_en = 'What snack from a convenience store would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2221';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2221-1-item-1';

-- prompt-preference-2222
UPDATE prompts
SET question_en = 'What type of cracker would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2222';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2222-1-item-1';

-- prompt-preference-2223
UPDATE prompts
SET question_en = 'What popcorn flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2223';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2223-1-item-1';

-- prompt-preference-2225
UPDATE prompts
SET question_en = 'What yogurt drink flavor would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2225';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2225-1-item-1';

-- prompt-preference-2226
UPDATE prompts
SET question_en = 'What fruit candy would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2226';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2226-1-item-1';

-- prompt-preference-2227
UPDATE prompts
SET question_en = 'What late-night snack would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2227';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2227-1-item-1';

-- prompt-preference-2228
UPDATE prompts
SET question_en = 'What salty snack would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2228';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2228-1-item-1';

-- prompt-preference-2229
UPDATE prompts
SET question_en = 'What snack with a soft texture would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2229';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2229-1-item-1';

-- prompt-preference-2230
UPDATE prompts
SET question_en = 'What small treat after a long day would you choose for a real moment in your day, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2230';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2230-1-item-1';

-- prompt-preference-2231
UPDATE prompts
SET question_en = 'What type of pencil would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2231';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2231-1-item-1';

-- prompt-preference-2232
UPDATE prompts
SET question_en = 'What kind of eraser would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2232';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2232-1-item-1';

-- prompt-preference-2233
UPDATE prompts
SET question_en = 'What highlighter color would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2233';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2233-1-item-1';

-- prompt-preference-2234
UPDATE prompts
SET question_en = 'What sticky note shape would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2234';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2234-1-item-1';

-- prompt-preference-2235
UPDATE prompts
SET question_en = 'What planner layout would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2235';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2235-1-item-1';

-- prompt-preference-2236
UPDATE prompts
SET question_en = 'What bookmark would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2236';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2236-1-item-1';

-- prompt-preference-2237
UPDATE prompts
SET question_en = 'What desk organizer would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2237';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2237-1-item-1';

-- prompt-preference-2238
UPDATE prompts
SET question_en = 'What type of ruler would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2238';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2238-1-item-1';

-- prompt-preference-2239
UPDATE prompts
SET question_en = 'What file folder color would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2239';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2239-1-item-1';

-- prompt-preference-2240
UPDATE prompts
SET question_en = 'What small pouch for school or work would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2240';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2240-1-item-1';

-- prompt-preference-2241
UPDATE prompts
SET question_en = 'What keyboard would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2241';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2241-1-item-1';

-- prompt-preference-2242
UPDATE prompts
SET question_en = 'What mouse shape would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2242';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2242-1-item-1';

-- prompt-preference-2243
UPDATE prompts
SET question_en = 'What desk timer would help you study or work better, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2243';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2243-1-item-1';

-- prompt-preference-2246
UPDATE prompts
SET question_en = 'What T-shirt color would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2246';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2246-1-item-1';

-- prompt-preference-2247
UPDATE prompts
SET question_en = 'What hoodie would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2247';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2247-1-item-1';

-- prompt-preference-2248
UPDATE prompts
SET question_en = 'What sock pattern would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2248';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2248-1-item-1';

-- prompt-preference-2249
UPDATE prompts
SET question_en = 'What pair of sneakers for daily use would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2249';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2249-1-item-1';

-- prompt-preference-2250
UPDATE prompts
SET question_en = 'What hat for sunny days would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2250';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2250-1-item-1';

-- prompt-preference-2251
UPDATE prompts
SET question_en = 'What scarf for winter would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2251';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2251-1-item-1';

-- prompt-preference-2252
UPDATE prompts
SET question_en = 'What watch strap color would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2252';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2252-1-item-1';

-- prompt-preference-2253
UPDATE prompts
SET question_en = 'What pair of room slippers would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2253';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2253-1-item-1';

-- prompt-preference-2254
UPDATE prompts
SET question_en = 'What raincoat would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2254';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2254-1-item-1';

-- prompt-preference-2255
UPDATE prompts
SET question_en = 'What pajama pattern would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2255';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2255-1-item-1';

-- prompt-preference-2256
UPDATE prompts
SET question_en = 'What hair tie color would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2256';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2256-1-item-1';

-- prompt-preference-2257
UPDATE prompts
SET question_en = 'What umbrella would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2257';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2257-1-item-1';

-- prompt-preference-2258
UPDATE prompts
SET question_en = 'What everyday jacket material would you choose for a real situation, and why would it feel useful?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2258';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2258-1-item-1';

-- prompt-preference-2261
UPDATE prompts
SET question_en = 'What blanket at home would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2261';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2261-1-item-1';

-- prompt-preference-2262
UPDATE prompts
SET question_en = 'What pillow would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2262';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2262-1-item-1';

-- prompt-preference-2263
UPDATE prompts
SET question_en = 'What mug would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2263';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2263-1-item-1';

-- prompt-preference-2265
UPDATE prompts
SET question_en = 'What lamp in your room would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2265';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2265-1-item-1';

-- prompt-preference-2266
UPDATE prompts
SET question_en = 'What water bottle would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2266';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2266-1-item-1';

-- prompt-preference-2267
UPDATE prompts
SET question_en = 'What desk mat would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2267';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2267-1-item-1';

-- prompt-preference-2268
UPDATE prompts
SET question_en = 'What chair cushion would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2268';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2268-1-item-1';

-- prompt-preference-2269
UPDATE prompts
SET question_en = 'What wall calendar design would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2269';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2269-1-item-1';

-- prompt-preference-2270
UPDATE prompts
SET question_en = 'What small fan for your room would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2270';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2270-1-item-1';

-- prompt-preference-2272
UPDATE prompts
SET question_en = 'What storage basket would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2272';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2272-1-item-1';

-- prompt-preference-2274
UPDATE prompts
SET question_en = 'What small item that helps your room feel relaxing would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2274';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2274-1-item-1';

-- prompt-preference-2275
UPDATE prompts
SET question_en = 'What small thing near your bed would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2275';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2275-1-item-1';

-- prompt-preference-2276
UPDATE prompts
SET question_en = 'What hand cream scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2276';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2276-1-item-1';

-- prompt-preference-2277
UPDATE prompts
SET question_en = 'What soap scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2277';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2277-1-item-1';

-- prompt-preference-2278
UPDATE prompts
SET question_en = 'What shampoo scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2278';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2278-1-item-1';

-- prompt-preference-2279
UPDATE prompts
SET question_en = 'What lip balm flavor or scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2279';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2279-1-item-1';

-- prompt-preference-2280
UPDATE prompts
SET question_en = 'What body wash scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2280';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2280-1-item-1';

-- prompt-preference-2281
UPDATE prompts
SET question_en = 'What lotion texture would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2281';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2281-1-item-1';

-- prompt-preference-2282
UPDATE prompts
SET question_en = 'What scent of freshly washed towels would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2282';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2282-1-item-1';

-- prompt-preference-2283
UPDATE prompts
SET question_en = 'What scent for bath salts would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2283';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2283-1-item-1';

-- prompt-preference-2284
UPDATE prompts
SET question_en = 'What sunscreen would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2284';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2284-1-item-1';

-- prompt-preference-2285
UPDATE prompts
SET question_en = 'What type of sheet mask would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2285';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2285-1-item-1';

-- prompt-preference-2286
UPDATE prompts
SET question_en = 'What toothpaste flavor would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2286';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2286-1-item-1';

-- prompt-preference-2287
UPDATE prompts
SET question_en = 'What room spray scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2287';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2287-1-item-1';

-- prompt-preference-2288
UPDATE prompts
SET question_en = 'What hair oil scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2288';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2288-1-item-1';

-- prompt-preference-2289
UPDATE prompts
SET question_en = 'What laundry detergent scent would you use in your daily routine, and what feeling would you want from it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2289';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2289-1-item-1';

-- prompt-preference-2291
UPDATE prompts
SET question_en = 'What phone wallpaper would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2291';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2291-1-item-1';

-- prompt-preference-2292
UPDATE prompts
SET question_en = 'What alarm sound would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2292';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2292-1-item-1';

-- prompt-preference-2293
UPDATE prompts
SET question_en = 'What calendar view would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2293';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2293-1-item-1';

-- prompt-preference-2294
UPDATE prompts
SET question_en = 'What quick note feature would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2294';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2294-1-item-1';

-- prompt-preference-2295
UPDATE prompts
SET question_en = 'What messaging sticker would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2295';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2295-1-item-1';

-- prompt-preference-2296
UPDATE prompts
SET question_en = 'What music queue feature would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2296';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2296-1-item-1';

-- prompt-preference-2297
UPDATE prompts
SET question_en = 'What photo filter would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2297';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2297-1-item-1';

-- prompt-preference-2298
UPDATE prompts
SET question_en = 'What map route feature would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2298';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2298-1-item-1';

-- prompt-preference-2299
UPDATE prompts
SET question_en = 'What weather app view would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2299';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2299-1-item-1';

-- prompt-preference-2300
UPDATE prompts
SET question_en = 'What keyboard theme would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2300';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2300-1-item-1';

-- prompt-preference-2301
UPDATE prompts
SET question_en = 'What shortcut button on your phone would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2301';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2301-1-item-1';

-- prompt-preference-2302
UPDATE prompts
SET question_en = 'What playlist cover would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2302';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2302-1-item-1';

-- prompt-preference-2303
UPDATE prompts
SET question_en = 'What reminder feature would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2303';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2303-1-item-1';

-- prompt-preference-2304
UPDATE prompts
SET question_en = 'What phone widget would make your phone easier to use, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2304';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2304-1-item-1';

-- prompt-preference-2306
UPDATE prompts
SET question_en = 'What bench in a small park would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2306';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2306-1-item-1';

-- prompt-preference-2307
UPDATE prompts
SET question_en = 'What part of a convenience store would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2307';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2307-1-item-1';

-- prompt-preference-2309
UPDATE prompts
SET question_en = 'What flower stand near your home would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2309';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2309-1-item-1';

-- prompt-preference-2310
UPDATE prompts
SET question_en = 'What bus stop near your home would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2310';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2310-1-item-1';

-- prompt-preference-2311
UPDATE prompts
SET question_en = 'What seat near a train window would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2311';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2311-1-item-1';

-- prompt-preference-2312
UPDATE prompts
SET question_en = 'What fruit stand near home would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2312';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2312-1-item-1';

-- prompt-preference-2315
UPDATE prompts
SET question_en = 'What nearby vending machine would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2315';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2315-1-item-1';

-- prompt-preference-2316
UPDATE prompts
SET question_en = 'What playground bench would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2316';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2316-1-item-1';

-- prompt-preference-2320
UPDATE prompts
SET question_en = 'What nearby place when you want a little fresh air would you visit or use in your neighborhood, and why?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2320';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2320-1-item-1';

-- prompt-preference-2321
UPDATE prompts
SET question_en = 'What kind of simple puzzle would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2321';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2321-1-item-1';

-- prompt-preference-2324
UPDATE prompts
SET question_en = 'What podcast topic would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2324';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2324-1-item-1';

-- prompt-preference-2325
UPDATE prompts
SET question_en = 'What coloring tool would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2325';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2325-1-item-1';

-- prompt-preference-2326
UPDATE prompts
SET question_en = 'What craft material would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2326';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2326-1-item-1';

-- prompt-preference-2327
UPDATE prompts
SET question_en = 'What simple photo edit would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2327';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2327-1-item-1';

-- prompt-preference-2328
UPDATE prompts
SET question_en = 'What quick activity for a ten-minute break would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2328';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2328-1-item-1';

-- prompt-preference-2329
UPDATE prompts
SET question_en = 'What small hobby for rainy days would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2329';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2329-1-item-1';

-- prompt-preference-2330
UPDATE prompts
SET question_en = 'What relaxing sound would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2330';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2330-1-item-1';

-- prompt-preference-2331
UPDATE prompts
SET question_en = 'What indoor activity on hot days would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2331';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2331-1-item-1';

-- prompt-preference-2333
UPDATE prompts
SET question_en = 'What kind of short video for learning something new would fit your free time, and why would you enjoy it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2333';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2333-1-item-1';

-- prompt-routine-2401
UPDATE prompts
SET question_en = 'What helps things feel smoother when the weather changes, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2401';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2401-1-item-1';

-- prompt-routine-2402
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when the weather changes.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2402';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2402-1-item-1';

-- prompt-routine-2403
UPDATE prompts
SET question_en = 'What do you like to keep simple when the weather changes, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2403';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2403-1-item-1';

-- prompt-routine-2405
UPDATE prompts
SET question_en = 'When you feel rushed when the weather changes, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2405';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2405-1-item-1';

-- prompt-routine-2406
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for rainy or cold days, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2406';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2406-1-item-1';

-- prompt-routine-2407
UPDATE prompts
SET question_en = 'What do you often notice about yourself when the weather changes?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2407';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2407-1-item-1';

-- prompt-routine-2408
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about rainy or cold days?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2408';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2408-1-item-1';

-- prompt-routine-2409
UPDATE prompts
SET question_en = 'What makes rainy or cold days feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2409';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2409-1-item-1';

-- prompt-routine-2411
UPDATE prompts
SET question_en = 'Tell me about a recent time when rainy or cold days went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2411';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2411-1-item-1';

-- prompt-routine-2412
UPDATE prompts
SET question_en = 'What small choice affects your mood when the weather changes?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2412';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2412-1-item-1';

-- prompt-routine-2413
UPDATE prompts
SET question_en = 'What do you usually do first when the weather changes, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2413';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2413-1-item-1';

-- prompt-routine-2414
UPDATE prompts
SET question_en = 'What do you usually do last to finish rainy or cold days neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2414';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2414-1-item-1';

-- prompt-routine-2415
UPDATE prompts
SET question_en = 'What do you try to avoid when the weather changes, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2415';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2415-1-item-1';

-- prompt-routine-2416
UPDATE prompts
SET question_en = 'What helps things feel smoother when you stop by a store or run a quick errand, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2416';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2416-1-item-1';

-- prompt-routine-2417
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you stop by a store or run a quick errand.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2417';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2417-1-item-1';

-- prompt-routine-2418
UPDATE prompts
SET question_en = 'What do you like to keep simple when you stop by a store or run a quick errand, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2418';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2418-1-item-1';

-- prompt-routine-2419
UPDATE prompts
SET question_en = 'When you feel rushed when you stop by a store or run a quick errand, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2419';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2419-1-item-1';

-- prompt-routine-2420
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for a quick errand or store stop, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2420';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2420-1-item-1';

-- prompt-routine-2422
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you stop by a store or run a quick errand?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2422';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2422-1-item-1';

-- prompt-routine-2423
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about a quick errand or store stop?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2423';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2423-1-item-1';

-- prompt-routine-2424
UPDATE prompts
SET question_en = 'What makes a quick errand or store stop feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2424';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2424-1-item-1';

-- prompt-routine-2425
UPDATE prompts
SET question_en = 'Tell me about a recent time when a quick errand or store stop went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2425';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2425-1-item-1';

-- prompt-routine-2426
UPDATE prompts
SET question_en = 'What small choice affects your mood when you stop by a store or run a quick errand?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2426';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2426-1-item-1';

-- prompt-routine-2428
UPDATE prompts
SET question_en = 'What do you usually do first when you stop by a store or run a quick errand, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2428';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2428-1-item-1';

-- prompt-routine-2429
UPDATE prompts
SET question_en = 'What do you usually do last to finish a quick errand or store stop neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2429';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2429-1-item-1';

-- prompt-routine-2431
UPDATE prompts
SET question_en = 'What helps things feel smoother when you visit a cafe or bakery, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2431';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2431-1-item-1';

-- prompt-routine-2432
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you visit a cafe or bakery.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2432';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2432-1-item-1';

-- prompt-routine-2433
UPDATE prompts
SET question_en = 'What do you like to keep simple when you visit a cafe or bakery, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2433';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2433-1-item-1';

-- prompt-routine-2434
UPDATE prompts
SET question_en = 'When you feel rushed when you visit a cafe or bakery, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2434';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2434-1-item-1';

-- prompt-routine-2435
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for a cafe or bakery visit, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2435';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2435-1-item-1';

-- prompt-routine-2437
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you visit a cafe or bakery?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2437';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2437-1-item-1';

-- prompt-routine-2438
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about a cafe or bakery visit?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2438';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2438-1-item-1';

-- prompt-routine-2439
UPDATE prompts
SET question_en = 'What makes a cafe or bakery visit feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2439';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2439-1-item-1';

-- prompt-routine-2440
UPDATE prompts
SET question_en = 'Tell me about a recent time when a cafe or bakery visit went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2440';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2440-1-item-1';

-- prompt-routine-2441
UPDATE prompts
SET question_en = 'What small choice affects your mood when you visit a cafe or bakery?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2441';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2441-1-item-1';

-- prompt-routine-2442
UPDATE prompts
SET question_en = 'What do you usually do first when you visit a cafe or bakery, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2442';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2442-1-item-1';

-- prompt-routine-2444
UPDATE prompts
SET question_en = 'What do you usually do last to finish a cafe or bakery visit neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2444';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2444-1-item-1';

-- prompt-routine-2445
UPDATE prompts
SET question_en = 'What do you try to avoid when you visit a cafe or bakery, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2445';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2445-1-item-1';

-- prompt-routine-2446
UPDATE prompts
SET question_en = 'What helps things feel smoother when you take a walk or do light exercise, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2446';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2446-1-item-1';

-- prompt-routine-2447
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you take a walk or do light exercise.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2447';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2447-1-item-1';

-- prompt-routine-2448
UPDATE prompts
SET question_en = 'What do you like to keep simple when you take a walk or do light exercise, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2448';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2448-1-item-1';

-- prompt-routine-2449
UPDATE prompts
SET question_en = 'When you feel rushed when you take a walk or do light exercise, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2449';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2449-1-item-1';

-- prompt-routine-2450
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for a walk or light exercise, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2450';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2450-1-item-1';

-- prompt-routine-2452
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you take a walk or do light exercise?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2452';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2452-1-item-1';

-- prompt-routine-2453
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about a walk or light exercise?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2453';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2453-1-item-1';

-- prompt-routine-2454
UPDATE prompts
SET question_en = 'What makes a walk or light exercise feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2454';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2454-1-item-1';

-- prompt-routine-2455
UPDATE prompts
SET question_en = 'Tell me about a recent time when a walk or light exercise went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2455';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2455-1-item-1';

-- prompt-routine-2457
UPDATE prompts
SET question_en = 'What small choice affects your mood when you take a walk or do light exercise?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2457';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2457-1-item-1';

-- prompt-routine-2458
UPDATE prompts
SET question_en = 'What do you usually do first when you take a walk or do light exercise, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2458';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2458-1-item-1';

-- prompt-routine-2460
UPDATE prompts
SET question_en = 'What do you usually do last to finish a walk or light exercise neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2460';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2460-1-item-1';

-- prompt-routine-2461
UPDATE prompts
SET question_en = 'What helps things feel smoother when you get ready for bed, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2461';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2461-1-item-1';

-- prompt-routine-2462
UPDATE prompts
SET question_en = 'Tell me about one small habit that helps you when you get ready for bed.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2462';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2462-1-item-1';

-- prompt-routine-2463
UPDATE prompts
SET question_en = 'What do you like to keep simple when you get ready for bed, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2463';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2463-1-item-1';

-- prompt-routine-2464
UPDATE prompts
SET question_en = 'When you feel rushed when you get ready for bed, what helps you stay calm?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2464';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2464-1-item-1';

-- prompt-routine-2466
UPDATE prompts
SET question_en = 'What do you prepare ahead of time for getting ready for bed, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2466';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2466-1-item-1';

-- prompt-routine-2467
UPDATE prompts
SET question_en = 'What do you often notice about yourself when you get ready for bed?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2467';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2467-1-item-1';

-- prompt-routine-2468
UPDATE prompts
SET question_en = 'What is one thing you would like to improve about getting ready for bed?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2468';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2468-1-item-1';

-- prompt-routine-2469
UPDATE prompts
SET question_en = 'What makes getting ready for bed feel comfortable or smooth for you?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2469';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2469-1-item-1';

-- prompt-routine-2470
UPDATE prompts
SET question_en = 'Tell me about a recent time when getting ready for bed went well.',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2470';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2470-1-item-1';

-- prompt-routine-2472
UPDATE prompts
SET question_en = 'What small choice affects your mood when you get ready for bed?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2472';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2472-1-item-1';

-- prompt-routine-2473
UPDATE prompts
SET question_en = 'What do you usually do first when you get ready for bed, and why?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2473';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2473-1-item-1';

-- prompt-routine-2475
UPDATE prompts
SET question_en = 'What do you usually do last to finish getting ready for bed neatly?',
    question_ko = '그 상황에서 하는 일이나 느끼는 점을 이유와 함께 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2475';

UPDATE prompt_hint_items
SET content = 'When this happens, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'When this happens, I usually check what I need because it helps me feel ready.'
WHERE id = 'hint-routine-2475-1-item-1';

-- prompt-preference-2501
UPDATE prompts
SET question_en = 'What water bottle for daily use would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2501';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2501-1-item-1';

-- prompt-preference-2502
UPDATE prompts
SET question_en = 'What tumbler for refilling during the day would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2502';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2502-1-item-1';

-- prompt-preference-2503
UPDATE prompts
SET question_en = 'What sparkling water flavor would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2503';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2503-1-item-1';

-- prompt-preference-2511
UPDATE prompts
SET question_en = 'What reusable cup for going out would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2511';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2511-1-item-1';

-- prompt-preference-2512
UPDATE prompts
SET question_en = 'What drink after light exercise would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2512';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2512-1-item-1';

-- prompt-preference-2513
UPDATE prompts
SET question_en = 'What cold drink with ice on a hot day would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2513';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2513-1-item-1';

-- prompt-preference-2515
UPDATE prompts
SET question_en = 'What drink when you get home on a warm day would you choose when you need a drink, and how would it help?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2515';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2515-1-item-1';

-- prompt-preference-2516
UPDATE prompts
SET question_en = 'What backpack for daily use would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2516';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2516-1-item-1';

-- prompt-preference-2517
UPDATE prompts
SET question_en = 'What tote bag for a short trip would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2517';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2517-1-item-1';

-- prompt-preference-2518
UPDATE prompts
SET question_en = 'What small pouch in your bag would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2518';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2518-1-item-1';

-- prompt-preference-2519
UPDATE prompts
SET question_en = 'What wallet for daily use would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2519';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2519-1-item-1';

-- prompt-preference-2521
UPDATE prompts
SET question_en = 'What bag pocket for carrying a water bottle would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2521';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2521-1-item-1';

-- prompt-preference-2522
UPDATE prompts
SET question_en = 'What bag zipper would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2522';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2522-1-item-1';

-- prompt-preference-2523
UPDATE prompts
SET question_en = 'What cardholder would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2523';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2523-1-item-1';

-- prompt-preference-2524
UPDATE prompts
SET question_en = 'What bag strap would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2524';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2524-1-item-1';

-- prompt-preference-2525
UPDATE prompts
SET question_en = 'What everyday bag would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2525';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2525-1-item-1';

-- prompt-preference-2526
UPDATE prompts
SET question_en = 'What foldable shopping bag would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2526';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2526-1-item-1';

-- prompt-preference-2528
UPDATE prompts
SET question_en = 'What pouch for pens or cables would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2528';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2528-1-item-1';

-- prompt-preference-2530
UPDATE prompts
SET question_en = 'What small bag for a quick trip outside would make your day easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2530';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2530-1-item-1';

-- prompt-preference-2531
UPDATE prompts
SET question_en = 'What storage box at home would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2531';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2531-1-item-1';

-- prompt-preference-2532
UPDATE prompts
SET question_en = 'What hanger type for daily clothes would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2532';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2532-1-item-1';

-- prompt-preference-2533
UPDATE prompts
SET question_en = 'What drawer organizer would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2533';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2533-1-item-1';

-- prompt-preference-2535
UPDATE prompts
SET question_en = 'What box for small items would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2535';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2535-1-item-1';

-- prompt-preference-2536
UPDATE prompts
SET question_en = 'What cleaning cloth for your desk would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2536';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2536-1-item-1';

-- prompt-preference-2537
UPDATE prompts
SET question_en = 'What spray bottle for easy cleaning would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2537';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2537-1-item-1';

-- prompt-preference-2538
UPDATE prompts
SET question_en = 'What sponge for the kitchen would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2538';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2538-1-item-1';

-- prompt-preference-2539
UPDATE prompts
SET question_en = 'What small shelf in your room would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2539';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2539-1-item-1';

-- prompt-preference-2541
UPDATE prompts
SET question_en = 'What organizer for a bathroom drawer would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2541';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2541-1-item-1';

-- prompt-preference-2545
UPDATE prompts
SET question_en = 'What hook near the door for bags or keys would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2545';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2545-1-item-1';

-- prompt-preference-2546
UPDATE prompts
SET question_en = 'What phone charging setup would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2546';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2546-1-item-1';

-- prompt-preference-2547
UPDATE prompts
SET question_en = 'What cable length for daily use would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2547';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2547-1-item-1';

-- prompt-preference-2548
UPDATE prompts
SET question_en = 'What small speaker for background music would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2548';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2548-1-item-1';

-- prompt-preference-2549
UPDATE prompts
SET question_en = 'What desk fan for warm days would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2549';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2549-1-item-1';

-- prompt-preference-2550
UPDATE prompts
SET question_en = 'What alarm clock would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2550';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2550-1-item-1';

-- prompt-preference-2551
UPDATE prompts
SET question_en = 'What phone stand on your desk would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2551';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2551-1-item-1';

-- prompt-preference-2552
UPDATE prompts
SET question_en = 'What bedside lamp would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2552';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2552-1-item-1';

-- prompt-preference-2553
UPDATE prompts
SET question_en = 'What timer for short tasks would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2553';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2553-1-item-1';

-- prompt-preference-2554
UPDATE prompts
SET question_en = 'What compact humidifier would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2554';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2554-1-item-1';

-- prompt-preference-2555
UPDATE prompts
SET question_en = 'What power strip at home would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2555';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2555-1-item-1';

-- prompt-preference-2556
UPDATE prompts
SET question_en = 'What reading lamp would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2556';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2556-1-item-1';

-- prompt-preference-2558
UPDATE prompts
SET question_en = 'What portable fan would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2558';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2558-1-item-1';

-- prompt-preference-2559
UPDATE prompts
SET question_en = 'What tablet stand would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2559';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2559-1-item-1';

-- prompt-preference-2560
UPDATE prompts
SET question_en = 'What clip-on lamp for a desk or bed would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2560';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2560-1-item-1';

-- prompt-preference-2561
UPDATE prompts
SET question_en = 'What food container for leftovers would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2561';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2561-1-item-1';

-- prompt-preference-2563
UPDATE prompts
SET question_en = 'What food container for lunch would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2563';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2563-1-item-1';

-- prompt-preference-2566
UPDATE prompts
SET question_en = 'What small tray for snacks would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2566';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2566-1-item-1';

-- prompt-preference-2567
UPDATE prompts
SET question_en = 'What easy-to-wash cutting board would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2567';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2567-1-item-1';

-- prompt-preference-2568
UPDATE prompts
SET question_en = 'What kitchen towel would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2568';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2568-1-item-1';

-- prompt-preference-2569
UPDATE prompts
SET question_en = 'What kettle at home would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2569';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2569-1-item-1';

-- prompt-preference-2570
UPDATE prompts
SET question_en = 'What thermos for a warm drink would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2570';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2570-1-item-1';

-- prompt-preference-2572
UPDATE prompts
SET question_en = 'What container for frozen food would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2572';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2572-1-item-1';

-- prompt-preference-2575
UPDATE prompts
SET question_en = 'What small container for sauce or snacks would make your home routine easier, and when would you use it?',
    question_ko = '그 선택을 언제 사용하고 싶나요? 왜 그 상황에 잘 맞는지도 말해 주세요.',
    tip = '무엇을 고를지만 말하지 말고, 언제 쓰는지와 이유를 함께 말해 보세요.'
WHERE id = 'prompt-preference-2575';

UPDATE prompt_hint_items
SET content = 'I would choose this when ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'I would choose this when I want something simple because it feels useful.'
WHERE id = 'hint-preference-2575-1-item-1';

COMMIT;

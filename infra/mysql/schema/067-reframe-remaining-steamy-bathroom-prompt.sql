-- Reframe remaining steamy bathroom micro-routine prompt.
-- Completes the 2026-05-10 micro-routine audit after applying 066.

START TRANSACTION;

UPDATE prompts
SET question_en = 'What helps you feel ready for bed after a shower, and why?',
    question_ko = '샤워 후 잠들 준비가 됐다고 느끼게 해 주는 것은 무엇인가요? 이유도 말해 주세요.',
    tip = '작은 행동 하나만 말하지 말고, 잠들기 전 상황과 이유나 느낌을 함께 붙여 보세요.'
WHERE id = 'prompt-routine-2474';

UPDATE prompt_hint_items
SET content = 'After a shower, I usually ... because ...',
    meaning_ko = '상황을 먼저 말하고, 내가 하는 행동이나 선택의 이유를 이어 말하는 시작 문장',
    usage_tip_ko = '정답처럼 따라 쓰기보다 내 상황에 맞는 행동과 이유로 바꿔 써 보세요.',
    example_en = 'After a shower, I usually dry my hair because it helps me feel comfortable.'
WHERE id = 'hint-routine-2474-1-item-1';

COMMIT;

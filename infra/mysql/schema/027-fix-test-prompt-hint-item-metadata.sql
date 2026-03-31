-- Restore prompt_hint_items metadata that was temporarily modified during verification.

SET NAMES utf8mb4;

UPDATE prompt_hint_items
SET meaning_ko = '저녁 식사 후에 나는 보통...',
    usage_tip_ko = '저녁 식사 후에 하는 일에 대해 이야기할 때 사용하세요.',
    example_en = 'After dinner, I usually read a book.',
    expression_family = 'ROUTINE_AFTER_DINNER'
WHERE id = 'hint-a-1-1-item-1';

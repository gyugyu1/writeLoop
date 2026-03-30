UPDATE prompt_hints
SET hint_type = 'VOCAB_PHRASE'
WHERE UPPER(hint_type) = 'VOCAB'
  AND title = '활용 표현';

UPDATE prompt_hints
SET hint_type = 'VOCAB_WORD'
WHERE UPPER(hint_type) = 'VOCAB'
  AND (title IS NULL OR title = '' OR title = '활용 단어');

UPDATE prompt_hints
SET title = '활용 단어'
WHERE hint_type = 'VOCAB_WORD';

UPDATE prompt_hints
SET title = '활용 표현'
WHERE hint_type = 'VOCAB_PHRASE';

UPDATE prompt_hints
SET title = '첫 문장 스타터'
WHERE hint_type = 'STARTER'
  AND (title IS NULL OR title = '');

UPDATE prompt_hints
SET title = '답변 구조'
WHERE hint_type = 'STRUCTURE'
  AND (title IS NULL OR title = '' OR title = '활용 표현');

UPDATE prompt_hints
SET title = '추가 설명'
WHERE hint_type = 'DETAIL'
  AND (title IS NULL OR title = '');

UPDATE prompt_hints
SET title = '연결 표현'
WHERE hint_type = 'LINKER'
  AND (title IS NULL OR title = '');

UPDATE prompt_hint_items i
JOIN prompt_hints h
  ON i.hint_id COLLATE utf8mb4_unicode_ci = h.id COLLATE utf8mb4_unicode_ci
SET i.item_type = 'WORD'
WHERE h.hint_type = 'VOCAB_WORD';

UPDATE prompt_hint_items i
JOIN prompt_hints h
  ON i.hint_id COLLATE utf8mb4_unicode_ci = h.id COLLATE utf8mb4_unicode_ci
SET i.item_type = 'PHRASE'
WHERE h.hint_type IN ('VOCAB_PHRASE', 'LINKER');

UPDATE prompt_hint_items i
JOIN prompt_hints h
  ON i.hint_id COLLATE utf8mb4_unicode_ci = h.id COLLATE utf8mb4_unicode_ci
SET i.item_type = 'FRAME'
WHERE h.hint_type IN ('STARTER', 'STRUCTURE', 'DETAIL');

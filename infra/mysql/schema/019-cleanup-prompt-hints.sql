SET @title_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prompt_hints'
      AND COLUMN_NAME = 'title'
);

SET @add_title_sql := IF(
    @title_exists = 0,
    'ALTER TABLE prompt_hints ADD COLUMN title VARCHAR(100) NULL AFTER hint_type',
    'SELECT 1'
);

PREPARE add_title_stmt FROM @add_title_sql;
EXECUTE add_title_stmt;
DEALLOCATE PREPARE add_title_stmt;

UPDATE prompt_hints
SET title = CASE UPPER(hint_type)
    WHEN 'STARTER' THEN '첫 문장 스타터'
    WHEN 'VOCAB' THEN '활용 단어'
    WHEN 'VOCAB_WORD' THEN '활용 단어'
    WHEN 'VOCAB_PHRASE' THEN '활용 표현'
    WHEN 'STRUCTURE' THEN '답변 구조'
    WHEN 'DETAIL' THEN '추가 설명'
    WHEN 'LINKER' THEN '연결 표현'
    ELSE hint_type
END
WHERE title IS NULL OR TRIM(title) = '';

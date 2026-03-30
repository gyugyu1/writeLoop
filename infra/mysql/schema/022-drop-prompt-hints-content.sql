SET @content_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prompt_hints'
      AND COLUMN_NAME = 'content'
);

SET @drop_content_sql := IF(
    @content_exists = 1,
    'ALTER TABLE prompt_hints DROP COLUMN content',
    'SELECT 1'
);

PREPARE drop_prompt_hints_content_stmt FROM @drop_content_sql;
EXECUTE drop_prompt_hints_content_stmt;
DEALLOCATE PREPARE drop_prompt_hints_content_stmt;

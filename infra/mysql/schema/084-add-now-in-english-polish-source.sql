SET @schema_name = DATABASE();

SELECT COUNT(*) INTO @has_polished_from_entry_id
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'now_in_english_entries'
  AND COLUMN_NAME = 'polished_from_entry_id';

SET @statement = IF(
    @has_polished_from_entry_id = 0,
    'ALTER TABLE now_in_english_entries ADD COLUMN polished_from_entry_id VARCHAR(80) NULL AFTER entry_text',
    'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @has_polished_from_text
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'now_in_english_entries'
  AND COLUMN_NAME = 'polished_from_text';

SET @statement = IF(
    @has_polished_from_text = 0,
    'ALTER TABLE now_in_english_entries ADD COLUMN polished_from_text VARCHAR(500) NULL AFTER polished_from_entry_id',
    'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

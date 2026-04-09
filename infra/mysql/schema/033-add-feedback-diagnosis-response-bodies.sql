SET @diagnosis_response_body_json_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'feedback_diagnosis_logs'
      AND COLUMN_NAME = 'diagnosis_response_body_json'
);

SET @add_diagnosis_response_body_json_sql := IF(
    @diagnosis_response_body_json_exists = 0,
    'ALTER TABLE feedback_diagnosis_logs ADD COLUMN diagnosis_response_body_json JSON NULL AFTER regeneration_response_status_code',
    'SELECT 1'
);

PREPARE add_diagnosis_response_body_json_stmt FROM @add_diagnosis_response_body_json_sql;
EXECUTE add_diagnosis_response_body_json_stmt;
DEALLOCATE PREPARE add_diagnosis_response_body_json_stmt;

SET @generation_response_body_json_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'feedback_diagnosis_logs'
      AND COLUMN_NAME = 'generation_response_body_json'
);

SET @add_generation_response_body_json_sql := IF(
    @generation_response_body_json_exists = 0,
    'ALTER TABLE feedback_diagnosis_logs ADD COLUMN generation_response_body_json JSON NULL AFTER diagnosis_response_body_json',
    'SELECT 1'
);

PREPARE add_generation_response_body_json_stmt FROM @add_generation_response_body_json_sql;
EXECUTE add_generation_response_body_json_stmt;
DEALLOCATE PREPARE add_generation_response_body_json_stmt;

SET @regeneration_response_body_json_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'feedback_diagnosis_logs'
      AND COLUMN_NAME = 'regeneration_response_body_json'
);

SET @add_regeneration_response_body_json_sql := IF(
    @regeneration_response_body_json_exists = 0,
    'ALTER TABLE feedback_diagnosis_logs ADD COLUMN regeneration_response_body_json JSON NULL AFTER generation_response_body_json',
    'SELECT 1'
);

PREPARE add_regeneration_response_body_json_stmt FROM @add_regeneration_response_body_json_sql;
EXECUTE add_regeneration_response_body_json_stmt;
DEALLOCATE PREPARE add_regeneration_response_body_json_stmt;

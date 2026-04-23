SET @diary_answer_band_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'diary_attempts'
      AND COLUMN_NAME = 'answer_band'
);

SET @add_diary_answer_band_sql := IF(
    @diary_answer_band_exists = 0,
    'ALTER TABLE diary_attempts ADD COLUMN answer_band VARCHAR(64) NOT NULL DEFAULT ''DIARY_CLEAR_BASIC'' AFTER score',
    'SELECT 1'
);

PREPARE add_diary_answer_band_stmt FROM @add_diary_answer_band_sql;
EXECUTE add_diary_answer_band_stmt;
DEALLOCATE PREPARE add_diary_answer_band_stmt;

SET @diary_schema_version_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'diary_attempts'
      AND COLUMN_NAME = 'feedback_schema_version'
);

SET @add_diary_schema_version_sql := IF(
    @diary_schema_version_exists = 0,
    'ALTER TABLE diary_attempts ADD COLUMN feedback_schema_version VARCHAR(64) NOT NULL DEFAULT ''diary-feedback-v1'' AFTER answer_band',
    'SELECT 1'
);

PREPARE add_diary_schema_version_stmt FROM @add_diary_schema_version_sql;
EXECUTE add_diary_schema_version_stmt;
DEALLOCATE PREPARE add_diary_schema_version_stmt;

SET @diary_feedback_provider_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'diary_attempts'
      AND COLUMN_NAME = 'feedback_provider'
);

SET @add_diary_feedback_provider_sql := IF(
    @diary_feedback_provider_exists = 0,
    'ALTER TABLE diary_attempts ADD COLUMN feedback_provider VARCHAR(32) NULL AFTER feedback_schema_version',
    'SELECT 1'
);

PREPARE add_diary_feedback_provider_stmt FROM @add_diary_feedback_provider_sql;
EXECUTE add_diary_feedback_provider_stmt;
DEALLOCATE PREPARE add_diary_feedback_provider_stmt;

SET @diary_feedback_model_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'diary_attempts'
      AND COLUMN_NAME = 'feedback_model'
);

SET @add_diary_feedback_model_sql := IF(
    @diary_feedback_model_exists = 0,
    'ALTER TABLE diary_attempts ADD COLUMN feedback_model VARCHAR(128) NULL AFTER feedback_provider',
    'SELECT 1'
);

PREPARE add_diary_feedback_model_stmt FROM @add_diary_feedback_model_sql;
EXECUTE add_diary_feedback_model_stmt;
DEALLOCATE PREPARE add_diary_feedback_model_stmt;

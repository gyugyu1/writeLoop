-- Store provider-reported token usage aggregated across the initial call and one contract retry.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_token_usage $$
CREATE PROCEDURE sp_writeloop_add_feedback_token_usage()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'llm_input_tokens'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN llm_input_tokens BIGINT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'llm_cached_input_tokens'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN llm_cached_input_tokens BIGINT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'llm_output_tokens'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN llm_output_tokens BIGINT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'llm_reasoning_tokens'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN llm_reasoning_tokens BIGINT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'llm_total_tokens'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN llm_total_tokens BIGINT NULL;
    END IF;
END $$

CALL sp_writeloop_add_feedback_token_usage() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_token_usage $$

DELIMITER ;

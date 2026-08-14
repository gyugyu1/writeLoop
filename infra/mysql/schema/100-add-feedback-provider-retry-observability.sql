-- Track one automatic retry for transient LLM provider failures separately from contract retries.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_provider_retry_observability $$
CREATE PROCEDURE sp_writeloop_add_feedback_provider_retry_observability()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'provider_retry_attempted'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN provider_retry_attempted BIT(1) NOT NULL DEFAULT b'0'
                AFTER thinking_budget;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'provider_retry_succeeded'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN provider_retry_succeeded BIT(1) NULL
                AFTER provider_retry_attempted;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'provider_initial_failure_status_code'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN provider_initial_failure_status_code INT NULL
                AFTER provider_retry_succeeded;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'provider_initial_failure_body_json'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN provider_initial_failure_body_json JSON NULL
                AFTER provider_initial_failure_status_code;
    END IF;
END $$

CALL sp_writeloop_add_feedback_provider_retry_observability() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_provider_retry_observability $$

DELIMITER ;

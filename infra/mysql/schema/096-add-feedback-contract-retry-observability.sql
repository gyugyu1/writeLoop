-- Record canonical contract retry outcomes on the diagnosis authority table.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_contract_retry_observability $$
CREATE PROCEDURE sp_writeloop_add_feedback_contract_retry_observability()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'contract_retry_succeeded'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN contract_retry_succeeded BIT(1) NULL
                AFTER retry_attempted;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'contract_original_error_reason'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN contract_original_error_reason TEXT NULL
                AFTER contract_retry_succeeded;
    END IF;
END $$

CALL sp_writeloop_add_feedback_contract_retry_observability() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_contract_retry_observability $$

DELIMITER ;

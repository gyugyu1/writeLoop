-- Store the canonical utterance-form diagnosis for operational quality queries.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_utterance_form $$
CREATE PROCEDURE sp_writeloop_add_feedback_utterance_form()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'diagnosis_utterance_form'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN diagnosis_utterance_form VARCHAR(16) NULL
                AFTER diagnosis_topic_relevance;
    END IF;
END $$

CALL sp_writeloop_add_feedback_utterance_form() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_utterance_form $$

DELIMITER ;

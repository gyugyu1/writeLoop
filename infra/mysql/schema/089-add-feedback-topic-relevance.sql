-- Store the same canonical topic relevance used by the LLM contract and backend policy.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_topic_relevance $$
CREATE PROCEDURE sp_writeloop_add_feedback_topic_relevance()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'diagnosis_topic_relevance'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN diagnosis_topic_relevance VARCHAR(16) NULL
                AFTER diagnosis_task_completion;
    END IF;

    UPDATE feedback_diagnosis_logs
    SET diagnosis_topic_relevance = CASE
        WHEN diagnosis_on_topic = b'1' THEN 'ON_TOPIC'
        WHEN diagnosis_on_topic = b'0' THEN 'OFF_TOPIC'
        ELSE NULL
    END
    WHERE diagnosis_topic_relevance IS NULL;
END $$

CALL sp_writeloop_add_feedback_topic_relevance() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_feedback_topic_relevance $$

DELIMITER ;

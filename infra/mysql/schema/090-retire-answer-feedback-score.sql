-- Question-answer feedback no longer exposes or writes a synthetic score.
-- Existing historical values are preserved, while new attempts may store NULL.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_retire_answer_feedback_score $$
CREATE PROCEDURE sp_writeloop_retire_answer_feedback_score()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'answer_attempts'
          AND COLUMN_NAME = 'score'
          AND IS_NULLABLE = 'NO'
    ) THEN
        ALTER TABLE answer_attempts
            MODIFY COLUMN score INT NULL;
    END IF;
END $$

CALL sp_writeloop_retire_answer_feedback_score() $$
DROP PROCEDURE IF EXISTS sp_writeloop_retire_answer_feedback_score $$

DELIMITER ;

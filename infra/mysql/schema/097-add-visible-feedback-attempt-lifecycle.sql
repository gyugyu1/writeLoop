-- Persist the exact user-facing feedback for each attempt and make submissions idempotent.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_visible_feedback_attempt_lifecycle $$
CREATE PROCEDURE sp_writeloop_add_visible_feedback_attempt_lifecycle()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'answer_attempts'
          AND COLUMN_NAME = 'submission_id'
    ) THEN
        ALTER TABLE answer_attempts
            ADD COLUMN submission_id VARCHAR(64) NULL
                AFTER attempt_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'answer_attempts'
          AND COLUMN_NAME = 'visible_feedback_snapshot_json'
    ) THEN
        ALTER TABLE answer_attempts
            ADD COLUMN visible_feedback_snapshot_json JSON NULL
                AFTER feedback_payload_json;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'answer_attempts'
          AND INDEX_NAME = 'uq_answer_attempts_session_submission'
    ) THEN
        ALTER TABLE answer_attempts
            ADD UNIQUE KEY uq_answer_attempts_session_submission (session_id, submission_id);
    END IF;

    -- Only an explicitly stored coach move can be reproduced safely for legacy attempts.
    UPDATE answer_attempts
    SET visible_feedback_snapshot_json = JSON_OBJECT(
        'schemaVersion', 1,
        'state', 'NEEDS_REWRITE',
        'coachMove', JSON_EXTRACT(feedback_payload_json, '$.coachMove'),
        'legacy', JSON_EXTRACT('true', '$')
    )
    WHERE visible_feedback_snapshot_json IS NULL
      AND feedback_payload_json IS NOT NULL
      AND JSON_UNQUOTE(JSON_EXTRACT(feedback_payload_json, '$.loopComplete')) = 'false'
      AND JSON_TYPE(JSON_EXTRACT(feedback_payload_json, '$.coachMove')) = 'OBJECT';
END $$

CALL sp_writeloop_add_visible_feedback_attempt_lifecycle() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_visible_feedback_attempt_lifecycle $$

DELIMITER ;

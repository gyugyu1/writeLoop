-- Normalize legacy UTC DATETIME literals to Korea Standard Time.
-- TIMESTAMP values already represent the correct instant and are converted by the session time zone.

SET @writeloop_previous_time_zone = @@session.time_zone;
SET time_zone = '+09:00';

CREATE TABLE IF NOT EXISTS writeloop_data_migrations (
    migration_key VARCHAR(128) NOT NULL,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (migration_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_shift_datetime_column_to_kst $$
CREATE PROCEDURE sp_writeloop_shift_datetime_column_to_kst(
    IN target_table VARCHAR(64),
    IN target_column VARCHAR(64)
)
BEGIN
    DECLARE datetime_column_exists INT DEFAULT 0;

    SELECT COUNT(*)
    INTO datetime_column_exists
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
      AND DATA_TYPE = 'datetime';

    IF datetime_column_exists = 1 THEN
        SET @shift_datetime_sql = CONCAT(
            'UPDATE `', target_table, '` ',
            'SET `', target_column, '` = DATE_ADD(`', target_column, '`, INTERVAL 9 HOUR) ',
            'WHERE `', target_column, '` IS NOT NULL'
        );
        PREPARE shift_datetime_statement FROM @shift_datetime_sql;
        EXECUTE shift_datetime_statement;
        DEALLOCATE PREPARE shift_datetime_statement;
    END IF;
END $$

DROP PROCEDURE IF EXISTS sp_writeloop_normalize_database_times_to_korea $$
CREATE PROCEDURE sp_writeloop_normalize_database_times_to_korea()
BEGIN
    DECLARE migration_applied INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT COUNT(*)
    INTO migration_applied
    FROM writeloop_data_migrations
    WHERE migration_key = '101-normalize-database-times-to-korea';

    IF migration_applied = 0 THEN
        START TRANSACTION;

        CALL sp_writeloop_shift_datetime_column_to_kst('answer_attempts', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('answer_sessions', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('answer_sessions', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('app_version_settings', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('app_version_settings', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('coach_interactions', 'evaluated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('coach_interactions', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('coach_interactions', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('diary_attempts', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('diary_entries', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('diary_entries', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('email_verification_tokens', 'expires_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('email_verification_tokens', 'used_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('email_verification_tokens', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('feedback_diagnosis_logs', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('feedback_timing_logs', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('now_in_english_entries', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('now_in_english_entries', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('now_in_english_reflections', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('now_in_english_reflections', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('password_reset_tokens', 'expires_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('password_reset_tokens', 'used_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('password_reset_tokens', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_coach_profiles', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_coach_profiles', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_hint_items', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_hint_items', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_hints', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_hints', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_recommendation_exposures', 'shown_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_recommendation_exposures', 'clicked_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompt_recommendation_timing_logs', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompts', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('prompts', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('remember_login_tokens', 'expires_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('remember_login_tokens', 'last_used_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('remember_login_tokens', 'revoked_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('remember_login_tokens', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('remember_login_tokens', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('saved_expressions', 'last_saved_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('saved_expressions', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('saved_expressions', 'updated_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('users', 'verified_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('users', 'last_login_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('users', 'created_at');
        CALL sp_writeloop_shift_datetime_column_to_kst('users', 'updated_at');

        INSERT INTO writeloop_data_migrations (migration_key)
        VALUES ('101-normalize-database-times-to-korea');

        COMMIT;
    END IF;
END $$

CALL sp_writeloop_normalize_database_times_to_korea() $$

DROP PROCEDURE IF EXISTS sp_writeloop_normalize_database_times_to_korea $$
DROP PROCEDURE IF EXISTS sp_writeloop_shift_datetime_column_to_kst $$

DELIMITER ;

SET time_zone = @writeloop_previous_time_zone;

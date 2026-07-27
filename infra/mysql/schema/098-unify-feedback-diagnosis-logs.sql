-- Make feedback_diagnosis_logs the single authority for successful and failed LLM executions.

DROP VIEW IF EXISTS feedback_contract_failure_rates;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_unify_feedback_diagnosis_logs $$
CREATE PROCEDURE sp_writeloop_unify_feedback_diagnosis_logs()
BEGIN
    DECLARE contract_violation_column_added BOOLEAN DEFAULT FALSE;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'execution_status'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN execution_status VARCHAR(16) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'input_fingerprint'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN input_fingerprint CHAR(64) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'reasoning_effort'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN reasoning_effort VARCHAR(24) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'thinking_budget'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN thinking_budget INT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'contract_violation_detected'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN contract_violation_detected BIT(1) NOT NULL DEFAULT b'0';
        SET contract_violation_column_added = TRUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'contract_final_error_reason'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN contract_final_error_reason TEXT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = 'elapsed_ms'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD COLUMN elapsed_ms BIGINT NULL;
    END IF;

    UPDATE feedback_diagnosis_logs
    SET execution_status = 'SUCCESS'
    WHERE execution_status IS NULL;

    UPDATE feedback_diagnosis_logs
    SET input_fingerprint = LOWER(SHA2(CONCAT(
        COALESCE(prompt_id, ''),
        CHAR(10),
        COALESCE(learner_answer, '')
    ), 256))
    WHERE input_fingerprint IS NULL
       OR input_fingerprint = '';

    IF contract_violation_column_added THEN
        UPDATE feedback_diagnosis_logs
        SET contract_violation_detected = CASE
            WHEN retry_attempted = b'1' THEN b'1'
            ELSE b'0'
        END;
    END IF;

    ALTER TABLE feedback_diagnosis_logs
        MODIFY COLUMN execution_status VARCHAR(16) NOT NULL,
        MODIFY COLUMN input_fingerprint CHAR(64) NOT NULL;

    IF EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND INDEX_NAME = 'idx_feedback_diag_band_created'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            DROP INDEX idx_feedback_diag_band_created;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND INDEX_NAME = 'idx_feedback_diag_execution_created'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD INDEX idx_feedback_diag_execution_created (execution_status, created_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND INDEX_NAME = 'idx_feedback_diag_input_created'
    ) THEN
        ALTER TABLE feedback_diagnosis_logs
            ADD INDEX idx_feedback_diag_input_created (prompt_id, input_fingerprint, created_at);
    END IF;
END $$

DROP PROCEDURE IF EXISTS sp_writeloop_drop_feedback_diagnosis_column $$
CREATE PROCEDURE sp_writeloop_drop_feedback_diagnosis_column(IN column_to_drop VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_diagnosis_logs'
          AND COLUMN_NAME = column_to_drop
    ) THEN
        SET @drop_feedback_diagnosis_column_sql = CONCAT(
            'ALTER TABLE feedback_diagnosis_logs DROP COLUMN `',
            REPLACE(column_to_drop, '`', '``'),
            '`'
        );
        PREPARE drop_feedback_diagnosis_column_stmt
            FROM @drop_feedback_diagnosis_column_sql;
        EXECUTE drop_feedback_diagnosis_column_stmt;
        DEALLOCATE PREPARE drop_feedback_diagnosis_column_stmt;
    END IF;
END $$

CALL sp_writeloop_unify_feedback_diagnosis_logs() $$

CALL sp_writeloop_drop_feedback_diagnosis_column('generation_response_status_code') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('generation_response_body_json') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('authoritative_feedback') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_fallback_used') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('deterministic_response_fallback_used') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_score') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_answer_band') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_task_completion') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_on_topic') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_finishable') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_grammar_severity') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_primary_issue_code') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_secondary_issue_code') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('diagnosis_minimal_correction') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('rewrite_target_action') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('rewrite_target_skeleton') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('rewrite_target_max_new_sentence_count') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('expansion_budget') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_task_answer_band') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_task_completion') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_task_finishable') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_grammar_severity') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_grammar_issue_count') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_content_specificity') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_main_answer') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_reason') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_example') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_feeling') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_activity') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('profile_has_time_or_place') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('answer_profile_json') $$
CALL sp_writeloop_drop_feedback_diagnosis_column('section_policy_json') $$

DROP PROCEDURE IF EXISTS sp_writeloop_migrate_legacy_feedback_contract_failures $$
CREATE PROCEDURE sp_writeloop_migrate_legacy_feedback_contract_failures()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feedback_contract_execution_logs'
          AND TABLE_TYPE = 'BASE TABLE'
    ) THEN
        INSERT INTO feedback_diagnosis_logs (
            execution_status,
            answer_attempt_id,
            session_id,
            attempt_no,
            attempt_type,
            user_id,
            guest_id,
            prompt_id,
            input_fingerprint,
            prompt_topic,
            prompt_topic_category,
            prompt_topic_detail,
            prompt_difficulty,
            prompt_question_en,
            prompt_question_ko,
            prompt_hints_json,
            prompt_task_meta_json,
            learner_answer,
            previous_answer,
            llm_provider,
            llm_model,
            reasoning_effort,
            thinking_budget,
            diagnosis_response_status_code,
            regeneration_response_status_code,
            diagnosis_response_body_json,
            regeneration_response_body_json,
            contract_violation_detected,
            retry_attempted,
            contract_retry_succeeded,
            contract_original_error_reason,
            contract_final_error_reason,
            diagnosis_topic_relevance,
            diagnosis_utterance_form,
            diagnosis_grammar_issue_count,
            elapsed_ms,
            diagnosis_payload_json,
            final_sections_json,
            created_at
        )
        SELECT
            'FAILED',
            NULL,
            NULL,
            execution.attempt_no,
            NULL,
            NULL,
            NULL,
            execution.prompt_id,
            execution.input_fingerprint,
            COALESCE(template.prompt_topic, 'Legacy execution'),
            template.prompt_topic_category,
            template.prompt_topic_detail,
            COALESCE(template.prompt_difficulty, 'UNKNOWN'),
            COALESCE(template.prompt_question_en, 'Legacy prompt snapshot unavailable'),
            COALESCE(template.prompt_question_ko, 'Legacy prompt snapshot unavailable'),
            template.prompt_hints_json,
            template.prompt_task_meta_json,
            COALESCE(template.learner_answer, '[legacy learner answer unavailable]'),
            template.previous_answer,
            execution.provider,
            execution.model,
            execution.reasoning_effort,
            execution.thinking_budget,
            execution.initial_response_status_code,
            execution.retry_response_status_code,
            NULL,
            NULL,
            execution.contract_violation_detected,
            execution.retry_attempted,
            execution.retry_succeeded,
            execution.original_contract_error_reason,
            execution.final_error_reason,
            NULL,
            NULL,
            NULL,
            execution.elapsed_ms,
            NULL,
            NULL,
            execution.created_at
        FROM feedback_contract_execution_logs execution
        LEFT JOIN feedback_diagnosis_logs template
          ON template.id = (
              SELECT MAX(candidate.id)
              FROM feedback_diagnosis_logs candidate
              WHERE BINARY candidate.prompt_id = BINARY execution.prompt_id
                AND BINARY candidate.input_fingerprint = BINARY execution.input_fingerprint
                AND candidate.execution_status = 'SUCCESS'
          )
        WHERE execution.final_success = b'0'
          AND NOT EXISTS (
              SELECT 1
              FROM feedback_diagnosis_logs migrated
              WHERE migrated.execution_status = 'FAILED'
                AND BINARY migrated.prompt_id = BINARY execution.prompt_id
                AND BINARY migrated.input_fingerprint = BINARY execution.input_fingerprint
                AND BINARY migrated.llm_provider = BINARY execution.provider
                AND migrated.created_at = execution.created_at
                AND COALESCE(migrated.elapsed_ms, -1) = COALESCE(execution.elapsed_ms, -1)
          );
    END IF;
END $$

CALL sp_writeloop_migrate_legacy_feedback_contract_failures() $$

DROP PROCEDURE IF EXISTS sp_writeloop_migrate_legacy_feedback_contract_failures $$
DROP PROCEDURE IF EXISTS sp_writeloop_drop_feedback_diagnosis_column $$
DROP PROCEDURE IF EXISTS sp_writeloop_unify_feedback_diagnosis_logs $$

DELIMITER ;

DROP TABLE IF EXISTS feedback_contract_execution_logs;

CREATE OR REPLACE VIEW feedback_contract_failure_rates AS
SELECT
    prompt_id,
    input_fingerprint,
    llm_provider AS provider,
    llm_model AS model,
    reasoning_effort,
    thinking_budget,
    COUNT(*) AS execution_count,
    SUM(CASE WHEN contract_violation_detected = b'1' THEN 1 ELSE 0 END)
        AS initial_contract_failure_count,
    ROUND(
        SUM(CASE WHEN contract_violation_detected = b'1' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0),
        4
    ) AS initial_contract_failure_rate,
    SUM(CASE WHEN retry_attempted = b'1' THEN 1 ELSE 0 END)
        AS retry_attempt_count,
    SUM(CASE WHEN contract_retry_succeeded = b'1' THEN 1 ELSE 0 END)
        AS retry_recovered_count,
    ROUND(
        SUM(CASE WHEN contract_retry_succeeded = b'1' THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN retry_attempted = b'1' THEN 1 ELSE 0 END), 0),
        4
    ) AS retry_recovery_rate,
    SUM(
        CASE
            WHEN contract_violation_detected = b'1'
             AND execution_status = 'FAILED' THEN 1
            ELSE 0
        END
    ) AS final_contract_failure_count,
    ROUND(
        SUM(
            CASE
                WHEN contract_violation_detected = b'1'
                 AND execution_status = 'FAILED' THEN 1
                ELSE 0
            END
        ) / NULLIF(COUNT(*), 0),
        4
    ) AS final_contract_failure_rate,
    MAX(created_at) AS last_executed_at
FROM feedback_diagnosis_logs
GROUP BY
    prompt_id,
    input_fingerprint,
    llm_provider,
    llm_model,
    reasoning_effort,
    thinking_budget;

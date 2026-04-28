DROP PROCEDURE IF EXISTS add_prompt_recommendation_index_if_missing;

DELIMITER //

CREATE PROCEDURE add_prompt_recommendation_index_if_missing(
    IN target_table VARCHAR(64),
    IN target_index VARCHAR(64),
    IN index_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = target_table
          AND index_name = target_index
    ) THEN
        SET @statement = CONCAT('ALTER TABLE ', target_table, ' ADD INDEX ', target_index, ' ', index_definition);
        PREPARE prepared_statement FROM @statement;
        EXECUTE prepared_statement;
        DEALLOCATE PREPARE prepared_statement;
    END IF;
END//

DELIMITER ;

CALL add_prompt_recommendation_index_if_missing(
    'answer_sessions',
    'idx_answer_sessions_user_created',
    '(user_id, created_at)'
);

CALL add_prompt_recommendation_index_if_missing(
    'answer_sessions',
    'idx_answer_sessions_guest_created',
    '(guest_id, created_at)'
);

CALL add_prompt_recommendation_index_if_missing(
    'answer_sessions',
    'idx_answer_sessions_user_status_updated',
    '(user_id, status, updated_at)'
);

CALL add_prompt_recommendation_index_if_missing(
    'prompts',
    'idx_prompts_active_difficulty_order',
    '(is_active, difficulty, display_order)'
);

DROP PROCEDURE IF EXISTS add_prompt_recommendation_index_if_missing;

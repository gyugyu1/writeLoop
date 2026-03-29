SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE prompt_hints
    CONVERT TO CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

ALTER TABLE prompt_hints
    MODIFY prompt_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL;

ALTER TABLE answer_sessions
    MODIFY id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL,
    MODIFY prompt_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL;

ALTER TABLE coach_interactions
    MODIFY answer_session_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NULL,
    MODIFY prompt_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL;

UPDATE answer_sessions
SET prompt_id = REPLACE(prompt_id, 'sample-', 'prompt-')
WHERE prompt_id LIKE 'sample-%';

UPDATE coach_interactions
SET prompt_id = REPLACE(prompt_id, 'sample-', 'prompt-')
WHERE prompt_id LIKE 'sample-%';

DELETE FROM prompt_hints
WHERE prompt_id LIKE 'sample-%';

DELETE FROM prompt_coach_profiles
WHERE prompt_id LIKE 'sample-%';

DELETE FROM prompts
WHERE id LIKE 'sample-%';

SET FOREIGN_KEY_CHECKS = 1;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prompt_hints'
      AND CONSTRAINT_NAME = 'fk_prompt_hints_prompt'
);

SET @add_fk_sql := IF(
    @fk_exists = 0,
    'ALTER TABLE prompt_hints ADD CONSTRAINT fk_prompt_hints_prompt FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE',
    'SELECT 1'
);

PREPARE prompt_hints_fk_stmt FROM @add_fk_sql;
EXECUTE prompt_hints_fk_stmt;
DEALLOCATE PREPARE prompt_hints_fk_stmt;

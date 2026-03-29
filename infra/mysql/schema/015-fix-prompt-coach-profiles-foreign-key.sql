ALTER TABLE prompt_coach_profiles
    CONVERT TO CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

ALTER TABLE prompt_coach_profiles
    MODIFY prompt_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL;

SET @fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prompt_coach_profiles'
      AND CONSTRAINT_NAME = 'fk_prompt_coach_profiles_prompt'
);

SET @add_fk_sql := IF(
    @fk_exists = 0,
    'ALTER TABLE prompt_coach_profiles ADD CONSTRAINT fk_prompt_coach_profiles_prompt FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE',
    'SELECT 1'
);

PREPARE prompt_coach_profiles_fk_stmt FROM @add_fk_sql;
EXECUTE prompt_coach_profiles_fk_stmt;
DEALLOCATE PREPARE prompt_coach_profiles_fk_stmt;

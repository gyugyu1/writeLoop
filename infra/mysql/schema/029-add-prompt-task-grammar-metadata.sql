DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_grammar_metadata $$
CREATE PROCEDURE sp_writeloop_add_prompt_task_grammar_metadata()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompt_task_profiles'
          AND COLUMN_NAME = 'expected_tense'
    ) THEN
        ALTER TABLE prompt_task_profiles
            ADD COLUMN expected_tense VARCHAR(40)
                CHARACTER SET utf8mb4
                COLLATE utf8mb4_unicode_ci
                NULL
                AFTER answer_mode_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompt_task_profiles'
          AND COLUMN_NAME = 'expected_pov'
    ) THEN
        ALTER TABLE prompt_task_profiles
            ADD COLUMN expected_pov VARCHAR(40)
                CHARACTER SET utf8mb4
                COLLATE utf8mb4_unicode_ci
                NULL
                AFTER expected_tense;
    END IF;

    UPDATE prompt_task_profiles profile
    JOIN prompt_answer_modes mode
      ON mode.id = profile.answer_mode_id
    SET profile.expected_tense = CASE mode.code
            WHEN 'GOAL_PLAN' THEN 'FUTURE_PLAN'
            WHEN 'CHANGE_REFLECTION' THEN 'MIXED_PAST_PRESENT'
            ELSE 'PRESENT_SIMPLE'
        END,
        profile.expected_pov = CASE mode.code
            WHEN 'BALANCED_OPINION' THEN 'GENERAL_OR_FIRST_PERSON'
            WHEN 'OPINION_REASON' THEN 'GENERAL_OR_FIRST_PERSON'
            ELSE 'FIRST_PERSON'
        END
    WHERE profile.expected_tense IS NULL
       OR profile.expected_tense = ''
       OR profile.expected_pov IS NULL
       OR profile.expected_pov = '';

    IF NOT EXISTS (
        SELECT 1
        FROM prompt_task_profiles
        WHERE expected_tense IS NULL
           OR expected_tense = ''
           OR expected_pov IS NULL
           OR expected_pov = ''
    ) THEN
        ALTER TABLE prompt_task_profiles
            MODIFY COLUMN expected_tense VARCHAR(40)
                CHARACTER SET utf8mb4
                COLLATE utf8mb4_unicode_ci
                NOT NULL;

        ALTER TABLE prompt_task_profiles
            MODIFY COLUMN expected_pov VARCHAR(40)
                CHARACTER SET utf8mb4
                COLLATE utf8mb4_unicode_ci
                NOT NULL;
    END IF;
END $$

CALL sp_writeloop_add_prompt_task_grammar_metadata() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_grammar_metadata $$

DELIMITER ;

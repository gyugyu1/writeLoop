DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_completion_depth $$
CREATE PROCEDURE sp_writeloop_add_prompt_task_completion_depth()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompt_task_profiles'
          AND COLUMN_NAME = 'minimum_depth_slots'
    ) THEN
        ALTER TABLE prompt_task_profiles
            ADD COLUMN minimum_depth_slots INT NOT NULL DEFAULT 0
                AFTER expected_pov;
    END IF;

    UPDATE prompt_task_profiles profile
    JOIN prompt_answer_modes mode
      ON mode.id = profile.answer_mode_id
    SET profile.minimum_depth_slots = 1
    WHERE mode.code = 'ROUTINE';

    INSERT INTO prompt_task_profile_slots (
        prompt_id,
        slot_id,
        slot_role,
        display_order,
        is_active
    )
    SELECT
        profile.prompt_id,
        reason_slot.id,
        'OPTIONAL',
        COALESCE(MAX(existing.display_order), 0) + 1,
        1
    FROM prompt_task_profiles profile
    JOIN prompt_answer_modes mode
      ON mode.id = profile.answer_mode_id
     AND mode.code = 'ROUTINE'
    JOIN prompt_task_slots reason_slot
      ON reason_slot.code = 'REASON'
    LEFT JOIN prompt_task_profile_slots existing
      ON existing.prompt_id = profile.prompt_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM prompt_task_profile_slots assigned
        WHERE assigned.prompt_id = profile.prompt_id
          AND assigned.slot_id = reason_slot.id
    )
    GROUP BY profile.prompt_id, reason_slot.id;
END $$

CALL sp_writeloop_add_prompt_task_completion_depth() $$
DROP PROCEDURE IF EXISTS sp_writeloop_add_prompt_task_completion_depth $$

DELIMITER ;

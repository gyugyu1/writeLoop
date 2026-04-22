DELETE FROM prompt_recommendation_exposures
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY recommended_date,
                                COALESCE(
                                    CASE
                                        WHEN user_id IS NOT NULL THEN CONCAT('USER:', CAST(user_id AS CHAR))
                                        WHEN guest_id IS NOT NULL AND TRIM(guest_id) <> '' THEN CONCAT('GUEST:', LOWER(TRIM(guest_id)))
                                        ELSE NULL
                                    END,
                                    CONCAT('ROW:', CAST(id AS CHAR))
                                ),
                                prompt_id
                   ORDER BY shown_at ASC, id ASC
               ) AS row_num
        FROM prompt_recommendation_exposures
    ) ranked
    WHERE ranked.row_num > 1
);

ALTER TABLE prompt_recommendation_exposures
    ADD COLUMN viewer_key VARCHAR(160)
        GENERATED ALWAYS AS (
            CASE
                WHEN user_id IS NOT NULL THEN CONCAT('USER:', CAST(user_id AS CHAR))
                WHEN guest_id IS NOT NULL AND TRIM(guest_id) <> '' THEN CONCAT('GUEST:', LOWER(TRIM(guest_id)))
                ELSE NULL
            END
        ) STORED AFTER guest_id,
    ADD KEY idx_prompt_reco_user_prompt_date (user_id, prompt_id, recommended_date, shown_at),
    ADD KEY idx_prompt_reco_guest_prompt_date (guest_id, prompt_id, recommended_date, shown_at),
    ADD UNIQUE KEY uk_prompt_reco_daily_viewer_prompt (recommended_date, viewer_key, prompt_id);

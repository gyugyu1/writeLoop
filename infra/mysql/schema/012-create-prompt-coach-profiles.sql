CREATE TABLE prompt_coach_profiles (
    prompt_id VARCHAR(64) NOT NULL,
    primary_category VARCHAR(64) NOT NULL,
    secondary_categories_json TEXT NOT NULL,
    preferred_expression_families_json TEXT NOT NULL,
    avoid_families_json TEXT NOT NULL,
    starter_style VARCHAR(64) NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (prompt_id),
    CONSTRAINT fk_prompt_coach_profiles_prompt
        FOREIGN KEY (prompt_id) REFERENCES prompts (id)
        ON DELETE CASCADE,
    INDEX idx_prompt_coach_profiles_primary_category (primary_category),
    INDEX idx_prompt_coach_profiles_starter_style (starter_style)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

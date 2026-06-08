CREATE TABLE IF NOT EXISTS now_in_english_reflections (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    reflection_date DATE NOT NULL,
    entry_count INT NOT NULL,
    entry_signature CHAR(64) NOT NULL,
    headline_ko VARCHAR(80) NOT NULL,
    summary_ko TEXT NOT NULL,
    highlights_json JSON NOT NULL,
    pattern_ko VARCHAR(500) NOT NULL,
    gentle_correction_ko VARCHAR(500) NOT NULL,
    next_action_ko VARCHAR(500) NOT NULL,
    next_action_example_en VARCHAR(300) NOT NULL,
    expressions_json JSON NOT NULL,
    closing_ko VARCHAR(300) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_now_in_english_reflections_user_date (user_id, reflection_date),
    INDEX idx_now_in_english_reflections_user_updated (user_id, updated_at),
    CONSTRAINT fk_now_in_english_reflections_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

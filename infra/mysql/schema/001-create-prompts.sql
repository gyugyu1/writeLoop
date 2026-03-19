CREATE TABLE prompts (
    id VARCHAR(64) NOT NULL,
    question_en TEXT NOT NULL,
    question_ko TEXT NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    topic VARCHAR(120) NOT NULL,
    tip TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_prompts_active_order (is_active, display_order),
    INDEX idx_prompts_topic (topic),
    INDEX idx_prompts_difficulty (difficulty)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
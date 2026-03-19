CREATE TABLE IF NOT EXISTS prompt_hints (
    id VARCHAR(64) NOT NULL,
    prompt_id VARCHAR(64) NOT NULL,
    hint_type VARCHAR(40) NOT NULL,
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_prompt_hints_prompt
        FOREIGN KEY (prompt_id) REFERENCES prompts (id)
        ON DELETE CASCADE,
    INDEX idx_prompt_hints_prompt_order (prompt_id, is_active, display_order)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE diary_entries (
    id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NULL,
    entry_text MEDIUMTEXT NOT NULL,
    language VARCHAR(16) NOT NULL DEFAULT 'en',
    entry_date DATE NULL,
    mood VARCHAR(64) NULL,
    tags_json JSON NULL,
    is_draft TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_diary_entries_user_created (user_id, created_at),
    INDEX idx_diary_entries_user_updated (user_id, updated_at),
    CONSTRAINT fk_diary_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE diary_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entry_id VARCHAR(64) NOT NULL,
    attempt_no INT NOT NULL,
    diary_text MEDIUMTEXT NOT NULL,
    score INT NOT NULL,
    answer_band VARCHAR(64) NOT NULL,
    feedback_schema_version VARCHAR(64) NOT NULL DEFAULT 'diary-feedback-v1',
    feedback_provider VARCHAR(32) NULL,
    feedback_model VARCHAR(128) NULL,
    feedback_summary TEXT NOT NULL,
    strengths_json JSON NOT NULL,
    corrections_json JSON NOT NULL,
    model_answer MEDIUMTEXT NOT NULL,
    rewrite_challenge TEXT NOT NULL,
    feedback_payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_diary_attempts_entry_attempt_no (entry_id, attempt_no),
    INDEX idx_diary_attempts_entry_created (entry_id, created_at),
    CONSTRAINT fk_diary_attempts_entry FOREIGN KEY (entry_id) REFERENCES diary_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

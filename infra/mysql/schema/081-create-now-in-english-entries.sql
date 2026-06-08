CREATE TABLE IF NOT EXISTS now_in_english_entries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entry_id VARCHAR(80) NOT NULL,
    user_id BIGINT NOT NULL,
    entry_text VARCHAR(500) NOT NULL,
    polished_from_entry_id VARCHAR(80) NULL,
    polished_from_text VARCHAR(500) NULL,
    entry_date DATE NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_now_in_english_entries_user_entry (user_id, entry_id),
    INDEX idx_now_in_english_entries_user_created (user_id, created_at),
    INDEX idx_now_in_english_entries_user_date (user_id, entry_date),
    CONSTRAINT fk_now_in_english_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

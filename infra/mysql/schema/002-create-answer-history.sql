CREATE TABLE answer_sessions (
    id VARCHAR(64) NOT NULL,
    prompt_id VARCHAR(64) NOT NULL,
    guest_id VARCHAR(64) NULL,
    user_id BIGINT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_answer_sessions_prompt (prompt_id),
    INDEX idx_answer_sessions_guest (guest_id),
    INDEX idx_answer_sessions_user (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE answer_attempts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(64) NOT NULL,
    attempt_no INT NOT NULL,
    attempt_type VARCHAR(24) NOT NULL,
    answer_text TEXT NOT NULL,
    score INT NOT NULL,
    feedback_summary TEXT NOT NULL,
    strengths_json JSON NOT NULL,
    corrections_json JSON NOT NULL,
    model_answer TEXT NOT NULL,
    rewrite_challenge TEXT NOT NULL,
    feedback_payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_answer_attempts_session_attempt_no (session_id, attempt_no),
    INDEX idx_answer_attempts_session_created (session_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

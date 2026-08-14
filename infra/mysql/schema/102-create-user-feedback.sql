CREATE TABLE IF NOT EXISTS user_feedback (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    category VARCHAR(16) NOT NULL,
    message TEXT NOT NULL,
    contact_email VARCHAR(320) NULL,
    source_screen VARCHAR(80) NULL,
    app_version VARCHAR(32) NULL,
    platform VARCHAR(16) NULL,
    os_version VARCHAR(64) NULL,
    device_model VARCHAR(120) NULL,
    error_code VARCHAR(120) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_user_feedback_status_created (status, created_at),
    KEY idx_user_feedback_category_created (category, created_at),
    KEY idx_user_feedback_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

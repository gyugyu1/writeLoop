SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE answer_attempts
    CONVERT TO CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

ALTER TABLE answer_attempts
    MODIFY session_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;

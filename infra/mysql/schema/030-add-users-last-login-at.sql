ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL
    AFTER verified_at;

ALTER TABLE users
    ADD COLUMN social_provider VARCHAR(40) NULL,
    ADD COLUMN social_provider_user_id VARCHAR(160) NULL,
    ADD INDEX idx_users_social_provider (social_provider, social_provider_user_id);

UPDATE users
SET display_name = CONCAT('user', id)
WHERE display_name IS NULL
   OR CHAR_LENGTH(TRIM(display_name)) = 0;

UPDATE users
SET display_name = TRIM(display_name);

CREATE TEMPORARY TABLE tmp_users_display_name_rank AS
SELECT id,
       ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(display_name))
           ORDER BY id
       ) AS duplicate_rank
FROM users;

UPDATE users u
JOIN tmp_users_display_name_rank ranked
    ON ranked.id = u.id
SET u.display_name = CONCAT(
        LEFT(
            TRIM(u.display_name),
            GREATEST(0, 80 - CHAR_LENGTH(CONCAT(' #', u.id)))
        ),
        ' #',
        u.id
    )
WHERE ranked.duplicate_rank > 1;

DROP TEMPORARY TABLE tmp_users_display_name_rank;

UPDATE users
SET social_provider = NULL,
    social_provider_user_id = NULL
WHERE social_provider IS NULL
   OR CHAR_LENGTH(TRIM(social_provider)) = 0
   OR social_provider_user_id IS NULL
   OR CHAR_LENGTH(TRIM(social_provider_user_id)) = 0;

UPDATE users
SET social_provider = LOWER(TRIM(social_provider)),
    social_provider_user_id = TRIM(social_provider_user_id)
WHERE social_provider IS NOT NULL
  AND social_provider_user_id IS NOT NULL;

CREATE TEMPORARY TABLE tmp_users_social_account_rank AS
SELECT id,
       ROW_NUMBER() OVER (
           PARTITION BY social_provider, social_provider_user_id
           ORDER BY id
       ) AS duplicate_rank
FROM users
WHERE social_provider IS NOT NULL
  AND social_provider_user_id IS NOT NULL;

UPDATE users u
JOIN tmp_users_social_account_rank ranked
    ON ranked.id = u.id
SET u.social_provider_user_id = CONCAT(
        LEFT(
            u.social_provider_user_id,
            GREATEST(0, 160 - CHAR_LENGTH(CONCAT('#dup-', u.id)))
        ),
        '#dup-',
        u.id
    )
WHERE ranked.duplicate_rank > 1;

DROP TEMPORARY TABLE tmp_users_social_account_rank;

ALTER TABLE users
    DROP INDEX idx_users_social_provider,
    ADD UNIQUE KEY uq_users_display_name (display_name),
    ADD UNIQUE KEY uq_users_social_provider_user_id (social_provider, social_provider_user_id);

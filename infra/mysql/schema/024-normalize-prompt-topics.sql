-- Normalize prompt topics into reference tables.
-- 1. Create prompt_topic_categories / prompt_topic_details
-- 2. Add prompts.topic_detail_id foreign key
-- 3. Extract real category/detail pairs from prompts
-- 4. Backfill prompts.topic_detail_id from normalized topic tables
-- 5. Drop legacy topic/topic_category/topic_detail columns

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_normalize_prompt_topics $$
CREATE PROCEDURE sp_writeloop_normalize_prompt_topics()
BEGIN
    CREATE TABLE IF NOT EXISTS prompt_topic_categories (
        id BIGINT NOT NULL AUTO_INCREMENT,
        name VARCHAR(80) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uk_prompt_topic_categories_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS prompt_topic_details (
        id BIGINT NOT NULL AUTO_INCREMENT,
        category_id BIGINT NOT NULL,
        name VARCHAR(120) NOT NULL,
        display_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY uk_prompt_topic_details_category_name (category_id, name),
        KEY idx_prompt_topic_details_category_id (category_id),
        CONSTRAINT fk_prompt_topic_details_category
            FOREIGN KEY (category_id) REFERENCES prompt_topic_categories (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    ALTER TABLE prompt_topic_categories
        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    ALTER TABLE prompt_topic_details
        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_detail_id'
    ) THEN
        ALTER TABLE prompts
            ADD COLUMN topic_detail_id BIGINT NULL AFTER id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND INDEX_NAME = 'idx_prompts_topic_detail_id'
    ) THEN
        ALTER TABLE prompts
            ADD INDEX idx_prompts_topic_detail_id (topic_detail_id);
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_prompt_topic_detail_dedup;
    CREATE TEMPORARY TABLE tmp_prompt_topic_detail_dedup (
        keep_id BIGINT NOT NULL,
        category_id BIGINT NOT NULL,
        detail_name VARCHAR(120) NOT NULL,
        PRIMARY KEY (keep_id, category_id, detail_name)
    ) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    INSERT INTO tmp_prompt_topic_detail_dedup (keep_id, category_id, detail_name)
    SELECT MIN(id) AS keep_id,
           category_id,
           name
    FROM prompt_topic_details
    GROUP BY category_id, name
    HAVING COUNT(*) > 1;

    UPDATE prompts prompt
    JOIN prompt_topic_details detail
      ON prompt.topic_detail_id = detail.id
    JOIN tmp_prompt_topic_detail_dedup dedup
      ON dedup.category_id = detail.category_id
     AND dedup.detail_name = detail.name
    SET prompt.topic_detail_id = dedup.keep_id
    WHERE detail.id <> dedup.keep_id;

    DELETE detail
    FROM prompt_topic_details detail
    JOIN tmp_prompt_topic_detail_dedup dedup
      ON dedup.category_id = detail.category_id
     AND dedup.detail_name = detail.name
    WHERE detail.id <> dedup.keep_id;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompt_topic_details'
          AND INDEX_NAME = 'uk_prompt_topic_details_category_name'
    ) THEN
        ALTER TABLE prompt_topic_details
            ADD UNIQUE KEY uk_prompt_topic_details_category_name (category_id, name);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM prompts
        WHERE difficulty IN ('A1', 'A2')
    ) THEN
        UPDATE prompts SET difficulty = 'A' WHERE difficulty IN ('A1', 'A2');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM prompts
        WHERE difficulty IN ('B1', 'B2')
    ) THEN
        UPDATE prompts SET difficulty = 'B' WHERE difficulty IN ('B1', 'B2');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM prompts
        WHERE difficulty IN ('C1', 'C2')
    ) THEN
        UPDATE prompts SET difficulty = 'C' WHERE difficulty IN ('C1', 'C2');
    END IF;

    IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-1') THEN
        UPDATE answer_sessions SET prompt_id = 'prompt-a-4' WHERE prompt_id = 'prompt-1';
        UPDATE coach_interactions SET prompt_id = 'prompt-a-4' WHERE prompt_id = 'prompt-1';

        IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-a-4') THEN
            DELETE FROM prompts WHERE id = 'prompt-1';
        ELSE
            UPDATE prompts
            SET id = 'prompt-a-4',
                difficulty = 'A',
                display_order = 10
            WHERE id = 'prompt-1';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-2') THEN
        UPDATE answer_sessions SET prompt_id = 'prompt-b-4' WHERE prompt_id = 'prompt-2';
        UPDATE coach_interactions SET prompt_id = 'prompt-b-4' WHERE prompt_id = 'prompt-2';

        IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-b-4') THEN
            DELETE FROM prompts WHERE id = 'prompt-2';
        ELSE
            UPDATE prompts
            SET id = 'prompt-b-4',
                difficulty = 'B',
                display_order = 11
            WHERE id = 'prompt-2';
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-3') THEN
        UPDATE answer_sessions SET prompt_id = 'prompt-b-5' WHERE prompt_id = 'prompt-3';
        UPDATE coach_interactions SET prompt_id = 'prompt-b-5' WHERE prompt_id = 'prompt-3';

        IF EXISTS (SELECT 1 FROM prompts WHERE id = 'prompt-b-5') THEN
            DELETE FROM prompts WHERE id = 'prompt-3';
        ELSE
            UPDATE prompts
            SET id = 'prompt-b-5',
                difficulty = 'B',
                display_order = 12
            WHERE id = 'prompt-3';
        END IF;
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_prompt_topics;
    CREATE TEMPORARY TABLE tmp_prompt_topics (
        category_name VARCHAR(80) NOT NULL,
        detail_name VARCHAR(120) NOT NULL,
        prompt_display_order INT NOT NULL
    ) ENGINE=Memory DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_category'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_detail'
    ) THEN
        INSERT INTO tmp_prompt_topics (category_name, detail_name, prompt_display_order)
        SELECT TRIM(topic_category),
               TRIM(topic_detail),
               COALESCE(display_order, 0)
        FROM prompts
        WHERE topic_category IS NOT NULL
          AND TRIM(topic_category) <> ''
          AND topic_detail IS NOT NULL
          AND TRIM(topic_detail) <> '';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic'
    ) THEN
        INSERT INTO tmp_prompt_topics (category_name, detail_name, prompt_display_order)
        SELECT TRIM(SUBSTRING_INDEX(topic, ' - ', 1)),
               TRIM(
                   CASE
                       WHEN LOCATE(' - ', topic) > 0 THEN SUBSTRING(topic, LOCATE(' - ', topic) + 3)
                       ELSE ''
                   END
               ),
               COALESCE(display_order, 0)
        FROM prompts
        WHERE topic IS NOT NULL
          AND TRIM(topic) <> ''
          AND LOCATE(' - ', topic) > 0;
    END IF;

    INSERT INTO prompt_topic_categories (name, display_order, is_active)
    SELECT source.category_name, source.display_order, 1
    FROM (
        SELECT category_name, MIN(prompt_display_order) AS display_order
        FROM tmp_prompt_topics
        WHERE category_name <> ''
        GROUP BY category_name
    ) source
    ON DUPLICATE KEY UPDATE
        display_order = LEAST(prompt_topic_categories.display_order, VALUES(display_order)),
        is_active = VALUES(is_active);

    INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)
    SELECT category.id, source.detail_name, source.display_order, 1
    FROM (
        SELECT category_name, detail_name, MIN(prompt_display_order) AS display_order
        FROM tmp_prompt_topics
        WHERE category_name <> ''
          AND detail_name <> ''
        GROUP BY category_name, detail_name
    ) source
    JOIN prompt_topic_categories category
      ON category.name = source.category_name
    ON DUPLICATE KEY UPDATE
        display_order = LEAST(prompt_topic_details.display_order, VALUES(display_order)),
        is_active = VALUES(is_active);

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_category'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_detail'
    ) THEN
        UPDATE prompts prompt
        JOIN prompt_topic_categories category
          ON TRIM(prompt.topic_category) = category.name
        JOIN prompt_topic_details detail
          ON detail.category_id = category.id
         AND TRIM(prompt.topic_detail) = detail.name
        SET prompt.topic_detail_id = detail.id
        WHERE (prompt.topic_detail_id IS NULL OR prompt.topic_detail_id = 0)
          AND prompt.topic_category IS NOT NULL
          AND TRIM(prompt.topic_category) <> ''
          AND prompt.topic_detail IS NOT NULL
          AND TRIM(prompt.topic_detail) <> '';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic'
    ) THEN
        UPDATE prompts prompt
        JOIN prompt_topic_categories category
          ON TRIM(SUBSTRING_INDEX(prompt.topic, ' - ', 1)) = category.name
        JOIN prompt_topic_details detail
          ON detail.category_id = category.id
         AND TRIM(SUBSTRING(prompt.topic, LOCATE(' - ', prompt.topic) + 3)) = detail.name
        SET prompt.topic_detail_id = detail.id
        WHERE (prompt.topic_detail_id IS NULL OR prompt.topic_detail_id = 0)
          AND prompt.topic IS NOT NULL
          AND LOCATE(' - ', prompt.topic) > 0;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic'
    ) THEN
        ALTER TABLE prompts DROP COLUMN topic;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_category'
    ) THEN
        ALTER TABLE prompts DROP COLUMN topic_category;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND COLUMN_NAME = 'topic_detail'
    ) THEN
        ALTER TABLE prompts DROP COLUMN topic_detail;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM prompts
        WHERE topic_detail_id IS NULL OR topic_detail_id = 0
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'prompts'
              AND CONSTRAINT_NAME = 'fk_prompts_topic_detail'
        ) THEN
            ALTER TABLE prompts
                DROP FOREIGN KEY fk_prompts_topic_detail;
        END IF;

        ALTER TABLE prompts
            MODIFY COLUMN topic_detail_id BIGINT NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'prompts'
          AND CONSTRAINT_NAME = 'fk_prompts_topic_detail'
    ) THEN
        ALTER TABLE prompts
            ADD CONSTRAINT fk_prompts_topic_detail
                FOREIGN KEY (topic_detail_id) REFERENCES prompt_topic_details (id);
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_prompt_topics;
    DROP TEMPORARY TABLE IF EXISTS tmp_prompt_topic_detail_dedup;
END $$

CALL sp_writeloop_normalize_prompt_topics() $$
DROP PROCEDURE IF EXISTS sp_writeloop_normalize_prompt_topics $$

DELIMITER ;

-- Classify the 400 intro foundation prompts into distinct beginner-facing topic categories.
-- Keeps the original prompt questions and hint data intact.

SET NAMES utf8mb4;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_category_ranges;
CREATE TEMPORARY TABLE tmp_intro_v2_category_ranges (
    start_no INT NOT NULL,
    end_no INT NOT NULL,
    category_name VARCHAR(120) NOT NULL,
    detail_name VARCHAR(120) NOT NULL,
    category_order INT NOT NULL,
    detail_order INT NOT NULL,
    PRIMARY KEY (start_no, end_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tmp_intro_v2_category_ranges (start_no, end_no, category_name, detail_name, category_order, detail_order)
VALUES
    (1, 20, 'Intro Self', 'Self and Basics', 501, 1),
    (21, 40, 'Intro Routine', 'Daily Routine', 502, 2),
    (41, 60, 'Intro Food', 'Food and Drinks', 503, 3),
    (61, 80, 'Intro Hobbies', 'Hobbies and Fun', 504, 4),
    (81, 100, 'Intro People', 'Friends and People', 505, 5),
    (101, 120, 'Intro Study and Work', 'Study and Work', 506, 6),
    (121, 140, 'Intro Home and Places', 'Home and Places', 507, 7),
    (141, 160, 'Intro Travel', 'Travel', 508, 8),
    (161, 180, 'Intro Feelings', 'Feelings and Weather', 509, 9),
    (181, 200, 'Intro Future', 'Future and Imagination', 510, 10),
    (201, 220, 'Intro Favorites', 'Favorites and Objects', 511, 11),
    (221, 240, 'Intro Childhood', 'Childhood Memories', 512, 12),
    (241, 260, 'Intro Digital Life', 'Phone and Internet', 513, 13),
    (261, 280, 'Intro Shopping', 'Shopping and Money', 514, 14),
    (281, 300, 'Intro Health', 'Health and Exercise', 515, 15),
    (301, 320, 'Intro Entertainment', 'Movies Music Stories', 516, 16),
    (321, 340, 'Intro Choices', 'Simple Choices', 517, 17),
    (341, 360, 'Intro Goals', 'Goals and Habits', 518, 18),
    (361, 380, 'Intro Social', 'Social Situations', 519, 19),
    (381, 400, 'Intro Imagination', 'Imagination', 520, 20);

INSERT INTO prompt_topic_categories (name, display_order, is_active)
SELECT category_name, category_order, 1
FROM tmp_intro_v2_category_ranges
ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)
SELECT category.id, ranges.detail_name, ranges.detail_order, 1
FROM tmp_intro_v2_category_ranges ranges
JOIN prompt_topic_categories category ON category.name = ranges.category_name
ON DUPLICATE KEY UPDATE
    display_order = VALUES(display_order),
    is_active = VALUES(is_active);

UPDATE prompts prompt
JOIN tmp_intro_v2_category_ranges ranges
  ON CAST(SUBSTRING(prompt.id, 17) AS UNSIGNED) BETWEEN ranges.start_no AND ranges.end_no
JOIN prompt_topic_categories category
  ON category.name = ranges.category_name
JOIN prompt_topic_details detail
  ON detail.category_id = category.id
 AND detail.name = ranges.detail_name
SET prompt.topic_detail_id = detail.id
WHERE prompt.id LIKE 'prompt-intro-v2-%'
  AND prompt.difficulty = 'I';

UPDATE prompt_topic_details detail
JOIN prompt_topic_categories category ON category.id = detail.category_id
SET detail.is_active = 0
WHERE category.name = 'Intro Foundation';

UPDATE prompt_topic_categories
SET is_active = 0
WHERE name = 'Intro Foundation';

DROP TEMPORARY TABLE IF EXISTS tmp_intro_v2_category_ranges;

COMMIT;

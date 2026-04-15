-- 036-dedupe-paraphrased-prompts.sql
--
-- Keep only one active prompt per topic_detail_id.
-- Canonical prompt selection rule:
-- 1. Lowest display_order
-- 2. Lowest id when display_order ties
--
-- This removes same-meaning paraphrase variants such as:
-- - prompt-preference-06..10
-- - prompt-routine-06..10
-- - prompt-goal-01..05
-- while preserving one representative prompt for each topic/detail.

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_keep_ids;

CREATE TEMPORARY TABLE tmp_prompt_keep_ids (
    topic_detail_id BIGINT NOT NULL PRIMARY KEY,
    keep_id VARCHAR(64)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_prompt_keep_ids (topic_detail_id, keep_id)
SELECT candidate.topic_detail_id, MIN(candidate.id) AS keep_id
FROM prompts candidate
JOIN (
    SELECT topic_detail_id, MIN(display_order) AS min_display_order
    FROM prompts
    WHERE is_active = 1
      AND topic_detail_id IS NOT NULL
    GROUP BY topic_detail_id
) first_pick
  ON first_pick.topic_detail_id = candidate.topic_detail_id
 AND first_pick.min_display_order = candidate.display_order
WHERE candidate.is_active = 1
  AND candidate.topic_detail_id IS NOT NULL
GROUP BY candidate.topic_detail_id;

UPDATE prompts p
JOIN (
    SELECT topic_detail_id
    FROM prompts
    WHERE is_active = 1
      AND topic_detail_id IS NOT NULL
    GROUP BY topic_detail_id
    HAVING COUNT(*) > 1
) dup
  ON dup.topic_detail_id = p.topic_detail_id
JOIN tmp_prompt_keep_ids keep_map
  ON keep_map.topic_detail_id = p.topic_detail_id
SET p.is_active = CASE
    WHEN p.id = keep_map.keep_id THEN 1
    ELSE 0
END
WHERE p.is_active = 1
  AND p.topic_detail_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_prompt_keep_ids;

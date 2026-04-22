UPDATE prompt_topic_details detail
JOIN prompt_topic_categories category
  ON category.id = detail.category_id
SET detail.name = TRIM(SUBSTRING(detail.name, CHAR_LENGTH('Intro Routine - ') + 1))
WHERE category.name = 'Intro Routine'
  AND detail.name LIKE 'Intro Routine - %';

UPDATE prompt_topic_details detail
JOIN prompt_topic_categories category
  ON category.id = detail.category_id
SET detail.name = TRIM(SUBSTRING(detail.name, CHAR_LENGTH('Intro Preference - ') + 1))
WHERE category.name = 'Intro Preference'
  AND detail.name LIKE 'Intro Preference - %';

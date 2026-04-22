UPDATE prompts
SET difficulty = 'I'
WHERE difficulty = 'INTRO';

UPDATE prompt_recommendation_exposures
SET difficulty = 'I'
WHERE difficulty = 'INTRO';

UPDATE coach_interactions
SET prompt_difficulty = 'I'
WHERE prompt_difficulty = 'INTRO';

UPDATE feedback_diagnosis_logs
SET prompt_difficulty = 'I'
WHERE prompt_difficulty = 'INTRO';

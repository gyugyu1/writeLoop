UPDATE prompts
SET difficulty = 'A'
WHERE difficulty IN ('A1', 'A2');

UPDATE prompts
SET difficulty = 'B'
WHERE difficulty IN ('B1', 'B2');

UPDATE prompts
SET difficulty = 'C'
WHERE difficulty IN ('C1', 'C2');

UPDATE answer_sessions
SET prompt_id = 'prompt-a-4'
WHERE prompt_id = 'prompt-1';

UPDATE prompts
SET id = 'prompt-a-4',
    difficulty = 'A',
    display_order = 10
WHERE id = 'prompt-1';

UPDATE answer_sessions
SET prompt_id = 'prompt-b-4'
WHERE prompt_id = 'prompt-2';

UPDATE prompts
SET id = 'prompt-b-4',
    difficulty = 'B',
    display_order = 11
WHERE id = 'prompt-2';

UPDATE answer_sessions
SET prompt_id = 'prompt-b-5'
WHERE prompt_id = 'prompt-3';

UPDATE prompts
SET id = 'prompt-b-5',
    difficulty = 'B',
    display_order = 12
WHERE id = 'prompt-3';

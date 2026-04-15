-- Align prompt counts by deactivating the duplicate Travel Destination prompt that only exists in production.
-- Safe to run in local and production. Local is a no-op because prompt-b-4 is absent there.

SET NAMES utf8mb4;

START TRANSACTION;

UPDATE prompt_hints
SET is_active = 0
WHERE prompt_id = 'prompt-b-4';

UPDATE prompts
SET is_active = 0
WHERE id = 'prompt-b-4';

COMMIT;

ALTER TABLE answer_attempts
ADD COLUMN feedback_payload_json JSON NULL AFTER rewrite_challenge;

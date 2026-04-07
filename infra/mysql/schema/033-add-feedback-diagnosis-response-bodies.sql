ALTER TABLE feedback_diagnosis_logs
    ADD COLUMN IF NOT EXISTS diagnosis_response_body_json JSON NULL AFTER regeneration_response_status_code,
    ADD COLUMN IF NOT EXISTS generation_response_body_json JSON NULL AFTER diagnosis_response_body_json,
    ADD COLUMN IF NOT EXISTS regeneration_response_body_json JSON NULL AFTER generation_response_body_json;

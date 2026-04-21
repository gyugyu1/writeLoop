CREATE TABLE prompt_recommendation_exposures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recommended_date DATE NOT NULL,
    user_id BIGINT NULL,
    guest_id VARCHAR(128) NULL,
    difficulty VARCHAR(16) NOT NULL,
    prompt_id VARCHAR(64) NOT NULL,
    slot_type VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    score INT NOT NULL,
    shown_at DATETIME(6) NOT NULL,
    clicked_at DATETIME(6) NULL,
    started_session_id VARCHAR(64) NULL,
    completed_session_id VARCHAR(64) NULL,
    PRIMARY KEY (id),
    KEY idx_prompt_reco_user_date (user_id, recommended_date),
    KEY idx_prompt_reco_guest_date (guest_id, recommended_date),
    KEY idx_prompt_reco_prompt_date (prompt_id, recommended_date)
);

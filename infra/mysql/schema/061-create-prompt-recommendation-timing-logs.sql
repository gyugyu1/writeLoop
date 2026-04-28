CREATE TABLE IF NOT EXISTS prompt_recommendation_timing_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    trace_id VARCHAR(64) NOT NULL,
    endpoint_type VARCHAR(32) NOT NULL,
    phase VARCHAR(80) NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    user_id BIGINT NULL,
    guest_id VARCHAR(64) NULL,
    exclude_count INT NULL,
    candidate_count INT NULL,
    result_count INT NULL,
    fallback_used BIT(1) NULL,
    elapsed_ms BIGINT NOT NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_prompt_reco_timing_trace (trace_id),
    KEY idx_prompt_reco_timing_endpoint_created (endpoint_type, created_at),
    KEY idx_prompt_reco_timing_phase_created (phase, created_at),
    KEY idx_prompt_reco_timing_difficulty_created (difficulty, created_at),
    KEY idx_prompt_reco_timing_user_created (user_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

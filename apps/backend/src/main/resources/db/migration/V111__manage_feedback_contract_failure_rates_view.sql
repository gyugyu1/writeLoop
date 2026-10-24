-- 문장 피드백 계약 실패율 집계 뷰. Flyway 이전(infra/mysql/schema)에 운영에서 만들어져 기준선(V107)에 빠져 있었다.
-- V110이 thinking_budget 열을 지우자 이 뷰가 깨졌고, 깨진 뷰 때문에 배포 전 DB 백업(mysqldump)이 실패했다(2026-10-24).
-- 운영에서는 thinking_budget을 뺀 정의로 먼저 고쳤고, 이 마이그레이션으로 Flyway가 관리하게 한다(빈 DB에도 만든다).

CREATE OR REPLACE VIEW feedback_contract_failure_rates AS
SELECT
    prompt_id,
    input_fingerprint,
    llm_provider AS provider,
    llm_model AS model,
    reasoning_effort,
    COUNT(*) AS execution_count,
    SUM(CASE WHEN contract_violation_detected = 1 THEN 1 ELSE 0 END) AS initial_contract_failure_count,
    ROUND(SUM(CASE WHEN contract_violation_detected = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 4)
        AS initial_contract_failure_rate,
    SUM(CASE WHEN retry_attempted = 1 THEN 1 ELSE 0 END) AS retry_attempt_count,
    SUM(CASE WHEN contract_retry_succeeded = 1 THEN 1 ELSE 0 END) AS retry_recovered_count,
    ROUND(
        SUM(CASE WHEN contract_retry_succeeded = 1 THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN retry_attempted = 1 THEN 1 ELSE 0 END), 0),
        4
    ) AS retry_recovery_rate,
    SUM(CASE WHEN contract_violation_detected = 1 AND execution_status = 'FAILED' THEN 1 ELSE 0 END)
        AS final_contract_failure_count,
    ROUND(
        SUM(CASE WHEN contract_violation_detected = 1 AND execution_status = 'FAILED' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*), 0),
        4
    ) AS final_contract_failure_rate,
    MAX(created_at) AS last_executed_at
FROM feedback_diagnosis_logs
GROUP BY prompt_id, input_fingerprint, llm_provider, llm_model, reasoning_effort;

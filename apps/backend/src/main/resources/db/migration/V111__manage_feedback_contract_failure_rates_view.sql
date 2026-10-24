-- 문장 피드백 계약 실패율 집계 뷰(infra/mysql/schema/098에서 만들었고 기준선 V107에도 있다).
-- 이 뷰가 thinking_budget 열을 참조해서, V110이 그 열을 지우자 뷰가 깨졌다. 깨진 뷰 때문에 배포 전 DB 백업(mysqldump)이
-- 실패해 배포가 멈췄다(2026-10-24). 운영은 thinking_budget을 뺀 같은 정의로 먼저 고쳤고, 이 마이그레이션이 그 정의를 기록한다.
-- 빈 DB에서도 V107이 만든 뷰가 V110 뒤에 깨진 상태로 남으므로 여기서 다시 만든다.

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

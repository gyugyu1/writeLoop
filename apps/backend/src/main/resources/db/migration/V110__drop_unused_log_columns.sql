-- 값이 하나도 없고 코드도 쓰지 않는 로그 열을 지운다.
-- - coach_interactions.evaluation_*: 지운 코치 평가 기능의 열(ADR-0017). 엔티티에서는 434a0eb에서 뺐다.
-- - *.thinking_budget: Gemini 전용 설정이었다. 코드에서는 ed86696에서 뺐다.
-- 두 커밋이 운영에 배포된 뒤(c5e4549, 2026-10-24) 지운다. 이 마이그레이션 뒤에는 c5e4549 이전 이미지로 되돌리면
-- 엔티티 검증(ddl-auto: validate)에 실패하므로, 되돌릴 때는 c5e4549 이후 커밋을 쓴다.

ALTER TABLE coach_interactions
    DROP INDEX idx_coach_interactions_eval_status_created,
    DROP COLUMN evaluation_status,
    DROP COLUMN evaluation_score,
    DROP COLUMN evaluation_verdict,
    DROP COLUMN evaluation_summary,
    DROP COLUMN evaluation_model,
    DROP COLUMN evaluation_payload_json,
    DROP COLUMN evaluated_at;

ALTER TABLE feedback_diagnosis_logs
    DROP COLUMN thinking_budget;

ALTER TABLE feedback_timing_logs
    DROP COLUMN thinking_budget;

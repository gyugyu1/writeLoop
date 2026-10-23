-- 기능별 LLM 비용을 보려고 단계 시간 로그의 LLM 단계 행에 토큰 사용량을 남긴다.
-- 지금까지는 문장 피드백만 진단 로그에 토큰을 남겨서 영어일기, Now in English, 코치의 비용을 알 수 없었다.
-- 이전 코드는 이 열을 쓰지 않으므로, 이 마이그레이션 뒤 이전 이미지로 되돌려도 기동한다.

ALTER TABLE feedback_timing_logs
    ADD COLUMN llm_input_tokens BIGINT NULL AFTER exception_class,
    ADD COLUMN llm_cached_input_tokens BIGINT NULL AFTER llm_input_tokens,
    ADD COLUMN llm_output_tokens BIGINT NULL AFTER llm_cached_input_tokens,
    ADD COLUMN llm_reasoning_tokens BIGINT NULL AFTER llm_output_tokens,
    ADD COLUMN llm_total_tokens BIGINT NULL AFTER llm_reasoning_tokens;

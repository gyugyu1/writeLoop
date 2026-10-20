-- 더 이상 읽지 않는 피드백 중복 컬럼을 NULL 허용으로 바꾼다.
-- 같은 내용은 answer_attempts.feedback_payload_json과 prompt 원본에 남아 있다.
-- 새 백엔드는 이 컬럼에 값을 쓰지 않으므로 반드시 새 백엔드 배포 전에 적용한다.
-- 기존 백엔드는 계속 값을 채워 넣으므로 먼저 적용해도 동작에 영향이 없다.
-- 컬럼 삭제는 새 백엔드 배포 후 107-drop-unused-feedback-columns.sql로 진행한다.

ALTER TABLE answer_attempts
    MODIFY COLUMN strengths_json JSON NULL,
    MODIFY COLUMN corrections_json JSON NULL,
    MODIFY COLUMN model_answer TEXT COLLATE utf8mb4_unicode_ci NULL,
    MODIFY COLUMN rewrite_challenge TEXT COLLATE utf8mb4_unicode_ci NULL;

ALTER TABLE coach_interactions
    MODIFY COLUMN prompt_hints_json JSON NULL;

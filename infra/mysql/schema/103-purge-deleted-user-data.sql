-- 탈퇴(삭제)된 사용자에게 연결된 채로 남은 데이터를 정리한다.
-- 이전 탈퇴 처리는 로그·의견·토큰 테이블을 지우지 않았고, 일기·지금 영어로는 DB CASCADE에만 의존했다.
-- user_id가 NULL인 비회원(guest) 행은 건드리지 않는다. 다시 실행해도 결과가 같다.
-- 적용 전 DB를 백업하고 scripts/db/check-deleted-user-data.sql로 삭제 대상 수를 확인한다.

START TRANSACTION;

-- 하위 기록을 먼저 지운다.
DELETE t FROM answer_attempts t
LEFT JOIN answer_sessions s ON s.id = t.session_id
LEFT JOIN users u ON u.id = s.user_id
WHERE s.id IS NULL OR (s.user_id IS NOT NULL AND u.id IS NULL);

DELETE t FROM answer_sessions t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM diary_attempts t
LEFT JOIN diary_entries e ON e.id = t.entry_id
LEFT JOIN users u ON u.id = e.user_id
WHERE e.id IS NULL OR u.id IS NULL;

DELETE t FROM diary_entries t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM now_in_english_entries t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM now_in_english_reflections t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM coach_interactions t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM saved_expressions t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM user_feedback t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM feedback_diagnosis_logs t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM feedback_timing_logs t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM prompt_recommendation_exposures t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM prompt_recommendation_timing_logs t
LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL;

DELETE t FROM email_verification_tokens t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM password_reset_tokens t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

DELETE t FROM remember_login_tokens t
LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

COMMIT;

-- 읽기 전용 점검: 탈퇴(삭제)된 사용자에게 연결된 채로 남은 행 수와 users FK 상태를 확인한다.
-- 103-purge-deleted-user-data.sql 적용 전후에 실행해 결과를 비교한다. 데이터를 변경하지 않는다.

SELECT 'answer_sessions' AS table_name, COUNT(*) AS orphan_rows
FROM answer_sessions t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'answer_attempts', COUNT(*)
FROM answer_attempts t LEFT JOIN answer_sessions s ON s.id = t.session_id
LEFT JOIN users u ON u.id = s.user_id
WHERE s.id IS NULL OR (s.user_id IS NOT NULL AND u.id IS NULL)
UNION ALL
SELECT 'diary_entries', COUNT(*)
FROM diary_entries t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'diary_attempts', COUNT(*)
FROM diary_attempts t LEFT JOIN diary_entries e ON e.id = t.entry_id
LEFT JOIN users u ON u.id = e.user_id
WHERE e.id IS NULL OR u.id IS NULL
UNION ALL
SELECT 'now_in_english_entries', COUNT(*)
FROM now_in_english_entries t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'now_in_english_reflections', COUNT(*)
FROM now_in_english_reflections t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'coach_interactions', COUNT(*)
FROM coach_interactions t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'saved_expressions', COUNT(*)
FROM saved_expressions t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'user_feedback', COUNT(*)
FROM user_feedback t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'feedback_diagnosis_logs', COUNT(*)
FROM feedback_diagnosis_logs t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'feedback_timing_logs', COUNT(*)
FROM feedback_timing_logs t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'prompt_recommendation_exposures', COUNT(*)
FROM prompt_recommendation_exposures t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'prompt_recommendation_timing_logs', COUNT(*)
FROM prompt_recommendation_timing_logs t LEFT JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'email_verification_tokens', COUNT(*)
FROM email_verification_tokens t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'password_reset_tokens', COUNT(*)
FROM password_reset_tokens t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL
UNION ALL
SELECT 'remember_login_tokens', COUNT(*)
FROM remember_login_tokens t LEFT JOIN users u ON u.id = t.user_id
WHERE u.id IS NULL;

-- users를 참조하는 FK와 삭제 규칙. diary_entries, now_in_english_entries,
-- now_in_english_reflections가 CASCADE로 나오지 않으면 그동안 탈퇴 시 해당 데이터가 남았던 것이다.
SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME = 'users'
ORDER BY TABLE_NAME;

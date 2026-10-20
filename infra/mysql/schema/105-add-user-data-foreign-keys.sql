-- 사용자 데이터 테이블에 외래 키를 추가해 끊어진 참조가 생기지 않게 한다.
-- 사용자 소유 데이터는 users 삭제 시 함께 삭제(CASCADE)하고,
-- 질문(prompts)은 삭제하지 않고 비활성화하므로 answer_sessions는 기본 동작(RESTRICT)으로 보호한다.
-- 출처 정보로만 쓰는 선택 참조는 대상이 지워지면 NULL로 바꾼다(SET NULL).
--
-- 추가하지 않는 참조:
-- - coach_interactions.prompt_id: 일기·지금 영어로 코치가 가상 질문 ID(diary-free-writing)를 쓴다.
-- - 로그 테이블(feedback_*, prompt_recommendation_*): 원인 분석용 기록이라 참조 대상과 수명을 묶지 않는다.
--
-- 끊어진 참조가 하나라도 있으면 아무 것도 바꾸지 않고 중단한다.
-- 이미 같은 이름의 외래 키가 있으면 건너뛰므로 다시 실행해도 결과가 같다.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_assert_no_orphans $$
CREATE PROCEDURE sp_writeloop_assert_no_orphans()
BEGIN
    DECLARE orphan_count BIGINT DEFAULT 0;

    SELECT
        (SELECT COUNT(*) FROM answer_attempts t LEFT JOIN answer_sessions p ON p.id = t.session_id
            WHERE p.id IS NULL)
      + (SELECT COUNT(*) FROM answer_sessions t LEFT JOIN users p ON p.id = t.user_id
            WHERE t.user_id IS NOT NULL AND p.id IS NULL)
      + (SELECT COUNT(*) FROM answer_sessions t LEFT JOIN prompts p ON p.id = t.prompt_id
            WHERE p.id IS NULL)
      + (SELECT COUNT(*) FROM coach_interactions t LEFT JOIN users p ON p.id = t.user_id
            WHERE t.user_id IS NOT NULL AND p.id IS NULL)
      + (SELECT COUNT(*) FROM coach_interactions t LEFT JOIN answer_sessions p ON p.id = t.answer_session_id
            WHERE t.answer_session_id IS NOT NULL AND p.id IS NULL)
      + (SELECT COUNT(*) FROM saved_expressions t LEFT JOIN users p ON p.id = t.user_id
            WHERE p.id IS NULL)
      + (SELECT COUNT(*) FROM saved_expressions t LEFT JOIN prompts p ON p.id = t.prompt_id
            WHERE t.prompt_id IS NOT NULL AND p.id IS NULL)
      + (SELECT COUNT(*) FROM saved_expressions t LEFT JOIN answer_sessions p ON p.id = t.answer_session_id
            WHERE t.answer_session_id IS NOT NULL AND p.id IS NULL)
      + (SELECT COUNT(*) FROM email_verification_tokens t LEFT JOIN users p ON p.id = t.user_id
            WHERE p.id IS NULL)
      + (SELECT COUNT(*) FROM password_reset_tokens t LEFT JOIN users p ON p.id = t.user_id
            WHERE p.id IS NULL)
      + (SELECT COUNT(*) FROM remember_login_tokens t LEFT JOIN users p ON p.id = t.user_id
            WHERE p.id IS NULL)
    INTO orphan_count;

    IF orphan_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Orphaned rows exist. Run 103-purge-deleted-user-data.sql and check-deleted-user-data.sql first.';
    END IF;
END $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_foreign_key_if_missing $$
CREATE PROCEDURE sp_writeloop_add_foreign_key_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_constraint_name VARCHAR(64),
    IN p_constraint_definition VARCHAR(512)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS tc
        WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
          AND tc.TABLE_NAME = p_table_name
          AND tc.CONSTRAINT_NAME = p_constraint_name
          AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        SET @writeloop_add_fk_sql = CONCAT(
            'ALTER TABLE `', p_table_name, '` ADD CONSTRAINT `', p_constraint_name, '` ', p_constraint_definition
        );
        PREPARE writeloop_add_fk_stmt FROM @writeloop_add_fk_sql;
        EXECUTE writeloop_add_fk_stmt;
        DEALLOCATE PREPARE writeloop_add_fk_stmt;
    END IF;
END $$

CALL sp_writeloop_assert_no_orphans() $$

CALL sp_writeloop_add_foreign_key_if_missing('answer_sessions', 'fk_answer_sessions_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$
CALL sp_writeloop_add_foreign_key_if_missing('answer_sessions', 'fk_answer_sessions_prompt',
    'FOREIGN KEY (`prompt_id`) REFERENCES `prompts` (`id`)') $$
CALL sp_writeloop_add_foreign_key_if_missing('answer_attempts', 'fk_answer_attempts_session',
    'FOREIGN KEY (`session_id`) REFERENCES `answer_sessions` (`id`) ON DELETE CASCADE') $$

CALL sp_writeloop_add_foreign_key_if_missing('coach_interactions', 'fk_coach_interactions_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$
CALL sp_writeloop_add_foreign_key_if_missing('coach_interactions', 'fk_coach_interactions_answer_session',
    'FOREIGN KEY (`answer_session_id`) REFERENCES `answer_sessions` (`id`) ON DELETE SET NULL') $$

CALL sp_writeloop_add_foreign_key_if_missing('saved_expressions', 'fk_saved_expressions_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$
CALL sp_writeloop_add_foreign_key_if_missing('saved_expressions', 'fk_saved_expressions_prompt',
    'FOREIGN KEY (`prompt_id`) REFERENCES `prompts` (`id`) ON DELETE SET NULL') $$
CALL sp_writeloop_add_foreign_key_if_missing('saved_expressions', 'fk_saved_expressions_answer_session',
    'FOREIGN KEY (`answer_session_id`) REFERENCES `answer_sessions` (`id`) ON DELETE SET NULL') $$

CALL sp_writeloop_add_foreign_key_if_missing('email_verification_tokens', 'fk_email_verification_tokens_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$
CALL sp_writeloop_add_foreign_key_if_missing('password_reset_tokens', 'fk_password_reset_tokens_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$
CALL sp_writeloop_add_foreign_key_if_missing('remember_login_tokens', 'fk_remember_login_tokens_user',
    'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE') $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_foreign_key_if_missing $$
DROP PROCEDURE IF EXISTS sp_writeloop_assert_no_orphans $$

DELIMITER ;

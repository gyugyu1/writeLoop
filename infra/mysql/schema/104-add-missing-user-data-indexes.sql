-- 운영 DB에서 빠져 있던 인덱스를 추가한다.
-- password_reset_tokens는 Hibernate 자동 생성으로 만들어져 010의 인덱스가 적용되지 않았다.
-- 로그 테이블의 user_id 인덱스는 회원 탈퇴 시 사용자 단위 삭제에 사용된다.
-- 이미 같은 이름의 인덱스가 있으면 건너뛰므로 다시 실행해도 결과가 같다.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_index_if_missing $$
CREATE PROCEDURE sp_writeloop_add_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_columns VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.STATISTICS s
        WHERE s.TABLE_SCHEMA = DATABASE()
          AND s.TABLE_NAME = p_table_name
          AND s.INDEX_NAME = p_index_name
    ) THEN
        SET @writeloop_add_index_sql = CONCAT(
            'ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` (', p_index_columns, ')'
        );
        PREPARE writeloop_add_index_stmt FROM @writeloop_add_index_sql;
        EXECUTE writeloop_add_index_stmt;
        DEALLOCATE PREPARE writeloop_add_index_stmt;
    END IF;
END $$

CALL sp_writeloop_add_index_if_missing('password_reset_tokens', 'idx_password_reset_tokens_email_created', '`email`, `created_at`') $$
CALL sp_writeloop_add_index_if_missing('password_reset_tokens', 'idx_password_reset_tokens_user_id', '`user_id`') $$
CALL sp_writeloop_add_index_if_missing('feedback_diagnosis_logs', 'idx_feedback_diag_user', '`user_id`') $$
CALL sp_writeloop_add_index_if_missing('feedback_timing_logs', 'idx_feedback_timing_user', '`user_id`') $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_index_if_missing $$

DELIMITER ;

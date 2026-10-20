-- 읽지 않는 피드백 중복 컬럼을 삭제한다.
-- 주의: 운영에서는 이 컬럼을 쓰지 않는 새 백엔드를 배포한 뒤에 적용한다.
-- 기존 백엔드가 실행 중일 때 적용하면 답변 피드백·코치 기록 저장이 실패한다.
-- 이미 삭제된 컬럼은 건너뛰므로 다시 실행해도 결과가 같다.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_writeloop_drop_column_if_exists $$
CREATE PROCEDURE sp_writeloop_drop_column_if_exists(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64)
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS c
        WHERE c.TABLE_SCHEMA = DATABASE()
          AND c.TABLE_NAME = p_table_name
          AND c.COLUMN_NAME = p_column_name
    ) THEN
        SET @writeloop_drop_column_sql = CONCAT(
            'ALTER TABLE `', p_table_name, '` DROP COLUMN `', p_column_name, '`'
        );
        PREPARE writeloop_drop_column_stmt FROM @writeloop_drop_column_sql;
        EXECUTE writeloop_drop_column_stmt;
        DEALLOCATE PREPARE writeloop_drop_column_stmt;
    END IF;
END $$

CALL sp_writeloop_drop_column_if_exists('answer_attempts', 'score') $$
CALL sp_writeloop_drop_column_if_exists('answer_attempts', 'strengths_json') $$
CALL sp_writeloop_drop_column_if_exists('answer_attempts', 'corrections_json') $$
CALL sp_writeloop_drop_column_if_exists('answer_attempts', 'model_answer') $$
CALL sp_writeloop_drop_column_if_exists('answer_attempts', 'rewrite_challenge') $$
CALL sp_writeloop_drop_column_if_exists('coach_interactions', 'prompt_hints_json') $$

DROP PROCEDURE IF EXISTS sp_writeloop_drop_column_if_exists $$

DELIMITER ;

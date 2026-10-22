-- infra/mysql/schema/064에 정의된 조회용 인덱스 4개가 운영 DB에 없었다.
-- 2026-10-22 운영 DB 구조 비교로 확인했으며, 064가 운영에 적용되지 않은 것으로 보인다.
-- answer_sessions 인덱스는 기록·연속 학습일 조회에, prompts 인덱스는 난이도별 추천 조회에 쓰인다.
-- 같은 이름의 인덱스가 이미 있으면 건너뛰므로, 064를 적용한 DB에서 실행해도 결과가 같다.

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

CALL sp_writeloop_add_index_if_missing('answer_sessions', 'idx_answer_sessions_user_created', '`user_id`, `created_at`') $$
CALL sp_writeloop_add_index_if_missing('answer_sessions', 'idx_answer_sessions_guest_created', '`guest_id`, `created_at`') $$
CALL sp_writeloop_add_index_if_missing('answer_sessions', 'idx_answer_sessions_user_status_updated', '`user_id`, `status`, `updated_at`') $$
CALL sp_writeloop_add_index_if_missing('prompts', 'idx_prompts_active_difficulty_order', '`is_active`, `difficulty`, `display_order`') $$

DROP PROCEDURE IF EXISTS sp_writeloop_add_index_if_missing $$

DELIMITER ;

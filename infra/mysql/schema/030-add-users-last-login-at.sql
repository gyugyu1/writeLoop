SET @last_login_at_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'last_login_at'
);

SET @add_last_login_at_sql := IF(
    @last_login_at_exists = 0,
    'ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL AFTER verified_at',
    'SELECT 1'
);

PREPARE add_last_login_at_stmt FROM @add_last_login_at_sql;
EXECUTE add_last_login_at_stmt;
DEALLOCATE PREPARE add_last_login_at_stmt;

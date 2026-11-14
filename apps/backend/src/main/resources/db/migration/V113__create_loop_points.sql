-- 룹: 쓰기로 모으고 라룹 홈쇼핑에서 쓰는 포인트.
-- loop_point_balances는 계정마다 잔액 한 행이다. 적립·주문은 이 행을 잠가(SELECT ... FOR UPDATE) 계정마다 하나씩 처리한다.
-- loop_point_entries는 들어오고 나간 기록이다. 같은 까닭(reason)과 같은 출처(source_key)는 계정마다 한 번만 남는다.
-- 하루 한도를 넘어 0룹이 된 활동도 0으로 남겨, 다음 날 다시 적립하지 않게 한다.
-- 회원 탈퇴 때 AccountDataPurgeService가 함께 지운다.

CREATE TABLE `loop_point_balances` (
  `user_id` bigint NOT NULL,
  `balance` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_loop_point_balances_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_loop_point_balances_not_negative` CHECK (`balance` >= 0)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `loop_point_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `reason` varchar(32) NOT NULL,
  `source_key` varchar(100) NOT NULL,
  `amount` int NOT NULL,
  `reward_date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_loop_point_entries_source` (`user_id`, `reason`, `source_key`),
  KEY `idx_loop_point_entries_day` (`user_id`, `reason`, `reward_date`),
  CONSTRAINT `fk_loop_point_entries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 라룹 홈쇼핑에서 산 가구 기록. 종류마다 가진 개수는 처음 배치 몫과 이 표의 개수를 더한 것이다.
-- 회원 탈퇴 때 AccountDataPurgeService가 함께 지운다(사용자 행을 지울 때 외래 키로도 지워진다).
CREATE TABLE `home_shopping_orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `furniture_type` varchar(40) NOT NULL,
  `price` int NOT NULL,
  `item_id` varchar(40) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_home_shopping_orders_user_type` (`user_id`, `furniture_type`),
  CONSTRAINT `fk_home_shopping_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 홈쇼핑부터 가구는 산 만큼만 둔다. 개발용으로 마음대로 더한 가구가 남지 않게, 저장된 배치를 지워 모두 처음 배치에서 시작한다.
-- 운영에는 아직 로비 배치 데이터가 없다(로비를 처음 배포하는 때 V112와 함께 적용된다).
DELETE FROM `lobby_layouts`;

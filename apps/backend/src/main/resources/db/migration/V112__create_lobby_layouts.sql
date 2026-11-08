-- 모바일 홈 로비의 가구 배치를 계정마다 하나 저장한다.
-- layout_json은 앱의 배치 데이터(바닥 가구 넷의 자리·방향, 벽 가구 둘의 벽·자리)이고, shape_version은 그 모양의 버전이다.
-- 회원 탈퇴 때 AccountDataPurgeService가 함께 지운다.

CREATE TABLE `lobby_layouts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `shape_version` int NOT NULL,
  `layout_json` json NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lobby_layouts_user` (`user_id`),
  CONSTRAINT `fk_lobby_layouts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

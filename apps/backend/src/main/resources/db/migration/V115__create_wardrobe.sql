-- 라룹이 착용 아이템(캐릭터 꾸미기): 계정마다 가진 아이템과 부위별로 입은 아이템.
-- 회원 탈퇴 때 AccountDataPurgeService가 함께 지운다(사용자 행을 지울 때 외래 키로도 지워진다).

-- 가진 착용 아이템. 종류마다 하나만 가진다.
CREATE TABLE `wardrobe_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `item_type` varchar(40) NOT NULL,
  `acquired_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wardrobe_items_user_type` (`user_id`, `item_type`),
  CONSTRAINT `fk_wardrobe_items_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 부위별로 입은 아이템(입지 않은 부위는 NULL). 계정마다 한 줄이다.
CREATE TABLE `wardrobe_outfits` (
  `user_id` bigint NOT NULL,
  `hat_item` varchar(40) DEFAULT NULL,
  `top_item` varchar(40) DEFAULT NULL,
  `bottom_item` varchar(40) DEFAULT NULL,
  `shoes_item` varchar(40) DEFAULT NULL,
  `face_item` varchar(40) DEFAULT NULL,
  `back_item` varchar(40) DEFAULT NULL,
  `accessory_item` varchar(40) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_wardrobe_outfits_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

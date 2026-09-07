-- V007：Profile 扩展与密码恢复（M02-F004 / M03-F001）
SET NAMES utf8mb4;

ALTER TABLE `community_profile`
  ADD COLUMN `bio` varchar(500) DEFAULT NULL COMMENT '个人简介' AFTER `display_name`,
  ADD COLUMN `website_url` varchar(512) DEFAULT NULL COMMENT '个人网站链接' AFTER `bio`,
  ADD COLUMN `followers_visibility` varchar(32) NOT NULL DEFAULT 'PRIVATE' COMMENT '关注列表可见性：PUBLIC/PRIVATE' AFTER `visibility`,
  ADD COLUMN `lock_version` bigint NOT NULL DEFAULT 0 COMMENT '乐观锁版本' AFTER `followers_visibility`,
  ADD COLUMN `username_changed_at` timestamp NULL DEFAULT NULL COMMENT '上次改名时间（UTC）' AFTER `lock_version`;

CREATE TABLE IF NOT EXISTS `username_history` (
  `id` varchar(36) NOT NULL COMMENT '记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `username` varchar(32) NOT NULL COMMENT '历史用户名',
  `created_at` timestamp NOT NULL COMMENT '记录时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username_history_name` (`username`),
  KEY `idx_username_history_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户名历史映射';

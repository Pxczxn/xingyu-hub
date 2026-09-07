-- V035：活动报名
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `event_registration` (
  `id` varchar(36) NOT NULL COMMENT '报名标识',
  `event_id` varchar(36) NOT NULL COMMENT '活动标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `status` varchar(32) NOT NULL DEFAULT 'REGISTERED' COMMENT '状态：REGISTERED/CANCELLED',
  `created_at` timestamp NOT NULL COMMENT '报名时间（UTC）',
  `cancelled_at` timestamp NULL COMMENT '取消时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_registration` (`event_id`,`user_id`),
  KEY `idx_event_registration_user` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='活动报名';

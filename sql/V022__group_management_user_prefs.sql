-- V022：群聊管理（公告/入群模式/申请）与用户端偏好存储
SET NAMES utf8mb4;

ALTER TABLE `conversation`
  ADD COLUMN `announcement` text DEFAULT NULL COMMENT '群公告正文' AFTER `title`,
  ADD COLUMN `announcement_updated_at` timestamp NULL DEFAULT NULL COMMENT '群公告更新时间（UTC）' AFTER `announcement`,
  ADD COLUMN `join_mode` varchar(32) NOT NULL DEFAULT 'OPEN' COMMENT '入群模式：OPEN/APPROVAL' AFTER `announcement_updated_at`;

ALTER TABLE `community_profile`
  ADD COLUMN `settings_json` text DEFAULT NULL COMMENT '客户端偏好 JSON（通知/无障碍/搜索历史等）' AFTER `username_changed_at`;

CREATE TABLE IF NOT EXISTS `group_join_request` (
  `id` varchar(36) NOT NULL COMMENT '申请标识',
  `conversation_id` varchar(36) NOT NULL COMMENT '群聊会话标识',
  `user_id` varchar(36) NOT NULL COMMENT '申请人用户标识',
  `message` varchar(512) DEFAULT NULL COMMENT '申请附言',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  `created_at` timestamp NOT NULL COMMENT '申请时间（UTC）',
  `resolved_at` timestamp NULL DEFAULT NULL COMMENT '处理时间（UTC）',
  `resolved_by` varchar(36) DEFAULT NULL COMMENT '处理人用户标识',
  PRIMARY KEY (`id`),
  KEY `idx_group_join_conversation` (`conversation_id`,`status`,`created_at`),
  KEY `idx_group_join_user` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='群聊入群申请';

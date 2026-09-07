-- V023：消息附件字段、收藏消息、群聊入群申请查询优化
SET NAMES utf8mb4;

ALTER TABLE `chat_message`
  ADD COLUMN `message_type` varchar(32) NOT NULL DEFAULT 'TEXT' COMMENT '消息类型：TEXT/IMAGE/FILE' AFTER `body`,
  ADD COLUMN `attachment_url` varchar(1024) DEFAULT NULL COMMENT '附件 URL' AFTER `message_type`,
  ADD COLUMN `attachment_name` varchar(256) DEFAULT NULL COMMENT '附件文件名' AFTER `attachment_url`;

CREATE TABLE IF NOT EXISTS `saved_message` (
  `id` varchar(36) NOT NULL COMMENT '收藏标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `message_id` varchar(36) NOT NULL COMMENT '消息标识',
  `conversation_id` varchar(36) NOT NULL COMMENT '会话标识',
  `created_at` timestamp NOT NULL COMMENT '收藏时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_saved_message_user_message` (`user_id`,`message_id`),
  KEY `idx_saved_message_user` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户收藏的消息';

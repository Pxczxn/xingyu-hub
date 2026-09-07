-- V016：会话与聊天（M5）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `conversation` (
  `id` varchar(36) NOT NULL COMMENT '会话标识',
  `type` varchar(32) NOT NULL COMMENT '类型：DIRECT/GROUP',
  `title` varchar(256) DEFAULT NULL COMMENT '群聊标题',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_conversation_type` (`type`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='聊天会话';

CREATE TABLE IF NOT EXISTS `conversation_member` (
  `id` varchar(36) NOT NULL COMMENT '成员关系标识',
  `conversation_id` varchar(36) NOT NULL COMMENT '会话标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `role` varchar(32) NOT NULL DEFAULT 'MEMBER' COMMENT '角色：OWNER/ADMIN/MEMBER',
  `last_read_sequence` bigint NOT NULL DEFAULT 0 COMMENT '已读消息序号',
  `joined_at` timestamp NOT NULL COMMENT '加入时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conversation_member` (`conversation_id`,`user_id`),
  KEY `idx_conversation_member_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会话成员';

CREATE TABLE IF NOT EXISTS `chat_message` (
  `id` varchar(36) NOT NULL COMMENT '消息标识',
  `conversation_id` varchar(36) NOT NULL COMMENT '会话标识',
  `sender_id` varchar(36) NOT NULL COMMENT '发送者用户标识',
  `sequence_number` bigint NOT NULL COMMENT '会话内序号',
  `body` text NOT NULL COMMENT '消息正文',
  `client_message_id` varchar(64) DEFAULT NULL COMMENT '客户端幂等标识',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chat_message_sequence` (`conversation_id`,`sequence_number`),
  UNIQUE KEY `uk_chat_message_client` (`conversation_id`,`sender_id`,`client_message_id`),
  KEY `idx_chat_message_conversation` (`conversation_id`,`sequence_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='聊天消息';

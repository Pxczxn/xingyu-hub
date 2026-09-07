-- V006：社区会话与再认证（M02-F003）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `community_session` (
  `id` varchar(36) NOT NULL COMMENT '会话稳定标识',
  `user_id` varchar(36) NOT NULL COMMENT '所属用户标识',
  `token_value` varchar(64) NOT NULL COMMENT '会话令牌值',
  `device_label` varchar(128) DEFAULT NULL COMMENT '设备显示名称',
  `user_agent` varchar(512) DEFAULT NULL COMMENT '客户端 User-Agent',
  `ip_hash` varchar(64) DEFAULT NULL COMMENT '来源 IP 哈希',
  `last_active_at` timestamp NOT NULL COMMENT '最近活动时间（UTC）',
  `expires_at` timestamp NOT NULL COMMENT '过期时间（UTC）',
  `revoked_at` timestamp NULL DEFAULT NULL COMMENT '撤销时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_session_token` (`token_value`),
  KEY `idx_community_session_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区用户会话';

CREATE TABLE IF NOT EXISTS `recent_authentication` (
  `id` varchar(36) NOT NULL COMMENT '记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `session_id` varchar(36) NOT NULL COMMENT '会话标识',
  `verified_at` timestamp NOT NULL COMMENT '验证时间（UTC）',
  `expires_at` timestamp NOT NULL COMMENT '有效截止时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_recent_auth_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='近期再认证';

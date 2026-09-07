-- V005：社区账号与资料（M02-F001 / M02-F002）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `community_user` (
  `id` varchar(36) NOT NULL COMMENT '用户稳定标识',
  `email` varchar(255) NOT NULL COMMENT '登录邮箱',
  `password_hash` varchar(100) NOT NULL COMMENT 'BCrypt 密码摘要',
  `email_verified_at` timestamp NULL DEFAULT NULL COMMENT '邮箱验证完成时间（UTC）',
  `status` varchar(32) NOT NULL COMMENT '账号状态：ACTIVE/SUSPENDED/DELETED',
  `terms_version` varchar(32) NOT NULL COMMENT '注册时接受的协议版本',
  `created_at` timestamp NOT NULL COMMENT '注册时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区用户';

CREATE TABLE IF NOT EXISTS `community_profile` (
  `id` varchar(36) NOT NULL COMMENT '资料稳定标识',
  `user_id` varchar(36) NOT NULL COMMENT '所属用户标识',
  `username` varchar(32) NOT NULL COMMENT '用户名（唯一）',
  `display_name` varchar(128) DEFAULT NULL COMMENT '显示名称',
  `visibility` varchar(32) NOT NULL COMMENT '可见性：PRIVATE/PUBLIC 等',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_profile_user` (`user_id`),
  UNIQUE KEY `uk_community_profile_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区用户资料';

CREATE TABLE IF NOT EXISTS `community_creation_space` (
  `id` varchar(36) NOT NULL COMMENT '创作空间稳定标识',
  `user_id` varchar(36) NOT NULL COMMENT '所属用户标识',
  `slug` varchar(32) NOT NULL COMMENT '空间 URL 别名',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_space_user` (`user_id`),
  UNIQUE KEY `uk_community_space_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='个人创作空间';

CREATE TABLE IF NOT EXISTS `email_verification_token` (
  `id` varchar(36) NOT NULL COMMENT '凭据记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '所属用户标识',
  `token_hash` varchar(64) NOT NULL COMMENT '凭据 SHA-256 摘要',
  `purpose` varchar(32) NOT NULL COMMENT '用途：REGISTER/EMAIL_CHANGE',
  `new_email` varchar(255) DEFAULT NULL COMMENT '待确认的新邮箱（变更场景）',
  `expires_at` timestamp NOT NULL COMMENT '过期时间（UTC）',
  `consumed_at` timestamp NULL DEFAULT NULL COMMENT '消费时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_email_verification_user` (`user_id`,`purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='邮箱验证凭据';

CREATE TABLE IF NOT EXISTS `registration_idempotency` (
  `qualified_key` varchar(256) NOT NULL COMMENT '幂等键（动作+作用域+客户端键）',
  `payload_hash` varchar(64) NOT NULL COMMENT '请求载荷摘要',
  `response_json` varchar(4096) NOT NULL COMMENT '首次成功响应 JSON',
  `created_at` timestamp NOT NULL COMMENT '记录时间（UTC）',
  PRIMARY KEY (`qualified_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='注册幂等记录';

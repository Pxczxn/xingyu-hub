-- V024：推荐反馈、定时发布、协作邀请
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `recommendation_feedback` (
  `id` varchar(36) NOT NULL COMMENT '反馈标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `body` text NOT NULL COMMENT '反馈正文',
  `created_at` timestamp NOT NULL COMMENT '提交时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_recommendation_feedback_user` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='推荐反馈';

CREATE TABLE IF NOT EXISTS `collaboration_invite` (
  `id` varchar(36) NOT NULL COMMENT '邀请标识',
  `inviter_id` varchar(36) NOT NULL COMMENT '邀请人用户标识',
  `token` varchar(64) NOT NULL COMMENT '邀请令牌',
  `note` varchar(512) DEFAULT NULL COMMENT '附言',
  `expires_at` timestamp NOT NULL COMMENT '过期时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collaboration_invite_token` (`token`),
  KEY `idx_collaboration_invite_inviter` (`inviter_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作协作邀请';

ALTER TABLE `working_draft`
  ADD COLUMN `scheduled_publish_at` timestamp NULL DEFAULT NULL COMMENT '计划发布时间（UTC）' AFTER `updated_at`;

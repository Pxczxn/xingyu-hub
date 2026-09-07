-- V015：引导、搜索与通知（M4/M5）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `user_onboarding` (
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `step` varchar(64) NOT NULL DEFAULT 'WELCOME' COMMENT '当前引导步骤',
  `interests_json` text COMMENT '兴趣偏好 JSON',
  `completed` tinyint NOT NULL DEFAULT 0 COMMENT '是否完成：0/1',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户引导状态';

CREATE TABLE IF NOT EXISTS `search_document` (
  `id` varchar(36) NOT NULL COMMENT '搜索文档标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/SERIES 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `title` varchar(256) NOT NULL COMMENT '检索标题',
  `summary` varchar(1024) DEFAULT NULL COMMENT '检索摘要',
  `discovery_version` bigint NOT NULL DEFAULT 1 COMMENT '发现版本号',
  `indexed_at` timestamp NOT NULL COMMENT '索引时间（UTC）',
  `removed_at` timestamp DEFAULT NULL COMMENT '移除时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_search_document_object` (`object_type`,`object_id`),
  KEY `idx_search_document_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='搜索文档投影';

CREATE TABLE IF NOT EXISTS `notification` (
  `id` varchar(36) NOT NULL COMMENT '通知标识',
  `user_id` varchar(36) NOT NULL COMMENT '接收用户标识',
  `category` varchar(32) NOT NULL COMMENT '通知类别',
  `title` varchar(256) NOT NULL COMMENT '通知标题',
  `body` varchar(1024) DEFAULT NULL COMMENT '通知正文',
  `read_at` timestamp DEFAULT NULL COMMENT '已读时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_notification_user` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户通知';

CREATE TABLE IF NOT EXISTS `announcement` (
  `id` varchar(36) NOT NULL COMMENT '公告标识',
  `title` varchar(256) NOT NULL COMMENT '公告标题',
  `body` text NOT NULL COMMENT '公告正文',
  `status` varchar(32) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态：DRAFT/PUBLISHED/ARCHIVED',
  `published_at` timestamp NOT NULL COMMENT '发布时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_announcement_status` (`status`,`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台公告';

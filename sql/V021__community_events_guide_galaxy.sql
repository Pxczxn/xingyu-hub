-- V021：社区活动、指南 CMS、星系成员与内容
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `community_event` (
  `id` varchar(36) NOT NULL COMMENT '活动标识',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `title` varchar(256) NOT NULL COMMENT '活动标题',
  `body` text NOT NULL COMMENT '活动正文',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/ARCHIVED',
  `starts_at` timestamp NULL COMMENT '开始时间（UTC）',
  `ends_at` timestamp NULL COMMENT '结束时间（UTC）',
  `submission_open` tinyint NOT NULL DEFAULT 1 COMMENT '是否开放投稿：0/1',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_event_slug` (`slug`),
  KEY `idx_community_event_status` (`status`,`starts_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区活动';

CREATE TABLE IF NOT EXISTS `event_submission` (
  `id` varchar(36) NOT NULL COMMENT '投稿标识',
  `event_id` varchar(36) NOT NULL COMMENT '活动标识',
  `author_id` varchar(36) NOT NULL COMMENT '投稿用户标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/SERIES 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象标识',
  `note` varchar(512) DEFAULT NULL COMMENT '投稿说明',
  `status` varchar(32) NOT NULL DEFAULT 'SUBMITTED' COMMENT '状态：SUBMITTED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_submission` (`event_id`,`author_id`,`object_type`,`object_id`),
  KEY `idx_event_submission_author` (`author_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='活动投稿';

CREATE TABLE IF NOT EXISTS `guide_page` (
  `id` varchar(36) NOT NULL COMMENT '指南页标识',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `title` varchar(256) NOT NULL COMMENT '标题',
  `body` text NOT NULL COMMENT '正文',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序',
  `status` varchar(32) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态：DRAFT/PUBLISHED/ARCHIVED',
  `published_at` timestamp NOT NULL COMMENT '发布时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_guide_page_slug` (`slug`),
  KEY `idx_guide_page_status` (`status`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星语指南页';

CREATE TABLE IF NOT EXISTS `galaxy_member` (
  `id` varchar(36) NOT NULL COMMENT '成员关系标识',
  `galaxy_id` varchar(36) NOT NULL COMMENT '星系标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `role` varchar(32) NOT NULL DEFAULT 'MEMBER' COMMENT '角色：MEMBER/ADMIN',
  `joined_at` timestamp NOT NULL COMMENT '加入时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_galaxy_member` (`galaxy_id`,`user_id`),
  KEY `idx_galaxy_member_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星系成员';

CREATE TABLE IF NOT EXISTS `galaxy_content` (
  `id` varchar(36) NOT NULL COMMENT '内容关联标识',
  `galaxy_id` varchar(36) NOT NULL COMMENT '星系标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型',
  `object_id` varchar(36) NOT NULL COMMENT '对象标识',
  `pinned` tinyint NOT NULL DEFAULT 0 COMMENT '是否置顶：0/1',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_galaxy_content` (`galaxy_id`,`object_type`,`object_id`),
  KEY `idx_galaxy_content_galaxy` (`galaxy_id`,`pinned`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星系内容关联';

INSERT IGNORE INTO `community_event` (`id`, `slug`, `title`, `body`, `status`, `starts_at`, `ends_at`, `submission_open`, `created_at`, `updated_at`) VALUES
('01900000-0000-7000-8000-000000000201', 'welcome-writing', '星语写作季', '欢迎参与星语社区写作活动，分享你的创作故事。投稿已发布的文章或系列即可参与。', 'ACTIVE', UTC_TIMESTAMP(), NULL, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP());

INSERT IGNORE INTO `guide_page` (`id`, `slug`, `title`, `body`, `sort_order`, `status`, `published_at`, `created_at`) VALUES
('01900000-0000-7000-8000-000000000301', 'getting-started', '快速上手', '星语社区是一个以阅读与创作为核心的内容社区。\n\n1. 注册并完善个人资料\n2. 在发现页浏览内容\n3. 进入创作工作台发布文章或系列\n4. 关注感兴趣的创作者', 1, 'PUBLISHED', UTC_TIMESTAMP(), UTC_TIMESTAMP()),
('01900000-0000-7000-8000-000000000302', 'community-rules', '社区公约', '请尊重他人、文明交流，不发布违法违规内容。举报与申诉机制可在治理中心查看。', 2, 'PUBLISHED', UTC_TIMESTAMP(), UTC_TIMESTAMP());

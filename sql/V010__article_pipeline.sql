-- V010：文章流水线（M2 首篇文章闭环）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `article` (
  `id` varchar(36) NOT NULL COMMENT '文章稳定标识',
  `space_id` varchar(36) NOT NULL COMMENT '所属创作空间标识',
  `owner_id` varchar(36) NOT NULL COMMENT '所有者用户标识',
  `category_id` varchar(36) DEFAULT NULL COMMENT '所属分类标识',
  `status` varchar(32) NOT NULL COMMENT '状态：DRAFT/IN_REVIEW/PUBLISHED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_article_space` (`space_id`),
  KEY `idx_article_owner` (`owner_id`),
  KEY `idx_article_category` (`category_id`),
  KEY `idx_article_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章身份壳';

CREATE TABLE IF NOT EXISTS `working_draft` (
  `id` varchar(36) NOT NULL COMMENT '工作草稿标识',
  `article_id` varchar(36) NOT NULL COMMENT '所属文章标识',
  `title` varchar(256) DEFAULT NULL COMMENT '标题',
  `summary` varchar(1024) DEFAULT NULL COMMENT '摘要',
  `body_mode` varchar(32) DEFAULT NULL COMMENT '正文模式：MARKDOWN/RICH_TEXT',
  `body` mediumtext COMMENT '正文',
  `slug` varchar(64) DEFAULT NULL COMMENT 'URL 别名',
  `visibility` varchar(32) NOT NULL DEFAULT 'PRIVATE' COMMENT '可见性：PUBLIC/UNLISTED/PRIVATE',
  `lock_version` bigint NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_working_draft_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章工作草稿';

CREATE TABLE IF NOT EXISTS `formal_revision` (
  `id` varchar(36) NOT NULL COMMENT '正式版本标识',
  `article_id` varchar(36) NOT NULL COMMENT '所属文章标识',
  `revision_number` int NOT NULL COMMENT '版本序号',
  `title` varchar(256) NOT NULL COMMENT '标题',
  `summary` varchar(1024) DEFAULT NULL COMMENT '摘要',
  `body_mode` varchar(32) NOT NULL COMMENT '正文模式：MARKDOWN/RICH_TEXT',
  `body` mediumtext NOT NULL COMMENT '正文',
  `slug` varchar(64) DEFAULT NULL COMMENT 'URL 别名',
  `visibility` varchar(32) NOT NULL COMMENT '可见性：PUBLIC/UNLISTED/PRIVATE',
  `source_draft_lock_version` bigint NOT NULL COMMENT '冻结时草稿锁版本',
  `frozen_at` timestamp NOT NULL COMMENT '冻结时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_formal_revision_article` (`article_id`),
  UNIQUE KEY `uk_formal_revision_number` (`article_id`,`revision_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章正式版本';

CREATE TABLE IF NOT EXISTS `review_submission` (
  `id` varchar(36) NOT NULL COMMENT '审核提交标识',
  `article_id` varchar(36) NOT NULL COMMENT '所属文章标识',
  `formal_revision_id` varchar(36) NOT NULL COMMENT '提交的正式版本标识',
  `submitted_by` varchar(36) NOT NULL COMMENT '提交者用户标识',
  `status` varchar(32) NOT NULL COMMENT '状态：PENDING/APPROVED/REJECTED/WITHDRAWN',
  `submitted_at` timestamp NOT NULL COMMENT '提交时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_review_submission_article` (`article_id`),
  KEY `idx_review_submission_status` (`status`,`submitted_at`),
  KEY `idx_review_submission_revision` (`formal_revision_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章审核提交';

CREATE TABLE IF NOT EXISTS `review_decision` (
  `id` varchar(36) NOT NULL COMMENT '审核决定标识',
  `submission_id` varchar(36) NOT NULL COMMENT '所属审核提交标识',
  `decision` varchar(32) NOT NULL COMMENT '决定：APPROVED/REJECTED',
  `decided_by` varchar(36) NOT NULL COMMENT '审核员用户标识',
  `comment` varchar(1024) DEFAULT NULL COMMENT '审核意见',
  `decided_at` timestamp NOT NULL COMMENT '决定时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_decision_submission` (`submission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章审核决定';

CREATE TABLE IF NOT EXISTS `published_revision` (
  `id` varchar(36) NOT NULL COMMENT '发布记录标识',
  `article_id` varchar(36) NOT NULL COMMENT '所属文章标识',
  `formal_revision_id` varchar(36) NOT NULL COMMENT '已发布正式版本标识',
  `published_at` timestamp NOT NULL COMMENT '发布时间（UTC）',
  `publication_event_id` varchar(64) NOT NULL COMMENT '发布幂等事件标识',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_published_revision_article` (`article_id`),
  UNIQUE KEY `uk_published_revision_event` (`publication_event_id`),
  KEY `idx_published_revision_revision` (`formal_revision_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章已发布版本指针';

CREATE TABLE IF NOT EXISTS `article_topic` (
  `article_id` varchar(36) NOT NULL COMMENT '文章标识',
  `topic_id` varchar(36) NOT NULL COMMENT '话题标识',
  `created_at` timestamp NOT NULL COMMENT '关联时间（UTC）',
  PRIMARY KEY (`article_id`,`topic_id`),
  KEY `idx_article_topic_topic` (`topic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章话题关联';

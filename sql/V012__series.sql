-- V012：系列与阅读状态（M3）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `series` (
  `id` varchar(36) NOT NULL COMMENT '系列稳定标识',
  `owner_id` varchar(36) NOT NULL COMMENT '所有者用户标识',
  `space_id` varchar(36) NOT NULL COMMENT '所属创作空间标识',
  `title` varchar(256) NOT NULL COMMENT '系列标题',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `description` varchar(1024) DEFAULT NULL COMMENT '系列简介',
  `status` varchar(32) NOT NULL COMMENT '状态：ACTIVE/ARCHIVED',
  `lock_version` bigint NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_series_owner_slug` (`owner_id`,`slug`),
  KEY `idx_series_space` (`space_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章系列';

CREATE TABLE IF NOT EXISTS `series_chapter` (
  `id` varchar(36) NOT NULL COMMENT '章节关系标识',
  `series_id` varchar(36) NOT NULL COMMENT '所属系列标识',
  `article_id` varchar(36) NOT NULL COMMENT '关联文章标识',
  `position` int NOT NULL COMMENT '章节序号',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_series_chapter_series_article` (`series_id`,`article_id`),
  UNIQUE KEY `uk_series_chapter_position` (`series_id`,`position`),
  KEY `idx_series_chapter_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系列章节关系';

CREATE TABLE IF NOT EXISTS `series_reader_state` (
  `id` varchar(36) NOT NULL COMMENT '阅读状态标识',
  `series_id` varchar(36) NOT NULL COMMENT '系列标识',
  `user_id` varchar(36) NOT NULL COMMENT '读者用户标识',
  `last_read_article_id` varchar(36) DEFAULT NULL COMMENT '最近阅读文章标识',
  `last_read_at` timestamp DEFAULT NULL COMMENT '最近阅读时间（UTC）',
  `following` tinyint NOT NULL DEFAULT 0 COMMENT '是否追更：0/1',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_series_reader_state` (`series_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系列阅读状态';

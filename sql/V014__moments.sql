-- V014：动态（M3）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `moment` (
  `id` varchar(36) NOT NULL COMMENT '动态稳定标识',
  `author_id` varchar(36) NOT NULL COMMENT '作者用户标识',
  `status` varchar(32) NOT NULL DEFAULT 'PUBLISHED' COMMENT '状态：PUBLISHED/TRASHED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_moment_author` (`author_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='动态';

CREATE TABLE IF NOT EXISTS `moment_revision` (
  `id` varchar(36) NOT NULL COMMENT '动态版本标识',
  `moment_id` varchar(36) NOT NULL COMMENT '所属动态标识',
  `body` text NOT NULL COMMENT '正文',
  `revision_number` int NOT NULL COMMENT '版本序号',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moment_revision` (`moment_id`,`revision_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='动态版本';

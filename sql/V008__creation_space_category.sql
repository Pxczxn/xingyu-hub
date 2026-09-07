-- V008：创作空间分类（M03-F003 / M04-F002）
-- 可重复执行：列/表已存在时自动跳过
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'community_creation_space'
     AND COLUMN_NAME = 'display_name') = 0,
  'ALTER TABLE `community_creation_space` ADD COLUMN `display_name` varchar(128) DEFAULT NULL COMMENT ''空间显示名称'' AFTER `slug`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'community_creation_space'
     AND COLUMN_NAME = 'description') = 0,
  'ALTER TABLE `community_creation_space` ADD COLUMN `description` varchar(500) DEFAULT NULL COMMENT ''空间简介'' AFTER `display_name`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `creation_space_category` (
  `id` varchar(36) NOT NULL COMMENT '分类稳定标识',
  `space_id` varchar(36) NOT NULL COMMENT '所属创作空间标识',
  `name` varchar(128) NOT NULL COMMENT '分类名称',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `status` varchar(32) NOT NULL COMMENT '状态：ACTIVE/ARCHIVED',
  `lock_version` bigint NOT NULL DEFAULT 0 COMMENT '乐观锁版本',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_space_category_slug` (`space_id`,`slug`),
  UNIQUE KEY `uk_space_category_name` (`space_id`,`name`),
  KEY `idx_space_category_space` (`space_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作空间私有分类';

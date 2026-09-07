-- V030：Topic 层级、别名治理与合并审计
-- 可重复执行：列/索引/表已存在时自动跳过
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'topic'
     AND COLUMN_NAME = 'parent_topic_id') = 0,
  'ALTER TABLE `topic` ADD COLUMN `parent_topic_id` varchar(36) DEFAULT NULL COMMENT ''父话题标识（单父层级）'' AFTER `description`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'topic'
     AND INDEX_NAME = 'idx_topic_parent') = 0,
  'ALTER TABLE `topic` ADD KEY `idx_topic_parent` (`parent_topic_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `topic_merge_record` (
  `id` varchar(36) NOT NULL COMMENT '合并记录标识',
  `source_topic_id` varchar(36) NOT NULL COMMENT '被合并话题',
  `target_topic_id` varchar(36) NOT NULL COMMENT '目标话题',
  `operator_id` varchar(36) NOT NULL COMMENT '操作者',
  `merged_at` timestamp NOT NULL COMMENT '合并时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_topic_merge_source` (`source_topic_id`),
  KEY `idx_topic_merge_target` (`target_topic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='话题合并审计';

-- 历史 ENABLED 对齐 v3 ACTIVE（保留 ENABLED 兼容读取，新写入使用 ACTIVE）
UPDATE `topic` SET `status` = 'ACTIVE' WHERE `status` = 'ENABLED';

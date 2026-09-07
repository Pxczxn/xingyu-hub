-- V029：文章 v3 多维度状态（lifecycle / moderation 与 editorial workflow 分离）
-- 可重复执行：列/索引已存在时自动跳过
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND COLUMN_NAME = 'lifecycle_status') = 0,
  'ALTER TABLE `article` ADD COLUMN `lifecycle_status` varchar(32) NOT NULL DEFAULT ''ACTIVE'' COMMENT ''生命周期：ACTIVE/TRASHED'' AFTER `status`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND COLUMN_NAME = 'moderation_status') = 0,
  'ALTER TABLE `article` ADD COLUMN `moderation_status` varchar(32) NOT NULL DEFAULT ''NORMAL'' COMMENT ''治理：NORMAL/HIDDEN/FROZEN'' AFTER `lifecycle_status`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 历史 TRASHED 写入 lifecycle，editorial status 按是否曾发布恢复
UPDATE `article` a
LEFT JOIN `published_revision` pr ON pr.article_id = a.id
SET
  a.lifecycle_status = 'TRASHED',
  a.status = IF(pr.article_id IS NULL, 'DRAFT', 'PUBLISHED')
WHERE a.status = 'TRASHED';

UPDATE `article` SET `lifecycle_status` = 'ACTIVE' WHERE `lifecycle_status` IS NULL OR `lifecycle_status` = '';

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND INDEX_NAME = 'idx_article_lifecycle') = 0,
  'ALTER TABLE `article` ADD KEY `idx_article_lifecycle` (`lifecycle_status`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND INDEX_NAME = 'idx_article_moderation') = 0,
  'ALTER TABLE `article` ADD KEY `idx_article_moderation` (`moderation_status`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 审核决定支持 RETURNED
ALTER TABLE `review_decision`
  MODIFY COLUMN `decision` varchar(32) NOT NULL COMMENT '决定：APPROVED/RETURNED/REJECTED';

ALTER TABLE `review_submission`
  MODIFY COLUMN `status` varchar(32) NOT NULL COMMENT '状态：PENDING/APPROVED/RETURNED/REJECTED/WITHDRAWN';

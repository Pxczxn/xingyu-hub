-- V037: 索引优化 (Phase 6)
-- 可重复执行：索引已存在时自动跳过
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND INDEX_NAME = 'idx_article_space_created') = 0,
  'ALTER TABLE `article` ADD KEY `idx_article_space_created` (`space_id`, `created_at` DESC)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- article 无 published_at 列（发布时间在 published_revision.published_at）
-- 列表查询按 owner_id + status 过滤，updated_at 排序
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'article'
     AND INDEX_NAME = 'idx_article_owner_status_updated') = 0,
  'ALTER TABLE `article` ADD KEY `idx_article_owner_status_updated` (`owner_id`, `status`, `updated_at` DESC)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- moment 已有 idx_moment_author(author_id, created_at)，无需重复添加

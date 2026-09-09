SET @has_pinned_article_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_creation_space'
    AND COLUMN_NAME = 'pinned_article_id'
);

SET @ddl := IF(
  @has_pinned_article_id = 0,
  'ALTER TABLE `community_creation_space` ADD COLUMN `pinned_article_id` varchar(64) DEFAULT NULL COMMENT ''置顶作品文章 ID'' AFTER `description`',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- V040：文章封面图（可重复执行）
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'working_draft'
     AND COLUMN_NAME = 'cover_url') = 0,
  'ALTER TABLE `working_draft` ADD COLUMN `cover_url` varchar(1024) DEFAULT NULL COMMENT ''封面图 URL'' AFTER `summary`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'formal_revision'
     AND COLUMN_NAME = 'cover_url') = 0,
  'ALTER TABLE `formal_revision` ADD COLUMN `cover_url` varchar(1024) DEFAULT NULL COMMENT ''封面图 URL'' AFTER `summary`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

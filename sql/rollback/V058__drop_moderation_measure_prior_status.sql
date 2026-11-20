-- 回滚 V058：去掉治理措施上的隐藏前状态。
-- 只删列，不改动已有内容状态，也不删除措施行。
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moderation_measure' AND COLUMN_NAME = 'prior_status') = 1,
  'ALTER TABLE `moderation_measure` DROP COLUMN `prior_status`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- V052：统一文件存储元数据（可重复执行）
SET NAMES utf8mb4;

-- sys_file：定位与生命周期
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND COLUMN_NAME = 'file_config_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file` ADD COLUMN `file_config_id` bigint NULL COMMENT ''上传时使用的 sys_file_config.id'' AFTER `bucket_name`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND COLUMN_NAME = 'file_purpose');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file` ADD COLUMN `file_purpose` varchar(64) NULL COMMENT ''业务用途枚举'' AFTER `file_config_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND COLUMN_NAME = 'visibility');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file` ADD COLUMN `visibility` varchar(16) NOT NULL DEFAULT ''public'' COMMENT ''public|private'' AFTER `file_purpose`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND COLUMN_NAME = 'owner_user_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file` ADD COLUMN `owner_user_id` varchar(64) NULL COMMENT ''社区用户 ID'' AFTER `visibility`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND COLUMN_NAME = 'lifecycle_status');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file` ADD COLUMN `lifecycle_status` varchar(32) NOT NULL DEFAULT ''active'' COMMENT ''active|orphan_pending|deleted'' AFTER `owner_user_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file' AND INDEX_NAME = 'idx_sys_file_owner_purpose');
SET @sql := IF(@idx = 0,
  'CREATE INDEX `idx_sys_file_owner_purpose` ON `sys_file` (`owner_user_id`, `file_purpose`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sys_file_config：MinIO 双桶（生产 xingyu-public / xingyu-private）
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file_config' AND COLUMN_NAME = 'public_bucket_name');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file_config` ADD COLUMN `public_bucket_name` varchar(128) NULL COMMENT ''公共桶名'' AFTER `bucket_name`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_file_config' AND COLUMN_NAME = 'private_bucket_name');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sys_file_config` ADD COLUMN `private_bucket_name` varchar(128) NULL COMMENT ''私有桶名'' AFTER `public_bucket_name`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

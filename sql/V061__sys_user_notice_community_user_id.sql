-- V061：sys_user_notice 增加社区 UUID 收件人列
--
-- 管理端日常身份改为 community_user.id 后，站内信不能再把 UUID 写入 bigint user_id。
-- 历史 Long 收件行保持原样，不自动关联到社区账号。
--
-- 可重复执行：列或索引已存在时跳过。
SET NAMES utf8mb4;

SET @col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user_notice'
    AND COLUMN_NAME = 'community_user_id'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE `sys_user_notice` ADD COLUMN `community_user_id` varchar(36) NULL COMMENT ''社区用户 UUID 收件人'' AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @nullable := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user_notice'
    AND COLUMN_NAME = 'user_id'
    AND IS_NULLABLE = 'NO'
);
SET @sql := IF(
  @nullable > 0,
  'ALTER TABLE `sys_user_notice` MODIFY COLUMN `user_id` bigint NULL COMMENT ''历史 sys_user 收件人（只读兼容）''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user_notice'
    AND INDEX_NAME = 'idx_sys_user_notice_community_user_id'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE `sys_user_notice` ADD INDEX `idx_sys_user_notice_community_user_id` (`community_user_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @uk := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_user_notice'
    AND INDEX_NAME = 'uk_community_user_notice'
);
SET @sql := IF(
  @uk = 0,
  'ALTER TABLE `sys_user_notice` ADD UNIQUE KEY `uk_community_user_notice` (`community_user_id`, `notice_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

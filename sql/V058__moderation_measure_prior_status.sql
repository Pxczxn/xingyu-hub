-- V058：治理措施记下隐藏前的内容状态
--
-- moderation_measure 原先只有措施类型和目标，没有隐藏前的 status。
-- 执行器把动态一律写成 HIDDEN、申诉通过再一律写成 PUBLISHED，
-- 评论同样从 DELETED 被写成 HIDDEN 再写回 VISIBLE，原状态已经丢失，无法事后猜回来。
--
-- prior_status 只由新的隐藏动作写入。已有行保持 NULL：
-- 申诉撤销不得把 NULL 当成 PUBLISHED 或 VISIBLE，因此不会把历史措施错误复活。
-- 幂等：列存在即跳过。
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moderation_measure' AND COLUMN_NAME = 'prior_status') = 0,
  'ALTER TABLE `moderation_measure` ADD COLUMN `prior_status` varchar(32) DEFAULT NULL '
  'COMMENT ''隐藏前的内容状态。NULL=历史措施，申诉不得据此猜测并复活'' AFTER `target_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 回滚 V061：删除社区 UUID 收件列。
-- 若已写入 community_user_id 且 user_id 为空的行，回滚前需处理，否则 user_id 恢复 NOT NULL 会失败。
SET NAMES utf8mb4;

ALTER TABLE `sys_user_notice`
  DROP INDEX `uk_community_user_notice`,
  DROP INDEX `idx_sys_user_notice_community_user_id`,
  DROP COLUMN `community_user_id`;

ALTER TABLE `sys_user_notice`
  MODIFY COLUMN `user_id` bigint NOT NULL COMMENT '用户ID';

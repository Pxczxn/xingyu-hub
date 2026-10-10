-- V044：通知契约恢复 —— notification 增加稳定 actor 身份
--
-- 背景（通知契约审计结论）：
--   真实 producer 只有 FOLLOW（NotificationService.notifyUserFollowed）。历史通知只把
--   username/displayName 拼成 title/body 文本，表里没有任何稳定身份，于是「点通知进入
--   发起者主页」只能退化到 /me/followers，且发起者改名后无法定位。这里补最小字段：
--   actor_user_id（= community_user.id，稳定，内部 relation 直接复用现有身份体系）。
--
-- 为什么不存 username：username 可改（community_profile.username_changed_at，另有
--   username_history）。把 username 固化进通知会在改名后失效；改为读取时按 actor_user_id
--   现查 community_profile 得到**当前** canonical username，再拼 /u/{username}。
--
-- 为什么不顺带加 object_type/object_id 之类的通用「目标」列：当前没有任何 producer 需要
--   内容对象目标（FOLLOW 的目标就是接收者本人，即 notification.user_id），提前设计一套
--   万能 notification schema 属于过度实现。需要时再补，本次只保证「可合理扩展」。
--
-- 幂等：列已存在则跳过（守卫模式同 V031 / V041），重复执行不报错、不重复加列。
SET NAMES utf8mb4;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'notification'
     AND COLUMN_NAME = 'actor_user_id') = 0,
  'ALTER TABLE `notification` ADD COLUMN `actor_user_id` varchar(36) DEFAULT NULL COMMENT ''触发该通知的稳定用户标识（可空；当前仅 FOLLOW 写入）'' AFTER `user_id`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

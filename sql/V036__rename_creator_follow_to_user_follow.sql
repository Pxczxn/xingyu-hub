-- V036: creator_follow → user_follow (Phase 1)
SET NAMES utf8mb4;

ALTER TABLE `creator_follow` RENAME TO `user_follow`;

ALTER TABLE `user_follow`
  CHANGE COLUMN `creator_id` `followee_id` varchar(36) NOT NULL COMMENT '被关注用户标识';

ALTER TABLE `user_follow` DROP INDEX `uk_creator_follow`;
ALTER TABLE `user_follow` ADD UNIQUE KEY `uk_user_follow` (`follower_id`,`followee_id`);

ALTER TABLE `user_follow` DROP INDEX `idx_creator_follow_creator`;
ALTER TABLE `user_follow` ADD KEY `idx_user_follow_followee` (`followee_id`);

ALTER TABLE `user_follow` COMMENT='用户关注';

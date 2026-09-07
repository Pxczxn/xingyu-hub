-- V026：社区注册扩展字段（手机、角色、审核状态）
SET NAMES utf8mb4;

ALTER TABLE `community_user`
  ADD COLUMN `phone` varchar(20) NULL COMMENT '手机号' AFTER `email`,
  ADD COLUMN `phone_verified_at` timestamp NULL COMMENT '手机验证完成时间（UTC）' AFTER `phone`,
  ADD COLUMN `role` varchar(32) NOT NULL DEFAULT 'user' COMMENT '社区角色标识' AFTER `status`,
  ADD UNIQUE KEY `uk_community_user_phone` (`phone`);

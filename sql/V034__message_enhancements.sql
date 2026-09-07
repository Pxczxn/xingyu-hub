-- V034：消息撤回
SET NAMES utf8mb4;

ALTER TABLE `chat_message`
  ADD COLUMN `recalled_at` timestamp NULL DEFAULT NULL COMMENT '撤回时间（UTC）' AFTER `created_at`;

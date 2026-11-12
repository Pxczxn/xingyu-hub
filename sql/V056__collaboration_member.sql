-- V056: 创作协作成员（Collaboration Membership，2026-10-30）
--
-- 目标：接受协作邀请后写入真实关系。邀请链接仍是可复用的 7 天令牌；
-- 每位接受者在主人创作空间下成为 EDITOR，可编辑该主人的文章草稿。
-- 送审、移入回收站仍只有主人能做（服务层，不靠本表约束）。
--
-- 设计决策：
--   * 独立表而不是给 collaboration_invite 加 accepted_by：一条邀请可被多人接受，
--     关系的事实来源是 (owner_id, member_id)，不是邀请行。
--   * 无外键：与 galaxy_member / collaboration_invite 同风格，完整性由服务层保证。
--   * UNIQUE (owner_id, member_id)：重复接受幂等，不堆行。
--
-- 回退：DROP TABLE `collaboration_member`（见文件末尾模板）。
-- ⚠️ 回退会丢失全部协作关系，执行前先备份该表。
-- 注意：本文件入库登记 ≠ 执行；执行需单独授权，走 SchemaMigrator 登记流程。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `collaboration_member` (
  `id` varchar(36) NOT NULL COMMENT '主键（UUID）',
  `owner_id` varchar(36) NOT NULL COMMENT '创作空间主人（community_user.id）',
  `member_id` varchar(36) NOT NULL COMMENT '协作者（community_user.id）',
  `role` varchar(16) NOT NULL COMMENT '当前仅 EDITOR',
  `invite_id` varchar(36) NOT NULL COMMENT '带来该关系的邀请',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collaboration_member_pair` (`owner_id`, `member_id`),
  KEY `idx_collaboration_member_member` (`member_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作协作成员';

-- 回退模板（⚠️ 有数据丢失风险，先备份）：
-- DROP TABLE IF EXISTS `collaboration_member`;

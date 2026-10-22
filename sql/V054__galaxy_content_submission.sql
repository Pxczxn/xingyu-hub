-- V054: 星系内容推荐（Galaxy Content Contribution，2026-10-22）
--
-- 目标：星系成员可以把自己已公开发布的作品推荐为该星系的内容，
-- 由管理员审核通过后才真正挂载到 galaxy_content。
--
-- 设计决策：
--   * 独立表而不是给 galaxy_content 加列：galaxy_content 是"已上架内容"的
--     单一事实来源（listContent 直接读它），把 PENDING/REJECTED 混进去会让
--     所有既有读取路径都必须加状态过滤，等于扩大改动面。推荐是独立的申请
--     流程，和 galaxy_join_request 同构。
--   * 不存作品快照（标题/摘要）：作品可能改名或下架，展示值一律现查
--     search_document / gallery；表里只留指向关系。
--   * resolved_by 记管理员登录 id（StpUtil.getLoginId()），可空（历史数据/系统操作）。
--   * 无外键：遵循本库既有风格（galaxy_content / galaxy_member 同样无外键），
--     关联完整性由服务层保证。
--
-- 状态机：PENDING → APPROVED（写 galaxy_content，幂等跳过已存在）
--                → REJECTED（reject_reason 必填）
--
-- 回退：DROP TABLE `galaxy_content_submission`（见文件末尾模板）。
-- ⚠️ 回退会丢失全部推荐记录与审核结果，执行前先备份该表。
-- 注意：本文件入库登记 ≠ 执行；执行需单独授权，走 SchemaMigrator 登记流程。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `galaxy_content_submission` (
  `id` varchar(36) NOT NULL COMMENT '主键（UUID）',
  `galaxy_id` varchar(36) NOT NULL COMMENT '目标星系',
  `submitter_id` varchar(36) NOT NULL COMMENT '推荐人（community_user.id）',
  `object_type` varchar(32) NOT NULL COMMENT '内容类型（当前仅 ARTICLE）',
  `object_id` varchar(36) NOT NULL COMMENT '被推荐作品 id',
  `note` varchar(500) DEFAULT NULL COMMENT '推荐说明（可选）',
  `status` varchar(16) NOT NULL COMMENT 'PENDING / APPROVED / REJECTED',
  `reject_reason` varchar(200) DEFAULT NULL COMMENT '拒绝理由（仅 REJECTED）',
  `resolved_by` varchar(64) DEFAULT NULL COMMENT '处理人（admin 登录 id）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_submission_galaxy_status` (`galaxy_id`, `status`, `created_at`),
  KEY `idx_submission_submitter` (`submitter_id`, `created_at`),
  KEY `idx_submission_object` (`object_type`, `object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星系内容推荐申请';

-- 回退模板（⚠️ 有数据丢失风险，先备份）：
-- DROP TABLE IF EXISTS `galaxy_content_submission`;

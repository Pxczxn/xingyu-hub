-- V041：对齐 schema 与 migration baseline —— 补齐索引/唯一约束与注释漂移
--
-- 背景（第一阶段审计结论）：
--   开发库历史上被测试侧自愈 DDL（CommunityTestSupport.ensure*Schema 等）抢先建过表，
--   用的是精简定义：没有 COMMENT、少了索引。此后 V031 / V033 / V035 里的
--   `CREATE TABLE IF NOT EXISTS` 全部退化为空操作，索引与注释便永久缺失，
--   而迁移台账仍显示"已应用"。
--
-- 本迁移是 forward fix，只补差异：
--   * 不重放 V031 / V033 / V035，也不修改任何历史 migration；
--   * 所有定义均取自 fresh baseline（sql/V*.sql 全量重建出的库）的 information_schema，
--     不是手写猜测；
--   * 幂等：索引/唯一约束存在时跳过，重复执行不报错、不重复创建；注释重复设置无副作用。
--
-- 唯一约束 `uk_galaxy_join_request_pending` 创建前会显式检查重复数据：
--   存在重复即 fail-fast，绝不自动删除或合并数据（数据处置是人的决定）。
SET NAMES utf8mb4;

-- ============================================================
-- 1. 索引 / 唯一约束：缺则补，存在则跳过（守卫模式同 V031）
-- ============================================================

-- galaxy_join_request：同一 (galaxy_id, user_id, status) 只允许一条，缺失会放进重复待审申请。
-- 注意顺序：先查重复数据，再决定是否建约束。
SET @uk_missing = (
  SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'galaxy_join_request'
    AND INDEX_NAME = 'uk_galaxy_join_request_pending'
);

-- 仅在需要新建唯一约束时才统计重复组；已存在则不做无谓扫描。
-- 内层用 `SELECT 1` 而非计数，避免依赖具体列的可聚合性。
SET @uk_dup_groups = IF(
  @uk_missing,
  (SELECT COUNT(*) FROM (
     SELECT 1 FROM `galaxy_join_request`
     GROUP BY `galaxy_id`, `user_id`, `status`
     HAVING COUNT(*) > 1
   ) AS dup_group),
  0);

-- 有重复时故意引用一张不存在的表：让迁移在此处硬失败，表名即失败原因。
-- 不使用 SIGNAL，因为 SIGNAL 只能在存储程序内部使用，而本迁移是按顺序执行的纯 SQL 脚本
-- （需同时能被 mysql 客户端与 SchemaMigrator 的多语句执行方式消化）。
SET @sql = IF(
  NOT @uk_missing,
  'SELECT 1',
  IF(@uk_dup_groups = 0,
     'ALTER TABLE `galaxy_join_request` ADD UNIQUE KEY `uk_galaxy_join_request_pending` (`galaxy_id`,`user_id`,`status`)',
     'SELECT 1 FROM `V041_ABORTED_galaxy_join_request_has_duplicates`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- user_block：idx_user_block_blocked (`blocked_id`)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'user_block'
     AND INDEX_NAME = 'idx_user_block_blocked') = 0,
  'ALTER TABLE `user_block` ADD KEY `idx_user_block_blocked` (`blocked_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- series_subscription：idx_series_subscription_series (`series_id`)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'series_subscription'
     AND INDEX_NAME = 'idx_series_subscription_series') = 0,
  'ALTER TABLE `series_subscription` ADD KEY `idx_series_subscription_series` (`series_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- report_supplement：idx_report_supplement_report (`report_id`,`created_at`)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'report_supplement'
     AND INDEX_NAME = 'idx_report_supplement_report') = 0,
  'ALTER TABLE `report_supplement` ADD KEY `idx_report_supplement_report` (`report_id`,`created_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- galaxy_join_request：idx_galaxy_join_request_galaxy (`galaxy_id`,`status`,`created_at`)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'galaxy_join_request'
     AND INDEX_NAME = 'idx_galaxy_join_request_galaxy') = 0,
  'ALTER TABLE `galaxy_join_request` ADD KEY `idx_galaxy_join_request_galaxy` (`galaxy_id`,`status`,`created_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- event_registration：idx_event_registration_user (`user_id`,`created_at`)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'event_registration'
     AND INDEX_NAME = 'idx_event_registration_user') = 0,
  'ALTER TABLE `event_registration` ADD KEY `idx_event_registration_user` (`user_id`,`created_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. 表注释（取自 fresh baseline）
--    注释是元数据，重复设置同一值无副作用，因此不需要存在性守卫。
-- ============================================================

ALTER TABLE `community_api_token` COMMENT='社区开放 API Token';
ALTER TABLE `event_registration` COMMENT='活动报名';
ALTER TABLE `featured_content` COMMENT='运营精选内容';
ALTER TABLE `galaxy_join_request` COMMENT='星系入群申请';
ALTER TABLE `report_supplement` COMMENT='举报补充材料';
ALTER TABLE `series_subscription` COMMENT='系列追更订阅';
ALTER TABLE `user_block` COMMENT='社区用户屏蔽';

-- ============================================================
-- 3. 列注释（取自 fresh baseline；MODIFY 不带 AFTER，保持现有列顺序）
-- ============================================================

ALTER TABLE `community_api_token` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT 'Token 记录标识';
ALTER TABLE `community_api_token` MODIFY COLUMN `user_id` varchar(36) NOT NULL  COMMENT '所属用户';
ALTER TABLE `community_api_token` MODIFY COLUMN `name` varchar(128) NOT NULL  COMMENT 'Token 名称';
ALTER TABLE `community_api_token` MODIFY COLUMN `token_prefix` varchar(16) NOT NULL  COMMENT 'Token 前缀（展示用）';
ALTER TABLE `community_api_token` MODIFY COLUMN `token_hash` varchar(64) NOT NULL  COMMENT 'Token SHA-256 哈希';
ALTER TABLE `community_api_token` MODIFY COLUMN `scopes` varchar(256) NOT NULL  COMMENT '权限域，逗号分隔';
ALTER TABLE `community_api_token` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/REVOKED';
ALTER TABLE `community_api_token` MODIFY COLUMN `last_used_at` timestamp NULL DEFAULT NULL COMMENT '最近使用时间（UTC）';
ALTER TABLE `community_api_token` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '创建时间（UTC）';
ALTER TABLE `community_api_token` MODIFY COLUMN `revoked_at` timestamp NULL DEFAULT NULL COMMENT '撤销时间（UTC）';
ALTER TABLE `event_registration` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '报名标识';
ALTER TABLE `event_registration` MODIFY COLUMN `event_id` varchar(36) NOT NULL  COMMENT '活动标识';
ALTER TABLE `event_registration` MODIFY COLUMN `user_id` varchar(36) NOT NULL  COMMENT '用户标识';
ALTER TABLE `event_registration` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'REGISTERED' COMMENT '状态：REGISTERED/CANCELLED';
ALTER TABLE `event_registration` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '报名时间（UTC）';
ALTER TABLE `event_registration` MODIFY COLUMN `cancelled_at` timestamp NULL DEFAULT NULL COMMENT '取消时间（UTC）';
ALTER TABLE `featured_content` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '精选标识';
ALTER TABLE `featured_content` MODIFY COLUMN `object_type` varchar(32) NOT NULL  COMMENT '对象类型：ARTICLE/SERIES';
ALTER TABLE `featured_content` MODIFY COLUMN `object_id` varchar(36) NOT NULL  COMMENT '对象标识';
ALTER TABLE `featured_content` MODIFY COLUMN `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序（越小越靠前）';
ALTER TABLE `featured_content` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/ARCHIVED';
ALTER TABLE `featured_content` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '创建时间（UTC）';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '申请标识';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `galaxy_id` varchar(36) NOT NULL  COMMENT '星系标识';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `user_id` varchar(36) NOT NULL  COMMENT '申请用户';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `message` varchar(512) NULL DEFAULT NULL COMMENT '申请说明';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '申请时间（UTC）';
ALTER TABLE `galaxy_join_request` MODIFY COLUMN `resolved_at` timestamp NULL DEFAULT NULL COMMENT '处理时间（UTC）';
ALTER TABLE `report_supplement` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '补充材料标识';
ALTER TABLE `report_supplement` MODIFY COLUMN `report_id` varchar(36) NOT NULL  COMMENT '举报标识';
ALTER TABLE `report_supplement` MODIFY COLUMN `author_id` varchar(36) NOT NULL  COMMENT '提交用户';
ALTER TABLE `report_supplement` MODIFY COLUMN `body` text NOT NULL  COMMENT '补充说明';
ALTER TABLE `report_supplement` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '提交时间（UTC）';
ALTER TABLE `series_subscription` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '订阅标识';
ALTER TABLE `series_subscription` MODIFY COLUMN `user_id` varchar(36) NOT NULL  COMMENT '用户标识';
ALTER TABLE `series_subscription` MODIFY COLUMN `series_id` varchar(36) NOT NULL  COMMENT '系列标识';
ALTER TABLE `series_subscription` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '订阅时间（UTC）';
ALTER TABLE `user_block` MODIFY COLUMN `id` varchar(36) NOT NULL  COMMENT '屏蔽记录标识';
ALTER TABLE `user_block` MODIFY COLUMN `blocker_id` varchar(36) NOT NULL  COMMENT '屏蔽发起用户';
ALTER TABLE `user_block` MODIFY COLUMN `blocked_id` varchar(36) NOT NULL  COMMENT '被屏蔽用户';
ALTER TABLE `user_block` MODIFY COLUMN `created_at` timestamp NOT NULL  COMMENT '创建时间（UTC）';

-- 后续迁移追加的列：被测试侧裸 ALTER 抢先建出的版本没有 COMMENT
ALTER TABLE `chat_message` MODIFY COLUMN `recalled_at` timestamp NULL DEFAULT NULL COMMENT '撤回时间（UTC）';
ALTER TABLE `galaxy` MODIFY COLUMN `join_mode` varchar(32) NOT NULL DEFAULT 'OPEN' COMMENT '入群模式：OPEN/APPROVAL';

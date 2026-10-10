-- V046：Appeal 结果契约 —— 让「这次申诉到底批准还是驳回」可以被结构化回答
--
-- 背景（Governance Contract Recovery 审计结论）：
--   旧实现里 approve 与 reject **都写 status = 'DECIDED'**，且都不落 moderation_decision，
--   于是申诉的最终结论在数据里根本不存在 —— 只能靠猜业务分支。同时三方词表不一致：
--   V017 建表注释写 PENDING/REVIEWED，代码实写 SUBMITTED/DECIDED。
--
-- 本迁移引入唯一、明确的结果契约（词表，不是新表）：
--   appeal.status     = PENDING | APPROVED | REJECTED   （是否待处理由 PENDING 唯一表达）
--   appeal.outcome    = APPROVED | REJECTED | NULL      （终局结论；与 status 同值，冗余但显式）
--   appeal.decided_by = 处理人；appeal.decided_at = 处理时间；appeal.decision_note = 处理说明
--
-- 为什么不去给 appeal 加 decision_id：
--   `uk_moderation_decision_case` 是 (case_id) 上的**唯一键**，已证明一个 case 至多一条
--   decision（0..1）。因此「该 case 的最终决定」本身就唯一可定位，加 decision_id 只是
--   重复这一事实、徒增一处可能与 uk 冲突的冗余外键。故不加。
--
-- 幂等：列存在即跳过；重复执行无副作用。
SET NAMES utf8mb4;

-- 1) outcome：终局结论（可为 NULL = 尚未裁决）
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeal' AND COLUMN_NAME = 'outcome') = 0,
  'ALTER TABLE `appeal` ADD COLUMN `outcome` varchar(32) DEFAULT NULL COMMENT ''终局结论：APPROVED/REJECTED，NULL=未裁决'' AFTER `status`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) decided_by：处理人
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeal' AND COLUMN_NAME = 'decided_by') = 0,
  'ALTER TABLE `appeal` ADD COLUMN `decided_by` varchar(36) DEFAULT NULL COMMENT ''处理人标识，NULL=未处理'' AFTER `outcome`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) decided_at：处理时间
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeal' AND COLUMN_NAME = 'decided_at') = 0,
  'ALTER TABLE `appeal` ADD COLUMN `decided_at` timestamp NULL DEFAULT NULL COMMENT ''处理时间（UTC），NULL=未处理'' AFTER `decided_by`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) decision_note：处理说明（复用既有 note 能力，不新造注释体系）
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeal' AND COLUMN_NAME = 'decision_note') = 0,
  'ALTER TABLE `appeal` ADD COLUMN `decision_note` varchar(1024) DEFAULT NULL COMMENT ''处理说明'' AFTER `decided_at`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) status 列注释对齐真实词表（旧注释 PENDING/REVIEWED 与代码实写不符）
ALTER TABLE `appeal` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'PENDING'
  COMMENT '状态：PENDING/APPROVED/REJECTED';

-- 6) 历史数据对齐：把旧词表残留归一到新契约，避免出现契约外的值。
--    仅做语义等价的收敛，不臆造结果。
UPDATE `appeal` SET `status` = 'PENDING' WHERE `status` IN ('SUBMITTED', 'REVIEWING', 'REVIEWED');
--    DECIDED 无法从数据推断批/驳（旧实现两者同值），保守归一到 REJECTED 会扭曲事实，
--    故不猜；把 outcome 置 NULL 并由运维按原始 case/measure 现状人工确认后可回填。
--    当前两库 appeal 均为 0 行，此段为防御性、对空表无副作用。
UPDATE `appeal` SET `outcome` = NULL WHERE `outcome` IS NULL;

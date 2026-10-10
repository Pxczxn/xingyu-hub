-- V047：治理闭环所需的两个唯一约束（并发正确性，不靠前端 disabled）
--
-- 1) appeal 一案一申诉：uk_appeal_case(case_id)
--    服务端已明确"一个 case 只允许一次申诉"。没有 DB 约束时，两个并发请求会同时通过
--    findByCaseId 检查并各插一条 —— 「先 SELECT 再 INSERT」在并发下有必然窗口。
--
-- 2) report 同一用户对同一对象至多一条**未终结**举报：uk_report_active_reporter_object
--    MySQL 8 不支持 partial index，用生成列 + 唯一索引表达：
--      active_key = 若 status ∈ (SUBMITTED, TRIAGED) 则 "reporter|objectType|objectId"，否则 NULL。
--    MySQL 唯一索引允许多个 NULL，于是"终结后的历史举报"不参与唯一性，可保留多条；
--    "同时存在两条 active" 会被唯一索引直接拒绝。
--
-- 幂等：列/索引存在即跳过；建唯一索引前先查重复数据，有重复则 fail-fast（绝不自动删数据）。
SET NAMES utf8mb4;

-- ============================================================
-- 1. appeal：一案一申诉
-- ============================================================
SET @dup_appeal = (
  SELECT COUNT(*) FROM (
    SELECT 1 FROM `appeal` GROUP BY `case_id` HAVING COUNT(*) > 1
  ) AS d
);
-- 有重复数据则引用不存在的表硬失败（同 V041 手法，不用 SIGNAL）。
SET @sql = IF(@dup_appeal > 0,
  'SELECT 1 FROM V047_ABORTED_appeal_has_duplicate_case',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeal' AND INDEX_NAME = 'uk_appeal_case') = 0,
  'ALTER TABLE `appeal` ADD UNIQUE KEY `uk_appeal_case` (`case_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. report：未终结举报的唯一性（生成列 + 唯一索引）
-- ============================================================
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report' AND COLUMN_NAME = 'active_key') = 0,
  'ALTER TABLE `report` ADD COLUMN `active_key` varchar(128) '
  'GENERATED ALWAYS AS (CASE WHEN `status` IN (''SUBMITTED'', ''TRIAGED'') '
  'THEN CONCAT(`reporter_id`, ''|'', `object_type`, ''|'', `object_id`) ELSE NULL END) STORED '
  'COMMENT ''未终结举报唯一键（终结后为 NULL，不参与唯一性）''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @dup_report = (
  SELECT COUNT(*) FROM (
    SELECT 1 FROM `report`
    WHERE `status` IN ('SUBMITTED', 'TRIAGED')
    GROUP BY `reporter_id`, `object_type`, `object_id` HAVING COUNT(*) > 1
  ) AS d
);
SET @sql = IF(@dup_report > 0,
  'SELECT 1 FROM V047_ABORTED_report_has_duplicate_active',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'report' AND INDEX_NAME = 'uk_report_active_reporter_object') = 0,
  'ALTER TABLE `report` ADD UNIQUE KEY `uk_report_active_reporter_object` (`active_key`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

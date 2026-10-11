-- V051: galaxy 身份字段（Galaxy Identity Contract，2026-10-10 Phase 4.1 设计）
--
-- 目标：galaxy 从"管理员内容集合"升级为"具有身份的主题空间"。
-- 新增两个可空展示字段；join_mode（V033 已建）开始由公共契约暴露。
--
-- 设计决策（Phase 4.1 评审结论）：
--   * 不加 sort_order：pinned DESC, created_at DESC 已满足"精选/最新"两区块，
--     手工细排无真实需求，避免为想象中的功能加列。
--   * 不加 owner 列：成员角色模型延后（galaxy_member.role 已预留，Phase 3 的
--     leave 409 守卫生效中），owner 语义等有真实管理场景再设计。
--   * 可空列 + MySQL 8.0 INSTANT DDL：秒级、不锁表、零回填。
--
-- 回退：DROP COLUMN description / cover_url（见文件末尾模板）。
-- ⚠️ 回退有数据丢失风险：DROP 会一并删除列上已写入的简介/封面内容，
--    恢复列后需由运营重新录入。执行 DROP 前必须先确认该列无有效数据，
--    或先备份 SELECT id, description, cover_url FROM galaxy。
-- 注意：本文件入库登记 ≠ 执行；执行需单独授权，走 SchemaMigrator 登记流程。
-- test 环境说明：xingyu_hub_test 的 schema.migration.enabled=false（结构由
-- rebuild-test-db.sh 从迁移基线预建）。本文件已于 2026-10-10 用 mysql CLI
-- 在 test 库显式执行（Phase 4.2-F 契约验证），但**未登记 test 台账**——
-- 下次 rebuild-test-db.sh 会从迁移文件重放并正常登记 SUCCESS，幂等守卫
-- 保证不重复执行；在此之前 test 台账落后于实际结构属已知且无害。

SET NAMES utf8mb4;

-- ============================================================
-- description：星系简介（一等展示字段，admin 表单/校验/远期搜索使用）
-- 幂等：information_schema 守卫，列已存在则跳过（V041 先例模式）
-- ============================================================
SET @desc_missing = (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'galaxy'
    AND COLUMN_NAME = 'description'
);

SET @sql = IF(
  @desc_missing,
  'ALTER TABLE `galaxy` ADD COLUMN `description` varchar(512) NULL COMMENT ''星系简介（Galaxy Identity，V051）'' AFTER `name`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- cover_url：星系封面（NULL = 前端回退 GalaxyVisual 确定性装饰图）
-- ============================================================
SET @cover_missing = (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'galaxy'
    AND COLUMN_NAME = 'cover_url'
);

SET @sql = IF(
  @cover_missing,
  'ALTER TABLE `galaxy` ADD COLUMN `cover_url` varchar(512) NULL COMMENT ''星系封面 URL（Galaxy Identity，V051）'' AFTER `description`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 回退模板（⚠️ 有数据丢失风险：会删除该列上已写入的全部简介/封面数据；
-- 执行前先备份该列内容。列存在时才执行 DROP）：
-- SET @sql = IF(
--   (SELECT COUNT(*) FROM information_schema.COLUMNS
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'galaxy' AND COLUMN_NAME = 'cover_url'),
--   'ALTER TABLE `galaxy` DROP COLUMN `cover_url`',
--   'SELECT 1');
-- SET @sql = IF(
--   (SELECT COUNT(*) FROM information_schema.COLUMNS
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'galaxy' AND COLUMN_NAME = 'description'),
--   'ALTER TABLE `galaxy` DROP COLUMN `description`',
--   'SELECT 1');
-- ============================================================

-- V059：补上管理端客户表，并补齐文件配置主索引
--
-- customer：管理端菜单 /system/customer 仍会打开客户页，接口读写 Customer 实体。
-- 先前迁移没有这张表，页面一打开就会失败。字段与实体一一对应：
--   id / name / phone / id_card / address / remark / deleted / create_time / update_time
-- 姓名、手机号、地址的长度沿用同批 Mars 代码生成表 student（V001）。
-- 身份证没有历史列定义，用 varchar(32) 容纳 18 位号码；备注沿用 sys_file_config.remark 的 varchar(500)。
-- 页面把姓名和手机号设为必填，这两列 NOT NULL。deleted 是逻辑删除字段，默认 0。
--
-- idx_sys_file_config_master：定义来自 V032 的 KEY (`master`, `status`)，普通升序索引。
-- 它写在 CREATE TABLE IF NOT EXISTS 里，而 sys_file_config 已由 V001 创建，空库不会执行那段建表。
-- V001 已有的 idx_master(master) 是另一条索引，这里不改它。
--
-- 可重复执行：表或索引已存在时跳过。
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `customer` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '客户ID',
  `name` varchar(50) NOT NULL COMMENT '客户姓名',
  `phone` varchar(20) NOT NULL COMMENT '手机号',
  `id_card` varchar(32) DEFAULT NULL COMMENT '身份证号',
  `address` varchar(200) DEFAULT NULL COMMENT '地址',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标记：0未删除 1已删除',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户表';

SET @idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_file_config'
    AND INDEX_NAME = 'idx_sys_file_config_master'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE `sys_file_config` ADD KEY `idx_sys_file_config_master` (`master`, `status`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

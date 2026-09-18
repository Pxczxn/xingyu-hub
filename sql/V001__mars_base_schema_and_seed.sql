-- ============================================================================
-- V001：Mars 基础 schema 与种子数据（45 张表）
--
-- 【本文件的来源与性质】—— A+ 历史兼容恢复方案，请勿按普通迁移修改
--   原始 V001__*.sql 已从仓库、Git 全历史、IDE 本地历史、回收站与所有备份中丢失
--   （dev 的 schema_migration 仍保留其历史记录：version=001, status=SUCCESS,
--    checksum=63a670b7132520cdded2be9d3ec22fa0be4971608d13abbf57207dc3f88abe78,
--    applied_at=2026-08-26 14:04:19）。本文件为**按该次实际执行记录恢复**的等价迁移：
--     · 45 张表的 DROP/CREATE 语句取自 MySQL binlog DESKTOP-3C9JFAG-bin.000030 中
--       2026-08-26 06:04 UTC（= 14:04 +08:00）那批事件的语句原文 —— 最高优先级来源。
--       口径已标定：用仓库现存 V002 与 binlog 记录逐字节比对，确认 binlog 文本 == 文件原文。
--     · 种子数据取自同版本 mars-admin/sql/mars-system.sql（binlog 为 ROW 格式，
--       INSERT 语句原文不可逆，只能由源头 dump 补齐）。已逐表校验：
--         45/45 张表列定义逐一相同；45/45 张表 INSERT 行数完全一致（合计 2929 条）。
--     · 因来源不同，本文件 checksum 与历史台账值不同；SchemaMigrator 对 version=001
--       提供精确的 legacy-checksum 兼容映射（见 LegacyMigrationChecksums）。
--
-- 【凭据消毒】—— 安全前置处理，共替换 24 处凭据值
--   Mars 种子数据（sys_config_group 的 JSON 与 sys_server 表）中原本含**真实可用凭据**：
--   阿里云/腾讯云/MinIO/RustFS 的 AccessKey 与 SecretKey、腾讯云 SecretId/SecretKey、
--   邮箱 SMTP 授权码、微信小程序与公众号 appSecret、钉钉机器人 SEC 签名与 access_token、
--   飞书 token、支付与 AES 密钥、RSA 私钥、sys_server 明文口令等。
--   本仓库为公开仓库，直接提交会造成凭据泄露（GitHub Push Protection 已直接拦截该次推送），
--   故把这些**值**统一替换为 `__REDACTED__`；SQL 与 JSON 结构、行数、字段全部保持不变。
--   例外（刻意保留）：encryptPublicKey（公开密钥，非秘密）、Authorization/tokenStyle 等
--   配置语义键、emailTemplate 正文、以及 bcrypt 单向哈希（admin/admin123 依赖其保持可用）。
--   影响：重建后的库中这些第三方集成不可用；RSA 密钥对应由管理端重新生成。
--   注意：**未消毒的原始值仍存在于 2026-08-26 的开发库与你本机的 mars 源 dump 中**，
--        建议对这些凭据做一次轮换。
--
-- 【覆盖对象】Mars 系统 45 张表：sys_* 平台表、qrtz_* 调度表、gen_* 代码生成表，
--   以及 coder_banner / student / sys_chat_* 等 Mars 演示对象。
--   后者随后由 V019__drop_mars_demo.sql 删除、其账号由 V020 清理 —— 迁移链要求它们在
--   此完整存在，不得因"最终库不再使用"而省略，否则 V019/V020 不可复现。
--
-- 【格式说明】列定义行不含缩进，这是 2026-08-26 实际执行文本的原貌，已刻意保留，
--   以便与 binlog 中的执行记录逐字对照。
-- ============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for `coder_banner`
-- ----------------------------
DROP TABLE IF EXISTS `coder_banner`;
CREATE TABLE `coder_banner`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '标题',
`description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '描述',
`image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图片地址',
`link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '跳转链接',
`tag` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '标签',
`btn_text` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '按钮文字',
`sort` int NULL DEFAULT 0 COMMENT '排序',
`status` tinyint NULL DEFAULT 1 COMMENT '状态',
`position` tinyint NULL DEFAULT 1 COMMENT '展示位置',
`create_time` datetime NULL DEFAULT NULL COMMENT '创建时间',
`update_time` datetime NULL DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '轮播横幅表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of coder_banner
-- ----------------------------
INSERT INTO `coder_banner` VALUES (1, '2026新年活动', '新年特惠活动进行中', 'https://file.xdclass.net/xdclass/2026newyear/2026XCDT.gif', '', '活动', '了解详情', 1, 1, 2, '2026-02-11 14:11:51', '2026-02-11 14:11:51');

-- ----------------------------
-- Table structure for `gen_table`
-- ----------------------------
DROP TABLE IF EXISTS `gen_table`;
CREATE TABLE `gen_table`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
`table_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '表名称',
`table_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '表描述',
`class_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '实体类名称',
`package_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '生成包路径',
`module_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '生成模块名',
`business_name` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '生成业务名',
`function_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '生成功能名',
`author` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '生成功能作者',
`gen_type` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'crud' COMMENT '生成类型（crud单表 tree树表）',
`gen_path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '/' COMMENT '生成路径',
`front_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'naive-ui' COMMENT '前端模板类型',
`form_layout` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'vertical' COMMENT '表单布局（vertical-从上到下 grid-一行两列）',
`parent_menu_id` bigint NULL DEFAULT NULL COMMENT '上级菜单ID',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '代码生成业务表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of gen_table
-- ----------------------------
INSERT INTO `gen_table` VALUES (4, 'student', '学生表', 'Student', 'com.mars.system', 'system', 'student', '学生表', 'Mars', 'crud', '/', 'naive-ui', 'grid', NULL, NULL, '2026-02-09 12:44:26', '2026-02-09 12:44:26');

-- ----------------------------
-- Table structure for `gen_table_column`
-- ----------------------------
DROP TABLE IF EXISTS `gen_table_column`;
CREATE TABLE `gen_table_column`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '编号',
`table_id` bigint NULL DEFAULT NULL COMMENT '归属表编号',
`column_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '列名称',
`column_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '列描述',
`column_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '列类型',
`java_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT 'Java类型',
`java_field` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT 'Java字段名',
`is_pk` tinyint NULL DEFAULT 0 COMMENT '是否主键（1是）',
`is_increment` tinyint NULL DEFAULT 0 COMMENT '是否自增（1是）',
`is_required` tinyint NULL DEFAULT 0 COMMENT '是否必填（1是）',
`is_insert` tinyint NULL DEFAULT 0 COMMENT '是否为插入字段（1是）',
`is_edit` tinyint NULL DEFAULT 0 COMMENT '是否编辑字段（1是）',
`is_list` tinyint NULL DEFAULT 0 COMMENT '是否列表字段（1是）',
`is_query` tinyint NULL DEFAULT 0 COMMENT '是否查询字段（1是）',
`query_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'EQ' COMMENT '查询方式',
`html_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '显示类型',
`dict_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '字典类型',
`sort` int NULL DEFAULT 0 COMMENT '排序',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_table_id`(`table_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 47 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '代码生成字段表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of gen_table_column
-- ----------------------------
INSERT INTO `gen_table_column` VALUES (34, 4, 'id', 'id', 'bigint', 'Long', 'id', 1, 1, 1, 0, 0, 1, 1, 'EQ', 'input', '', 1);
INSERT INTO `gen_table_column` VALUES (35, 4, 'student_no', '学号', 'varchar(50)', 'String', 'studentNo', 0, 0, 1, 1, 1, 1, 0, 'EQ', 'input', '', 2);
INSERT INTO `gen_table_column` VALUES (36, 4, 'name', '姓名', 'varchar(50)', 'String', 'name', 0, 0, 1, 1, 1, 1, 1, 'EQ', 'input', '', 3);
INSERT INTO `gen_table_column` VALUES (37, 4, 'gender', '性别', 'tinyint', 'Integer', 'gender', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'select', 'gender', 4);
INSERT INTO `gen_table_column` VALUES (38, 4, 'birthday', '出生日期', 'date', 'LocalDate', 'birthday', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'datetime', '', 5);
INSERT INTO `gen_table_column` VALUES (39, 4, 'phone', '手机号', 'varchar(20)', 'String', 'phone', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'input', '', 6);
INSERT INTO `gen_table_column` VALUES (40, 4, 'email', '邮箱', 'varchar(100)', 'String', 'email', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'input', '', 7);
INSERT INTO `gen_table_column` VALUES (41, 4, 'address', '地址', 'varchar(200)', 'String', 'address', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'imageUpload', '', 8);
INSERT INTO `gen_table_column` VALUES (42, 4, 'class_id', '班级ID', 'bigint', 'Long', 'classId', 0, 0, 0, 1, 1, 1, 0, 'EQ', 'input', '', 9);
INSERT INTO `gen_table_column` VALUES (43, 4, 'status', '状态', 'tinyint', 'Integer', 'status', 0, 0, 0, 1, 1, 1, 1, 'EQ', 'select', 'sys_status', 10);
INSERT INTO `gen_table_column` VALUES (44, 4, 'deleted', 'deleted', 'tinyint', 'Integer', 'deleted', 0, 0, 0, 0, 0, 0, 0, 'EQ', 'input', '', 11);
INSERT INTO `gen_table_column` VALUES (45, 4, 'create_time', '创建时间', 'datetime', 'LocalDateTime', 'createTime', 0, 0, 0, 0, 0, 0, 0, 'EQ', 'datetime', '', 12);
INSERT INTO `gen_table_column` VALUES (46, 4, 'update_time', '更新时间', 'datetime', 'LocalDateTime', 'updateTime', 0, 0, 0, 0, 0, 0, 0, 'EQ', 'datetime', '', 13);

-- ----------------------------
-- Table structure for `qrtz_blob_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_blob_triggers`;
CREATE TABLE `qrtz_blob_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_name的外键',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
`blob_data` blob NULL COMMENT '存放持久化Trigger对象',
  PRIMARY KEY (`sched_name`, `trigger_name`, `trigger_group`) USING BTREE,
  CONSTRAINT `qrtz_blob_triggers_ibfk_1` FOREIGN KEY (`sched_name`, `trigger_name`, `trigger_group`) REFERENCES `qrtz_triggers` (`sched_name`, `trigger_name`, `trigger_group`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = 'Blob类型的触发器表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_blob_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_calendars`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_calendars`;
CREATE TABLE `qrtz_calendars`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`calendar_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '日历名称',
`calendar` blob NOT NULL COMMENT '存放持久化calendar对象',
  PRIMARY KEY (`sched_name`, `calendar_name`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '日历信息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_calendars
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_cron_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_cron_triggers`;
CREATE TABLE `qrtz_cron_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_name的外键',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
`cron_expression` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'cron表达式',
`time_zone_id` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '时区',
  PRIMARY KEY (`sched_name`, `trigger_name`, `trigger_group`) USING BTREE,
  CONSTRAINT `qrtz_cron_triggers_ibfk_1` FOREIGN KEY (`sched_name`, `trigger_name`, `trigger_group`) REFERENCES `qrtz_triggers` (`sched_name`, `trigger_name`, `trigger_group`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = 'Cron类型的触发器表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_cron_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_fired_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_fired_triggers`;
CREATE TABLE `qrtz_fired_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`entry_id` varchar(95) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度器实例id',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_name的外键',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
`instance_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度器实例名',
`fired_time` bigint NOT NULL COMMENT '触发的时间',
`sched_time` bigint NOT NULL COMMENT '定时器制定的时间',
`priority` int NOT NULL COMMENT '优先级',
`state` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '状态',
`job_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '任务名称',
`job_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '任务组名',
`is_nonconcurrent` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '是否并发',
`requests_recovery` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '是否接受恢复执行',
  PRIMARY KEY (`sched_name`, `entry_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '已触发的触发器表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_fired_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_job_details`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_job_details`;
CREATE TABLE `qrtz_job_details`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`job_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务名称',
`job_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务组名',
`description` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '相关介绍',
`job_class_name` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '执行任务类名称',
`is_durable` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '是否持久化',
`is_nonconcurrent` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '是否并发',
`is_update_data` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '是否更新数据',
`requests_recovery` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '是否接受恢复执行',
`job_data` blob NULL COMMENT '存放持久化job对象',
  PRIMARY KEY (`sched_name`, `job_name`, `job_group`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '任务详细信息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_job_details
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_locks`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_locks`;
CREATE TABLE `qrtz_locks`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`lock_name` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '悲观锁名称',
  PRIMARY KEY (`sched_name`, `lock_name`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '存储的悲观锁信息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_locks
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_paused_trigger_grps`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_paused_trigger_grps`;
CREATE TABLE `qrtz_paused_trigger_grps`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
  PRIMARY KEY (`sched_name`, `trigger_group`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '暂停的触发器表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_paused_trigger_grps
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_scheduler_state`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_scheduler_state`;
CREATE TABLE `qrtz_scheduler_state`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`instance_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '实例名称',
`last_checkin_time` bigint NOT NULL COMMENT '上次检查时间',
`checkin_interval` bigint NOT NULL COMMENT '检查间隔时间',
  PRIMARY KEY (`sched_name`, `instance_name`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '调度器状态表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_scheduler_state
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_simple_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_simple_triggers`;
CREATE TABLE `qrtz_simple_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_name的外键',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
`repeat_count` bigint NOT NULL COMMENT '重复的次数统计',
`repeat_interval` bigint NOT NULL COMMENT '重复的间隔时间',
`times_triggered` bigint NOT NULL COMMENT '已经触发的次数',
  PRIMARY KEY (`sched_name`, `trigger_name`, `trigger_group`) USING BTREE,
  CONSTRAINT `qrtz_simple_triggers_ibfk_1` FOREIGN KEY (`sched_name`, `trigger_name`, `trigger_group`) REFERENCES `qrtz_triggers` (`sched_name`, `trigger_name`, `trigger_group`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '简单触发器的信息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_simple_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_simprop_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_simprop_triggers`;
CREATE TABLE `qrtz_simprop_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_name的外键',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_triggers表trigger_group的外键',
`str_prop_1` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'String类型的trigger的第一个参数',
`str_prop_2` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'String类型的trigger的第二个参数',
`str_prop_3` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'String类型的trigger的第三个参数',
`int_prop_1` int NULL DEFAULT NULL COMMENT 'int类型的trigger的第一个参数',
`int_prop_2` int NULL DEFAULT NULL COMMENT 'int类型的trigger的第二个参数',
`long_prop_1` bigint NULL DEFAULT NULL COMMENT 'long类型的trigger的第一个参数',
`long_prop_2` bigint NULL DEFAULT NULL COMMENT 'long类型的trigger的第二个参数',
`dec_prop_1` decimal(13, 4) NULL DEFAULT NULL COMMENT 'decimal类型的trigger的第一个参数',
`dec_prop_2` decimal(13, 4) NULL DEFAULT NULL COMMENT 'decimal类型的trigger的第二个参数',
`bool_prop_1` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'Boolean类型的trigger的第一个参数',
`bool_prop_2` varchar(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'Boolean类型的trigger的第二个参数',
  PRIMARY KEY (`sched_name`, `trigger_name`, `trigger_group`) USING BTREE,
  CONSTRAINT `qrtz_simprop_triggers_ibfk_1` FOREIGN KEY (`sched_name`, `trigger_name`, `trigger_group`) REFERENCES `qrtz_triggers` (`sched_name`, `trigger_name`, `trigger_group`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '同步机制的行锁表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_simprop_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `qrtz_triggers`
-- ----------------------------
DROP TABLE IF EXISTS `qrtz_triggers`;
CREATE TABLE `qrtz_triggers`  (
`sched_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调度名称',
`trigger_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '触发器的名字',
`trigger_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '触发器所属组的名字',
`job_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_job_details表job_name的外键',
`job_group` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'qrtz_job_details表job_group的外键',
`description` varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '相关介绍',
`next_fire_time` bigint NULL DEFAULT NULL COMMENT '上一次触发时间（毫秒）',
`prev_fire_time` bigint NULL DEFAULT NULL COMMENT '下一次触发时间（默认为-1表示不触发）',
`priority` int NULL DEFAULT NULL COMMENT '优先级',
`trigger_state` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '触发器状态',
`trigger_type` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '触发器的类型',
`start_time` bigint NOT NULL COMMENT '开始时间',
`end_time` bigint NULL DEFAULT NULL COMMENT '结束时间',
`calendar_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '日程表名称',
`misfire_instr` smallint NULL DEFAULT NULL COMMENT '补偿执行的策略',
`job_data` blob NULL COMMENT '存放持久化job对象',
  PRIMARY KEY (`sched_name`, `trigger_name`, `trigger_group`) USING BTREE,
  INDEX `sched_name`(`sched_name` ASC, `job_name` ASC, `job_group` ASC) USING BTREE,
  CONSTRAINT `qrtz_triggers_ibfk_1` FOREIGN KEY (`sched_name`, `job_name`, `job_group`) REFERENCES `qrtz_job_details` (`sched_name`, `job_name`, `job_group`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '触发器详细信息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of qrtz_triggers
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `student`
-- ----------------------------
DROP TABLE IF EXISTS `student`;
CREATE TABLE `student`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`student_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '学号',
`name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '姓名',
`gender` tinyint NULL DEFAULT NULL COMMENT '性别 1男 2女',
`birthday` date NULL DEFAULT NULL COMMENT '出生日期',
`phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '手机号',
`email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '邮箱',
`address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '地址',
`class_id` bigint NULL DEFAULT NULL COMMENT '班级ID',
`status` tinyint NULL DEFAULT 1 COMMENT '状态',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标记',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '学生表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of student
-- ----------------------------
INSERT INTO `student` VALUES (4, '12', '12', NULL, NULL, '1', '1', '1', 1, 1, 1, '2026-02-09 12:55:30', '2026-02-09 12:55:33');
INSERT INTO `student` VALUES (5, '12', '12', NULL, NULL, '1', '1', '1', 1, 1, 1, '2026-03-01 11:16:15', '2026-03-01 11:16:34');
INSERT INTO `student` VALUES (6, '1', '1', 1, NULL, '11', '1', '1', 1, 1, 1, '2026-03-01 11:26:55', '2026-03-01 11:27:08');
INSERT INTO `student` VALUES (7, '12', '12', 1, NULL, '1', '1', '/api/files/images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg', 2, 1, 1, '2026-03-01 11:29:32', '2026-03-01 12:06:10');
INSERT INTO `student` VALUES (8, '11', '1', 1, NULL, '1', '1', '/api/files/images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg', 1, 1, 1, '2026-03-01 12:08:31', '2026-03-01 12:15:54');
INSERT INTO `student` VALUES (9, '1', '1', 1, '2026-03-03', '1', '1', '/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg', 1, 1, 0, '2026-02-28 12:16:13', '2026-02-28 12:16:13');

-- ----------------------------
-- Table structure for `sys_api_access_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_api_access_log`;
CREATE TABLE `sys_api_access_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`start_time` datetime NULL DEFAULT NULL COMMENT '请求开始时间',
`end_time` datetime NULL DEFAULT NULL COMMENT '请求结束时间',
`api_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'API路径',
`method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'HTTP方法',
`status_code` int NULL DEFAULT NULL COMMENT 'HTTP状态码',
`success` tinyint NULL DEFAULT 1 COMMENT '是否成功(0否 1是)',
`cost_time` bigint NULL DEFAULT NULL COMMENT '耗时(毫秒)',
`ip` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '客户端IP',
`user_id` bigint NULL DEFAULT NULL COMMENT '用户ID(未登录为空)',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_start_time`(`start_time` ASC) USING BTREE,
  INDEX `idx_api_path`(`api_path`(100) ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1835 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = 'API访问统计日志' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_api_access_log
-- ----------------------------
INSERT INTO `sys_api_access_log` VALUES (1, '2026-02-28 22:57:38', '2026-02-28 22:57:38', '/api/crypto/config', 'GET', 200, 1, 96, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (2, '2026-02-28 22:57:38', '2026-02-28 22:57:38', '/api/sys/config-group/public', 'GET', 200, 1, 100, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (3, '2026-02-28 22:57:38', '2026-02-28 22:57:38', '/api/auth/info', 'GET', 200, 1, 123, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (4, '2026-02-28 22:57:39', '2026-02-28 22:57:39', '/api/sys/chat/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (5, '2026-02-28 22:57:38', '2026-02-28 22:57:39', '/api/sys/notice/unread-count', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (6, '2026-02-28 22:58:08', '2026-02-28 22:58:08', '/api/sys/menu/tree', 'GET', 200, 1, 45, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (7, '2026-02-28 22:58:29', '2026-02-28 22:58:29', '/api/sys/menu', 'POST', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (8, '2026-02-28 22:58:29', '2026-02-28 22:58:29', '/api/sys/menu/tree', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (9, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (10, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (11, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/auth/info', 'GET', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (12, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (13, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/sys/notice/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (14, '2026-02-28 22:58:31', '2026-02-28 22:58:31', '/api/sys/menu/tree', 'GET', 200, 1, 25, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (15, '2026-02-28 22:58:32', '2026-02-28 22:58:32', '/api/sys/dept/tree', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (16, '2026-02-28 22:58:32', '2026-02-28 22:58:32', '/api/sys/menu/tree', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (17, '2026-02-28 22:58:32', '2026-02-28 22:58:32', '/api/sys/role/page', 'GET', 200, 1, 95, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (18, '2026-02-28 22:58:33', '2026-02-28 22:58:33', '/api/sys/role/1', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (19, '2026-02-28 22:58:37', '2026-02-28 22:58:37', '/api/sys/role', 'PUT', 200, 1, 178, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (20, '2026-02-28 22:58:37', '2026-02-28 22:58:37', '/api/sys/role/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (21, '2026-02-28 22:58:38', '2026-02-28 22:58:38', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (22, '2026-02-28 22:58:38', '2026-02-28 22:58:38', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (23, '2026-02-28 22:58:38', '2026-02-28 22:58:39', '/api/auth/info', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (24, '2026-02-28 22:58:39', '2026-02-28 22:58:39', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (25, '2026-02-28 22:58:39', '2026-02-28 22:58:39', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (26, '2026-02-28 22:58:39', '2026-02-28 22:58:39', '/api/sys/menu/tree', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (27, '2026-02-28 22:58:39', '2026-02-28 22:58:39', '/api/sys/dept/tree', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (28, '2026-02-28 22:58:39', '2026-02-28 22:58:39', '/api/sys/role/page', 'GET', 200, 1, 31, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (29, '2026-02-28 22:58:41', '2026-02-28 22:58:41', '/api/monitor/api-access/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (30, '2026-02-28 22:58:41', '2026-02-28 22:58:41', '/api/monitor/api-access/statistics', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (31, '2026-02-28 22:58:51', '2026-02-28 22:58:51', '/api/monitor/api-access/statistics', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (32, '2026-02-28 22:58:53', '2026-02-28 22:58:53', '/api/monitor/online/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (33, '2026-02-28 22:58:54', '2026-02-28 22:58:54', '/api/monitor/api-access/statistics', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (34, '2026-02-28 22:58:54', '2026-02-28 22:58:54', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (35, '2026-02-28 22:59:03', '2026-02-28 22:59:03', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (36, '2026-02-28 22:59:03', '2026-02-28 22:59:03', '/api/sys/config-group/list', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (37, '2026-02-28 22:59:03', '2026-02-28 22:59:03', '/api/sys/config-group/system', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (38, '2026-02-28 22:59:04', '2026-02-28 22:59:04', '/api/sys/config-group/register', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (39, '2026-02-28 22:59:04', '2026-02-28 22:59:04', '/api/sys/config-group/login', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (40, '2026-02-28 22:59:04', '2026-02-28 22:59:04', '/api/sys/config-group/password', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (41, '2026-02-28 22:59:05', '2026-02-28 22:59:05', '/api/monitor/api-access/statistics', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (42, '2026-02-28 22:59:05', '2026-02-28 22:59:05', '/api/monitor/api-access/page', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (43, '2026-02-28 22:59:15', '2026-02-28 22:59:15', '/api/monitor/api-access/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (44, '2026-02-28 22:59:25', '2026-02-28 22:59:25', '/api/monitor/api-access/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (45, '2026-02-28 22:59:35', '2026-02-28 22:59:35', '/api/monitor/api-access/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (46, '2026-02-28 22:59:45', '2026-02-28 22:59:45', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (47, '2026-02-28 22:59:45', '2026-02-28 22:59:45', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (48, '2026-02-28 22:59:45', '2026-02-28 22:59:45', '/api/auth/info', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (49, '2026-02-28 22:59:46', '2026-02-28 22:59:46', '/api/sys/chat/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (50, '2026-02-28 22:59:46', '2026-02-28 22:59:46', '/api/sys/notice/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (51, '2026-02-28 22:59:46', '2026-02-28 22:59:46', '/api/monitor/api-access/statistics', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (52, '2026-02-28 22:59:46', '2026-02-28 22:59:46', '/api/monitor/api-access/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (53, '2026-02-28 22:59:52', '2026-02-28 22:59:52', '/api/monitor/api-access/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (54, '2026-02-28 22:59:56', '2026-02-28 22:59:56', '/api/monitor/api-access/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (55, '2026-02-28 22:59:58', '2026-02-28 22:59:58', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (56, '2026-02-28 23:00:00', '2026-02-28 23:00:00', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (57, '2026-02-28 23:00:04', '2026-02-28 23:00:04', '/api/monitor/api-access/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (58, '2026-02-28 23:00:04', '2026-02-28 23:00:04', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (59, '2026-02-28 23:00:05', '2026-02-28 23:00:05', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (60, '2026-02-28 23:00:05', '2026-02-28 23:00:05', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (61, '2026-02-28 23:00:06', '2026-02-28 23:00:06', '/api/monitor/api-access/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (62, '2026-02-28 23:00:12', '2026-02-28 23:00:12', '/api/monitor/api-access/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (63, '2026-02-28 23:00:16', '2026-02-28 23:00:16', '/api/monitor/api-access/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (64, '2026-02-28 23:00:16', '2026-02-28 23:00:16', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (65, '2026-02-28 23:00:19', '2026-02-28 23:00:19', '/api/monitor/api-access/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (66, '2026-02-28 23:00:26', '2026-02-28 23:00:26', '/api/monitor/api-access/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (67, '2026-02-28 23:00:34', '2026-02-28 23:00:34', '/api/monitor/server-manager/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (68, '2026-02-28 23:00:36', '2026-02-28 23:00:36', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (69, '2026-02-28 23:00:36', '2026-02-28 23:00:36', '/api/monitor/cache/stats', 'GET', 200, 1, 52, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (70, '2026-02-28 23:00:36', '2026-02-28 23:00:36', '/api/monitor/job/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (71, '2026-02-28 23:00:36', '2026-02-28 23:00:36', '/api/monitor/job/log/statistics', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (72, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/online/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (73, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (74, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/job/log/statistics', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (75, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (76, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (77, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/server/info', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (78, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (79, '2026-02-28 23:00:37', '2026-02-28 23:00:37', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (80, '2026-02-28 23:00:38', '2026-02-28 23:00:38', '/api/monitor/online/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (81, '2026-02-28 23:00:39', '2026-02-28 23:00:39', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (82, '2026-02-28 23:00:39', '2026-02-28 23:00:39', '/api/monitor/cache/stats', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (83, '2026-02-28 23:00:40', '2026-02-28 23:00:40', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (84, '2026-02-28 23:00:41', '2026-02-28 23:00:41', '/api/monitor/job/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (85, '2026-02-28 23:00:41', '2026-02-28 23:00:41', '/api/monitor/job/log/statistics', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (86, '2026-02-28 23:00:42', '2026-02-28 23:00:42', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (87, '2026-02-28 23:00:42', '2026-02-28 23:00:42', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (88, '2026-02-28 23:00:44', '2026-02-28 23:00:44', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (89, '2026-02-28 23:00:47', '2026-02-28 23:00:47', '/api/monitor/server-manager/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (90, '2026-02-28 23:00:47', '2026-02-28 23:00:47', '/api/monitor/api-access/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (91, '2026-02-28 23:00:47', '2026-02-28 23:00:47', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (92, '2026-02-28 23:00:57', '2026-02-28 23:00:57', '/api/monitor/api-access/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (93, '2026-02-28 23:01:07', '2026-02-28 23:01:07', '/api/monitor/api-access/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (94, '2026-02-28 23:01:17', '2026-02-28 23:01:17', '/api/dashboard/stats', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (95, '2026-02-28 23:01:18', '2026-02-28 23:01:18', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (96, '2026-02-28 23:01:19', '2026-02-28 23:01:19', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (97, '2026-02-28 23:01:19', '2026-02-28 23:01:19', '/api/sys/user/page', 'GET', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (98, '2026-02-28 23:01:19', '2026-02-28 23:01:19', '/api/sys/post/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (99, '2026-02-28 23:01:19', '2026-02-28 23:01:19', '/api/sys/user/page', 'GET', 200, 1, 33, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (100, '2026-02-28 23:01:21', '2026-02-28 23:01:21', '/api/monitor/api-access/statistics', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (101, '2026-02-28 23:01:21', '2026-02-28 23:01:21', '/api/monitor/api-access/page', 'GET', 200, 1, 49, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (102, '2026-02-28 23:01:31', '2026-02-28 23:01:31', '/api/monitor/api-access/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (103, '2026-02-28 23:01:41', '2026-02-28 23:01:41', '/api/monitor/api-access/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (104, '2026-02-28 23:01:51', '2026-02-28 23:01:51', '/api/monitor/api-access/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (105, '2026-02-28 23:02:01', '2026-02-28 23:02:01', '/api/monitor/api-access/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (106, '2026-02-28 23:02:11', '2026-02-28 23:02:11', '/api/monitor/api-access/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (107, '2026-02-28 23:02:18', '2026-02-28 23:02:18', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (108, '2026-02-28 23:02:21', '2026-02-28 23:02:21', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (109, '2026-02-28 23:02:21', '2026-02-28 23:02:21', '/api/sys/user/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (110, '2026-02-28 23:02:23', '2026-02-28 23:02:23', '/api/sys/role/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (111, '2026-02-28 23:02:23', '2026-02-28 23:02:23', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (112, '2026-02-28 23:02:23', '2026-02-28 23:02:23', '/api/sys/post/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (113, '2026-02-28 23:02:23', '2026-02-28 23:02:23', '/api/sys/user/page', 'GET', 200, 1, 68, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (114, '2026-02-28 23:02:26', '2026-02-28 23:02:26', '/api/sys/user/2', 'DELETE', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (115, '2026-02-28 23:02:26', '2026-02-28 23:02:26', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (116, '2026-02-28 23:02:28', '2026-02-28 23:02:28', '/api/monitor/api-access/statistics', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (117, '2026-02-28 23:02:28', '2026-02-28 23:02:28', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (118, '2026-02-28 23:02:33', '2026-02-28 23:02:33', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (119, '2026-02-28 23:02:33', '2026-02-28 23:02:33', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (120, '2026-02-28 23:02:33', '2026-02-28 23:02:33', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (121, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (122, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (123, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (124, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (125, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (126, '2026-02-28 23:02:34', '2026-02-28 23:02:34', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (127, '2026-02-28 23:02:35', '2026-02-28 23:02:35', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (128, '2026-02-28 23:02:35', '2026-02-28 23:02:35', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (129, '2026-02-28 23:02:35', '2026-02-28 23:02:35', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (130, '2026-02-28 23:02:35', '2026-02-28 23:02:35', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (131, '2026-02-28 23:02:35', '2026-02-28 23:02:35', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (132, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (133, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (134, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (135, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (136, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (137, '2026-02-28 23:02:36', '2026-02-28 23:02:36', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (138, '2026-02-28 23:02:37', '2026-02-28 23:02:37', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (139, '2026-02-28 23:02:37', '2026-02-28 23:02:37', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (140, '2026-02-28 23:02:37', '2026-02-28 23:02:37', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (141, '2026-02-28 23:02:37', '2026-02-28 23:02:37', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (142, '2026-02-28 23:02:38', '2026-02-28 23:02:38', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (143, '2026-02-28 23:02:38', '2026-02-28 23:02:38', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (144, '2026-02-28 23:02:38', '2026-02-28 23:02:38', '/api/monitor/api-access/statistics', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (145, '2026-02-28 23:02:38', '2026-02-28 23:02:38', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (146, '2026-02-28 23:02:38', '2026-02-28 23:02:38', '/api/monitor/api-access/page', 'GET', 200, 1, 41, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (147, '2026-02-28 23:02:39', '2026-02-28 23:02:39', '/api/monitor/api-access/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (148, '2026-02-28 23:02:39', '2026-02-28 23:02:39', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (149, '2026-02-28 23:02:39', '2026-02-28 23:02:39', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (150, '2026-02-28 23:02:39', '2026-02-28 23:02:39', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (151, '2026-02-28 23:02:39', '2026-02-28 23:02:39', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (152, '2026-02-28 23:02:40', '2026-02-28 23:02:40', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (153, '2026-02-28 23:02:40', '2026-02-28 23:02:40', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (154, '2026-02-28 23:02:48', '2026-02-28 23:02:48', '/api/monitor/api-access/statistics', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (155, '2026-02-28 23:02:58', '2026-02-28 23:02:58', '/api/monitor/api-access/statistics', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (156, '2026-02-28 23:03:07', '2026-02-28 23:03:07', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (157, '2026-02-28 23:03:07', '2026-02-28 23:03:07', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (158, '2026-02-28 23:03:08', '2026-02-28 23:03:08', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (159, '2026-02-28 23:03:08', '2026-02-28 23:03:08', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (160, '2026-02-28 23:03:08', '2026-02-28 23:03:08', '/api/monitor/api-access/statistics', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (161, '2026-02-28 23:03:08', '2026-02-28 23:03:08', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (162, '2026-02-28 23:03:08', '2026-02-28 23:03:08', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (163, '2026-02-28 23:03:09', '2026-02-28 23:03:09', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (164, '2026-02-28 23:03:09', '2026-02-28 23:03:09', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (165, '2026-02-28 23:03:17', '2026-02-28 23:03:17', '/api/monitor/server-manager/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (166, '2026-02-28 23:03:18', '2026-02-28 23:03:18', '/api/monitor/api-access/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (167, '2026-02-28 23:03:18', '2026-02-28 23:03:18', '/api/monitor/api-access/statistics', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (168, '2026-02-28 23:03:19', '2026-02-28 23:03:19', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (169, '2026-02-28 23:03:19', '2026-02-28 23:03:19', '/api/monitor/api-access/statistics', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (170, '2026-02-28 23:03:25', '2026-02-28 23:03:25', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (171, '2026-02-28 23:03:29', '2026-02-28 23:03:29', '/api/monitor/api-access/statistics', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (172, '2026-02-28 23:03:29', '2026-02-28 23:03:29', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (173, '2026-02-28 23:03:38', '2026-02-28 23:03:38', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (174, '2026-02-28 23:03:39', '2026-02-28 23:03:39', '/api/monitor/api-access/statistics', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (175, '2026-02-28 23:03:41', '2026-02-28 23:03:41', '/api/monitor/server-manager/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (176, '2026-02-28 23:03:41', '2026-02-28 23:03:41', '/api/monitor/cache/keys', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (177, '2026-02-28 23:03:41', '2026-02-28 23:03:41', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (178, '2026-02-28 23:03:42', '2026-02-28 23:03:42', '/api/monitor/job/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (179, '2026-02-28 23:03:42', '2026-02-28 23:03:42', '/api/monitor/job/log/statistics', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (180, '2026-02-28 23:03:42', '2026-02-28 23:03:42', '/api/monitor/online/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (181, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/role/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (182, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/post/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (183, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (184, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/user/page', 'GET', 200, 1, 52, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (185, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (186, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/role/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (187, '2026-02-28 23:03:44', '2026-02-28 23:03:44', '/api/sys/menu/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (188, '2026-02-28 23:03:44', '2026-02-28 23:03:45', '/api/sys/menu/tree', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (189, '2026-02-28 23:03:45', '2026-02-28 23:03:45', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (190, '2026-02-28 23:03:45', '2026-02-28 23:03:45', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (191, '2026-02-28 23:03:45', '2026-02-28 23:03:45', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (192, '2026-02-28 23:03:47', '2026-02-28 23:03:47', '/api/sys/dept/tree', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (193, '2026-02-28 23:03:47', '2026-02-28 23:03:47', '/api/sys/user/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (194, '2026-02-28 23:03:47', '2026-02-28 23:03:47', '/api/sys/post/tree', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (195, '2026-02-28 23:03:47', '2026-02-28 23:03:47', '/api/sys/user/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (196, '2026-02-28 23:03:50', '2026-02-28 23:03:50', '/api/monitor/server-manager/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (197, '2026-02-28 23:03:51', '2026-02-28 23:03:51', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (198, '2026-02-28 23:03:51', '2026-02-28 23:03:51', '/api/monitor/api-access/statistics', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (199, '2026-02-28 23:03:53', '2026-02-28 23:03:53', '/api/monitor/server-manager/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (200, '2026-02-28 23:03:53', '2026-02-28 23:03:53', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (201, '2026-02-28 23:03:53', '2026-02-28 23:03:53', '/api/monitor/cache/keys', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (202, '2026-02-28 23:03:53', '2026-02-28 23:03:53', '/api/monitor/cache/stats', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (203, '2026-02-28 23:03:54', '2026-02-28 23:03:54', '/api/monitor/job/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (204, '2026-02-28 23:03:54', '2026-02-28 23:03:54', '/api/monitor/job/log/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (205, '2026-02-28 23:03:54', '2026-02-28 23:03:54', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (206, '2026-02-28 23:03:55', '2026-02-28 23:03:55', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (207, '2026-02-28 23:03:56', '2026-02-28 23:03:56', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (208, '2026-02-28 23:03:56', '2026-02-28 23:03:56', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (209, '2026-02-28 23:03:56', '2026-02-28 23:03:56', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (210, '2026-02-28 23:03:56', '2026-02-28 23:03:56', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (211, '2026-02-28 23:03:57', '2026-02-28 23:03:57', '/api/monitor/job/log/statistics', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (212, '2026-02-28 23:03:57', '2026-02-28 23:03:57', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (213, '2026-02-28 23:03:57', '2026-02-28 23:03:57', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (214, '2026-02-28 23:03:58', '2026-02-28 23:03:58', '/api/monitor/server-manager/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (215, '2026-02-28 23:03:58', '2026-02-28 23:03:58', '/api/monitor/server/info', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (216, '2026-02-28 23:03:59', '2026-02-28 23:03:59', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (217, '2026-02-28 23:04:03', '2026-02-28 23:04:03', '/api/sys/file-group/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (218, '2026-02-28 23:04:03', '2026-02-28 23:04:03', '/api/sys/file/page-by-group', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (219, '2026-02-28 23:04:08', '2026-02-28 23:04:08', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (220, '2026-02-28 23:04:08', '2026-02-28 23:04:08', '/api/monitor/job/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (221, '2026-02-28 23:04:08', '2026-02-28 23:04:08', '/api/monitor/job/log/statistics', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (222, '2026-02-28 23:04:08', '2026-02-28 23:04:08', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (223, '2026-02-28 23:04:08', '2026-02-28 23:04:08', '/api/monitor/cache/stats', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (224, '2026-02-28 23:04:09', '2026-02-28 23:04:09', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (225, '2026-02-28 23:04:09', '2026-02-28 23:04:09', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (226, '2026-02-28 23:04:09', '2026-02-28 23:04:09', '/api/monitor/api-access/statistics', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (227, '2026-02-28 23:04:19', '2026-02-28 23:04:19', '/api/monitor/api-access/statistics', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (228, '2026-02-28 23:04:29', '2026-02-28 23:04:29', '/api/monitor/api-access/statistics', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (229, '2026-02-28 23:04:39', '2026-02-28 23:04:39', '/api/monitor/api-access/statistics', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (230, '2026-02-28 23:04:46', '2026-02-28 23:04:46', '/api/monitor/api-access/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (231, '2026-02-28 23:04:47', '2026-02-28 23:04:47', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (232, '2026-02-28 23:04:47', '2026-02-28 23:04:47', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (233, '2026-02-28 23:04:49', '2026-02-28 23:04:49', '/api/monitor/api-access/statistics', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (234, '2026-02-28 23:04:51', '2026-02-28 23:04:51', '/api/monitor/server-manager/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (235, '2026-02-28 23:04:52', '2026-02-28 23:04:52', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (236, '2026-02-28 23:04:52', '2026-02-28 23:04:52', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (237, '2026-02-28 23:04:52', '2026-02-28 23:04:52', '/api/monitor/cache/stats', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (238, '2026-02-28 23:04:53', '2026-02-28 23:04:53', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (239, '2026-02-28 23:04:53', '2026-02-28 23:04:53', '/api/monitor/job/log/statistics', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (240, '2026-02-28 23:04:53', '2026-02-28 23:04:53', '/api/monitor/online/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (241, '2026-02-28 23:04:54', '2026-02-28 23:04:54', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (242, '2026-02-28 23:04:54', '2026-02-28 23:04:54', '/api/monitor/job/log/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (243, '2026-02-28 23:04:54', '2026-02-28 23:04:54', '/api/monitor/cache/stats', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (244, '2026-02-28 23:04:54', '2026-02-28 23:04:54', '/api/monitor/cache/keys', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (245, '2026-02-28 23:04:55', '2026-02-28 23:04:55', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (246, '2026-02-28 23:04:55', '2026-02-28 23:04:55', '/api/sys/user/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (247, '2026-02-28 23:04:56', '2026-02-28 23:04:56', '/api/sys/post/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (248, '2026-02-28 23:04:56', '2026-02-28 23:04:56', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (249, '2026-02-28 23:04:56', '2026-02-28 23:04:56', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (250, '2026-02-28 23:04:56', '2026-02-28 23:04:56', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (251, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/role/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (252, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/post/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (253, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (254, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/user/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (255, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (256, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/menu/tree', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (257, '2026-02-28 23:04:57', '2026-02-28 23:04:57', '/api/sys/role/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (258, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/menu/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (259, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/dict/type/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (260, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (261, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (262, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (263, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/dict/type/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (264, '2026-02-28 23:04:58', '2026-02-28 23:04:58', '/api/sys/menu/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (265, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (266, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/menu/tree', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (267, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/role/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (268, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/role/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (269, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/post/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (270, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (271, '2026-02-28 23:04:59', '2026-02-28 23:04:59', '/api/sys/user/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (272, '2026-02-28 23:05:08', '2026-02-28 23:05:08', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (273, '2026-02-28 23:05:08', '2026-02-28 23:05:08', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (274, '2026-02-28 23:05:08', '2026-02-28 23:05:08', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (275, '2026-02-28 23:05:09', '2026-02-28 23:05:09', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (276, '2026-02-28 23:05:09', '2026-02-28 23:05:09', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (277, '2026-02-28 23:05:09', '2026-02-28 23:05:09', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (278, '2026-02-28 23:05:12', '2026-02-28 23:05:12', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (279, '2026-02-28 23:05:15', '2026-02-28 23:05:15', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (280, '2026-02-28 23:05:18', '2026-02-28 23:05:18', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (281, '2026-02-28 23:05:21', '2026-02-28 23:05:21', '/api/monitor/cache/value', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (282, '2026-02-28 23:05:21', '2026-02-28 23:05:21', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (283, '2026-02-28 23:05:24', '2026-02-28 23:05:24', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (284, '2026-02-28 23:05:27', '2026-02-28 23:05:27', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (285, '2026-02-28 23:05:31', '2026-02-28 23:05:31', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (286, '2026-02-28 23:05:34', '2026-02-28 23:05:34', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (287, '2026-02-28 23:05:37', '2026-02-28 23:05:37', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (288, '2026-02-28 23:05:40', '2026-02-28 23:05:40', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (289, '2026-02-28 23:05:43', '2026-02-28 23:05:43', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (290, '2026-02-28 23:05:46', '2026-02-28 23:05:46', '/api/monitor/cache/stats', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (291, '2026-02-28 23:05:48', '2026-02-28 23:05:48', '/api/monitor/cache/stats', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (292, '2026-02-28 23:05:49', '2026-02-28 23:05:49', '/api/monitor/cache/value', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (293, '2026-02-28 23:05:51', '2026-02-28 23:05:51', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (294, '2026-02-28 23:05:53', '2026-02-28 23:05:53', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (295, '2026-02-28 23:05:53', '2026-02-28 23:05:53', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (296, '2026-02-28 23:05:54', '2026-02-28 23:05:54', '/api/monitor/cache/keys', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (297, '2026-02-28 23:05:54', '2026-02-28 23:05:54', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (298, '2026-02-28 23:05:54', '2026-02-28 23:05:54', '/api/monitor/cache/keys', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (299, '2026-02-28 23:05:54', '2026-02-28 23:05:54', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (300, '2026-02-28 23:05:55', '2026-02-28 23:05:55', '/api/monitor/cache/value', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (301, '2026-02-28 23:05:57', '2026-02-28 23:05:57', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (302, '2026-02-28 23:06:00', '2026-02-28 23:06:00', '/api/monitor/api-access/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (303, '2026-02-28 23:06:00', '2026-02-28 23:06:00', '/api/monitor/api-access/statistics', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (304, '2026-02-28 23:06:03', '2026-02-28 23:06:03', '/api/monitor/job/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (305, '2026-02-28 23:06:03', '2026-02-28 23:06:03', '/api/monitor/job/log/statistics', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (306, '2026-02-28 23:06:04', '2026-02-28 23:06:04', '/api/monitor/online/list', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (307, '2026-02-28 23:06:05', '2026-02-28 23:06:05', '/api/monitor/operlog/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (308, '2026-02-28 23:06:05', '2026-02-28 23:06:05', '/api/monitor/loginlog/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (309, '2026-02-28 23:06:06', '2026-02-28 23:06:06', '/api/monitor/operlog/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (310, '2026-02-28 23:06:08', '2026-02-28 23:06:08', '/api/monitor/online/list', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (311, '2026-02-28 23:06:08', '2026-02-28 23:06:08', '/api/monitor/job/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (312, '2026-02-28 23:06:08', '2026-02-28 23:06:08', '/api/monitor/job/log/statistics', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (313, '2026-02-28 23:06:08', '2026-02-28 23:06:08', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (314, '2026-02-28 23:06:08', '2026-02-28 23:06:08', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (315, '2026-02-28 23:06:09', '2026-02-28 23:06:09', '/api/monitor/server-manager/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (316, '2026-02-28 23:06:09', '2026-02-28 23:06:09', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (317, '2026-02-28 23:06:09', '2026-02-28 23:06:09', '/api/monitor/api-access/statistics', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (318, '2026-02-28 23:06:12', '2026-02-28 23:06:12', '/api/monitor/operlog/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (319, '2026-02-28 23:06:13', '2026-02-28 23:06:13', '/api/monitor/loginlog/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (320, '2026-02-28 23:06:14', '2026-02-28 23:06:14', '/api/monitor/operlog/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (321, '2026-02-28 23:06:14', '2026-02-28 23:06:14', '/api/monitor/loginlog/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (322, '2026-02-28 23:06:15', '2026-02-28 23:06:15', '/api/monitor/operlog/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (323, '2026-02-28 23:06:37', '2026-02-28 23:06:37', '/api/monitor/online/list', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (324, '2026-02-28 23:06:38', '2026-02-28 23:06:38', '/api/monitor/job/log/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (325, '2026-02-28 23:06:38', '2026-02-28 23:06:38', '/api/monitor/job/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (326, '2026-02-28 23:06:38', '2026-02-28 23:06:38', '/api/monitor/cache/keys', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (327, '2026-02-28 23:06:38', '2026-02-28 23:06:38', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (328, '2026-02-28 23:06:39', '2026-02-28 23:06:39', '/api/monitor/server-manager/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (329, '2026-02-28 23:06:39', '2026-02-28 23:06:39', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (330, '2026-02-28 23:06:39', '2026-02-28 23:06:39', '/api/monitor/api-access/statistics', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (331, '2026-02-28 23:06:39', '2026-02-28 23:06:39', '/api/monitor/server-manager/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (332, '2026-02-28 23:06:40', '2026-02-28 23:06:40', '/api/monitor/job/log/statistics', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (333, '2026-02-28 23:06:40', '2026-02-28 23:06:40', '/api/monitor/job/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (334, '2026-02-28 23:06:41', '2026-02-28 23:06:41', '/api/monitor/server-manager/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (335, '2026-02-28 23:06:41', '2026-02-28 23:06:41', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (336, '2026-02-28 23:06:41', '2026-02-28 23:06:41', '/api/monitor/api-access/statistics', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (337, '2026-02-28 23:06:48', '2026-02-28 23:06:48', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (338, '2026-02-28 23:06:48', '2026-02-28 23:06:48', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (339, '2026-02-28 23:06:48', '2026-02-28 23:06:48', '/api/monitor/api-access/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (340, '2026-02-28 23:06:51', '2026-02-28 23:06:51', '/api/monitor/api-access/statistics', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (341, '2026-02-28 23:06:59', '2026-02-28 23:06:59', '/api/monitor/api-access/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (342, '2026-02-28 23:07:00', '2026-02-28 23:07:00', '/api/monitor/api-access/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (343, '2026-02-28 23:07:01', '2026-02-28 23:07:01', '/api/monitor/api-access/statistics', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (344, '2026-02-28 23:07:02', '2026-02-28 23:07:02', '/api/monitor/api-access/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (345, '2026-02-28 23:07:03', '2026-02-28 23:07:03', '/api/monitor/api-access/page', 'GET', 200, 1, 71, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (346, '2026-02-28 23:07:04', '2026-02-28 23:07:04', '/api/monitor/loginlog/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (347, '2026-02-28 23:07:04', '2026-02-28 23:07:04', '/api/monitor/operlog/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (348, '2026-02-28 23:07:06', '2026-02-28 23:07:06', '/api/monitor/online/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (349, '2026-02-28 23:07:06', '2026-02-28 23:07:06', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (350, '2026-02-28 23:07:06', '2026-02-28 23:07:06', '/api/monitor/job/log/statistics', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (351, '2026-02-28 23:07:06', '2026-02-28 23:07:06', '/api/monitor/server/info', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (352, '2026-02-28 23:07:11', '2026-02-28 23:07:11', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (353, '2026-02-28 23:07:16', '2026-02-28 23:07:16', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (354, '2026-02-28 23:07:21', '2026-02-28 23:07:21', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (355, '2026-02-28 23:07:26', '2026-02-28 23:07:26', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (356, '2026-02-28 23:07:31', '2026-02-28 23:07:31', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (357, '2026-02-28 23:07:36', '2026-02-28 23:07:36', '/api/monitor/server/info', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (358, '2026-02-28 23:07:41', '2026-02-28 23:07:41', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (359, '2026-02-28 23:07:46', '2026-02-28 23:07:46', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (360, '2026-02-28 23:07:51', '2026-02-28 23:07:51', '/api/monitor/server/info', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (361, '2026-02-28 23:07:56', '2026-02-28 23:07:56', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (362, '2026-02-28 23:08:01', '2026-02-28 23:08:01', '/api/monitor/server/info', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (363, '2026-02-28 23:08:06', '2026-02-28 23:08:06', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (364, '2026-02-28 23:08:08', '2026-02-28 23:08:08', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (365, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (366, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (367, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/sys/notice/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (368, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (369, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (370, '2026-02-28 23:17:16', '2026-02-28 23:17:16', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (371, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/sys/notice/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (372, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/sys/chat/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (373, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (374, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (375, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (376, '2026-02-28 23:17:18', '2026-02-28 23:17:18', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (377, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/sys/chat/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (378, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/sys/notice/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (379, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (380, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (381, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (382, '2026-02-28 23:18:07', '2026-02-28 23:18:07', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (383, '2026-02-28 23:18:49', '2026-02-28 23:18:49', '/api/sys/notice/page', 'GET', 200, 1, 606, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (384, '2026-02-28 23:18:50', '2026-02-28 23:18:50', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (385, '2026-02-28 23:20:02', '2026-02-28 23:20:02', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (386, '2026-02-28 23:20:02', '2026-02-28 23:20:02', '/api/sys/notice/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (387, '2026-02-28 23:20:02', '2026-02-28 23:20:02', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (388, '2026-02-28 23:20:33', '2026-02-28 23:20:33', '/api/sys/notice/channels', 'GET', 200, 1, 70, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (389, '2026-02-28 23:20:33', '2026-02-28 23:20:33', '/api/sys/user/page', 'GET', 200, 1, 350, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (390, '2026-02-28 23:20:53', '2026-02-28 23:20:53', '/api/crypto/config', 'GET', 200, 1, 6, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (391, '2026-02-28 23:20:53', '2026-02-28 23:20:53', '/api/sys/config-group/public', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (392, '2026-02-28 23:20:53', '2026-02-28 23:20:54', '/api/auth/info', 'GET', 200, 1, 78, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (393, '2026-02-28 23:20:54', '2026-02-28 23:20:54', '/api/sys/notice/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (394, '2026-02-28 23:20:54', '2026-02-28 23:20:54', '/api/sys/chat/unread-count', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (395, '2026-02-28 23:20:54', '2026-02-28 23:20:54', '/api/sys/notice/channels', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (396, '2026-02-28 23:20:54', '2026-02-28 23:20:54', '/api/sys/notice/page', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (397, '2026-02-28 23:20:55', '2026-02-28 23:20:55', '/api/sys/notice/channels', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (398, '2026-02-28 23:20:55', '2026-02-28 23:20:55', '/api/sys/user/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (399, '2026-02-28 23:20:58', '2026-02-28 23:20:58', '/api/sys/chat/users', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (400, '2026-02-28 23:20:58', '2026-02-28 23:20:58', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (401, '2026-02-28 23:20:58', '2026-02-28 23:20:58', '/api/sys/chat/online/10', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (402, '2026-02-28 23:20:58', '2026-02-28 23:20:58', '/api/sys/chat/online/4', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (403, '2026-02-28 23:20:58', '2026-02-28 23:20:58', '/api/chat/group/list', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (404, '2026-02-28 23:20:59', '2026-02-28 23:20:59', '/api/sys/notice/channels', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (405, '2026-02-28 23:20:59', '2026-02-28 23:20:59', '/api/sys/notice/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (406, '2026-02-28 23:21:03', '2026-02-28 23:21:03', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (407, '2026-02-28 23:21:03', '2026-02-28 23:21:03', '/api/sys/user/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (408, '2026-02-28 23:21:46', '2026-02-28 23:21:46', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (409, '2026-02-28 23:21:46', '2026-02-28 23:21:46', '/api/sys/user/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (410, '2026-02-28 23:22:18', '2026-02-28 23:22:18', '/api/sys/role/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (411, '2026-02-28 23:22:18', '2026-02-28 23:22:18', '/api/sys/dept/tree', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (412, '2026-02-28 23:22:18', '2026-02-28 23:22:18', '/api/sys/post/list', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (413, '2026-02-28 23:22:18', '2026-02-28 23:22:18', '/api/sys/user/page', 'GET', 200, 1, 47, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (414, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/role/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (415, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/menu/tree', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (416, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/dept/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (417, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/role/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (418, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (419, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/post/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (420, '2026-02-28 23:22:19', '2026-02-28 23:22:19', '/api/sys/user/page', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (421, '2026-02-28 23:22:25', '2026-02-28 23:22:25', '/api/sys/user/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (422, '2026-02-28 23:22:35', '2026-02-28 23:22:35', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (423, '2026-02-28 23:22:35', '2026-02-28 23:22:35', '/api/sys/notice/page', 'GET', 200, 1, 33, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (424, '2026-02-28 23:22:36', '2026-02-28 23:22:36', '/api/sys/notice/channels', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (425, '2026-02-28 23:22:36', '2026-02-28 23:22:36', '/api/sys/user/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (426, '2026-02-28 23:23:37', '2026-02-28 23:23:37', '/api/sys/notice/channels', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (427, '2026-02-28 23:23:37', '2026-02-28 23:23:37', '/api/sys/notice/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (428, '2026-02-28 23:23:37', '2026-02-28 23:23:37', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (429, '2026-02-28 23:23:37', '2026-02-28 23:23:37', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (430, '2026-02-28 23:23:39', '2026-02-28 23:23:39', '/api/sys/notice/channels', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (431, '2026-02-28 23:23:39', '2026-02-28 23:23:39', '/api/sys/user/page', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (432, '2026-02-28 23:23:39', '2026-02-28 23:23:39', '/api/sys/dept/tree', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (433, '2026-02-28 23:23:54', '2026-02-28 23:23:54', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (434, '2026-02-28 23:23:54', '2026-02-28 23:23:54', '/api/sys/config-group/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (435, '2026-02-28 23:23:54', '2026-02-28 23:23:54', '/api/sys/config-group/system', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (436, '2026-02-28 23:23:56', '2026-02-28 23:23:56', '/api/sys/config-group/push', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (437, '2026-02-28 23:25:06', '2026-02-28 23:25:06', '/api/sys/notice/channels', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (438, '2026-02-28 23:25:06', '2026-02-28 23:25:06', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (439, '2026-02-28 23:25:08', '2026-02-28 23:25:08', '/api/sys/notice/channels', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (440, '2026-02-28 23:25:08', '2026-02-28 23:25:08', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (441, '2026-02-28 23:25:08', '2026-02-28 23:25:08', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (442, '2026-02-28 23:25:27', '2026-02-28 23:25:27', '/api/sys/notice', 'POST', 200, 1, 62, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (443, '2026-02-28 23:25:27', '2026-02-28 23:25:28', '/api/sys/notice/page', 'GET', 200, 1, 32, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (444, '2026-02-28 23:25:35', '2026-02-28 23:25:35', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (445, '2026-02-28 23:25:35', '2026-02-28 23:25:35', '/api/sys/notice/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (446, '2026-02-28 23:25:35', '2026-02-28 23:25:35', '/api/sys/notice/my', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (447, '2026-02-28 23:25:52', '2026-02-28 23:25:52', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (448, '2026-02-28 23:25:52', '2026-02-28 23:25:52', '/api/sys/config-group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (449, '2026-02-28 23:25:52', '2026-02-28 23:25:52', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (450, '2026-02-28 23:25:53', '2026-02-28 23:25:53', '/api/sys/config-group/push', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (451, '2026-02-28 23:26:14', '2026-02-28 23:26:14', '/api/sys/config-group/push', 'POST', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (452, '2026-02-28 23:26:15', '2026-02-28 23:26:15', '/api/sys/config-group/refresh', 'POST', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (453, '2026-02-28 23:26:15', '2026-02-28 23:26:15', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (454, '2026-02-28 23:26:15', '2026-02-28 23:26:15', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (455, '2026-02-28 23:26:16', '2026-02-28 23:26:16', '/api/sys/chat/users', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (456, '2026-02-28 23:26:16', '2026-02-28 23:26:16', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (457, '2026-02-28 23:26:16', '2026-02-28 23:26:16', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (458, '2026-02-28 23:26:16', '2026-02-28 23:26:16', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (459, '2026-02-28 23:26:16', '2026-02-28 23:26:16', '/api/chat/group/list', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (460, '2026-02-28 23:26:18', '2026-02-28 23:26:18', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (461, '2026-02-28 23:26:18', '2026-02-28 23:26:18', '/api/sys/notice/page', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (462, '2026-02-28 23:26:18', '2026-02-28 23:26:18', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (463, '2026-02-28 23:26:18', '2026-02-28 23:26:18', '/api/sys/user/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (464, '2026-02-28 23:26:18', '2026-02-28 23:26:18', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (465, '2026-02-28 23:26:38', '2026-02-28 23:26:38', '/api/sys/notice', 'POST', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (466, '2026-02-28 23:26:38', '2026-02-28 23:26:38', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (467, '2026-02-28 23:26:57', '2026-02-28 23:26:57', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (468, '2026-02-28 23:26:57', '2026-02-28 23:26:57', '/api/sys/user/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (469, '2026-02-28 23:26:57', '2026-02-28 23:26:57', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (470, '2026-02-28 23:26:57', '2026-02-28 23:26:57', '/api/sys/notice/5', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (471, '2026-02-28 23:27:29', '2026-02-28 23:27:29', '/api/sys/notice/5', 'DELETE', 200, 1, 124, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (472, '2026-02-28 23:27:29', '2026-02-28 23:27:29', '/api/sys/notice/page', 'GET', 200, 1, 97, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (473, '2026-02-28 23:27:32', '2026-02-28 23:27:32', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (474, '2026-02-28 23:27:32', '2026-02-28 23:27:32', '/api/sys/config-group/public', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (475, '2026-02-28 23:27:32', '2026-02-28 23:27:33', '/api/auth/info', 'GET', 200, 1, 92, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (476, '2026-02-28 23:27:33', '2026-02-28 23:27:33', '/api/sys/notice/channels', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (477, '2026-02-28 23:27:33', '2026-02-28 23:27:33', '/api/sys/notice/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (478, '2026-02-28 23:27:33', '2026-02-28 23:27:33', '/api/sys/chat/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (479, '2026-02-28 23:27:33', '2026-02-28 23:27:33', '/api/sys/notice/page', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (480, '2026-02-28 23:27:34', '2026-02-28 23:27:34', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (481, '2026-02-28 23:27:34', '2026-02-28 23:27:34', '/api/sys/user/page', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (482, '2026-02-28 23:27:34', '2026-02-28 23:27:34', '/api/sys/dept/tree', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (483, '2026-02-28 23:27:42', '2026-02-28 23:27:42', '/api/sys/notice', 'POST', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (484, '2026-02-28 23:27:42', '2026-02-28 23:27:42', '/api/sys/notice/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (485, '2026-02-28 23:28:13', '2026-02-28 23:28:13', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (486, '2026-02-28 23:28:13', '2026-02-28 23:28:13', '/api/sys/user/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (487, '2026-02-28 23:28:13', '2026-02-28 23:28:13', '/api/sys/dept/tree', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (488, '2026-02-28 23:28:13', '2026-02-28 23:28:13', '/api/sys/notice/6', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (489, '2026-02-28 23:28:15', '2026-02-28 23:28:15', '/api/sys/notice', 'PUT', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (490, '2026-02-28 23:28:15', '2026-02-28 23:28:15', '/api/sys/notice/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (491, '2026-02-28 23:28:34', '2026-02-28 23:28:34', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (492, '2026-02-28 23:28:34', '2026-02-28 23:28:34', '/api/sys/user/page', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (493, '2026-02-28 23:28:34', '2026-02-28 23:28:34', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (494, '2026-02-28 23:28:40', '2026-02-28 23:28:40', '/api/sys/notice', 'POST', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (495, '2026-02-28 23:28:40', '2026-02-28 23:28:40', '/api/sys/notice/page', 'GET', 200, 1, 41, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (496, '2026-02-28 23:31:45', '2026-02-28 23:31:45', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (497, '2026-02-28 23:31:45', '2026-02-28 23:31:45', '/api/sys/config-group/list', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (498, '2026-02-28 23:31:45', '2026-02-28 23:31:45', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (499, '2026-02-28 23:31:45', '2026-02-28 23:31:45', '/api/sys/dict/type/page', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (500, '2026-02-28 23:28:52', '2026-02-28 23:31:46', '/api/sys/notice/7/publish', 'POST', 200, 1, 173829, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (501, '2026-02-28 23:31:47', '2026-02-28 23:31:47', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (502, '2026-02-28 23:31:47', '2026-02-28 23:31:47', '/api/sys/config-group/list', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (503, '2026-02-28 23:31:47', '2026-02-28 23:31:47', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (504, '2026-02-28 23:31:54', '2026-02-28 23:31:54', '/api/sys/dict/type/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (505, '2026-02-28 23:31:55', '2026-02-28 23:31:55', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (506, '2026-02-28 23:31:55', '2026-02-28 23:31:55', '/api/sys/config-group/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (507, '2026-02-28 23:31:55', '2026-02-28 23:31:55', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (508, '2026-02-28 23:31:57', '2026-02-28 23:31:57', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (509, '2026-02-28 23:31:57', '2026-02-28 23:31:57', '/api/sys/notice/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (510, '2026-02-28 23:32:00', '2026-02-28 23:32:00', '/api/sys/notice/7', 'DELETE', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (511, '2026-02-28 23:32:00', '2026-02-28 23:32:00', '/api/sys/notice/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (512, '2026-02-28 23:32:02', '2026-02-28 23:32:02', '/api/sys/notice/6', 'DELETE', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (513, '2026-02-28 23:32:02', '2026-02-28 23:32:02', '/api/sys/notice/page', 'GET', 200, 1, 47, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (514, '2026-02-28 23:32:03', '2026-02-28 23:32:03', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (515, '2026-02-28 23:32:03', '2026-02-28 23:32:03', '/api/sys/user/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (516, '2026-02-28 23:32:03', '2026-02-28 23:32:03', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (517, '2026-02-28 23:32:12', '2026-02-28 23:32:12', '/api/sys/notice', 'POST', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (518, '2026-02-28 23:32:12', '2026-02-28 23:32:12', '/api/sys/notice/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (519, '2026-02-28 23:32:14', '2026-02-28 23:32:20', '/api/sys/notice/8/publish', 'POST', 200, 1, 5145, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (520, '2026-02-28 23:32:20', '2026-02-28 23:32:20', '/api/sys/notice/page', 'GET', 200, 1, 91, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (521, '2026-02-28 23:32:28', '2026-02-28 23:32:28', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (522, '2026-02-28 23:32:28', '2026-02-28 23:32:28', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (523, '2026-02-28 23:32:28', '2026-02-28 23:32:28', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (524, '2026-02-28 23:32:28', '2026-02-28 23:32:28', '/api/sys/notice/8', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (525, '2026-02-28 23:32:38', '2026-02-28 23:32:38', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (526, '2026-02-28 23:32:38', '2026-02-28 23:32:38', '/api/sys/user/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (527, '2026-02-28 23:32:38', '2026-02-28 23:32:38', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (528, '2026-02-28 23:32:44', '2026-02-28 23:32:44', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (529, '2026-02-28 23:32:44', '2026-02-28 23:32:44', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (530, '2026-02-28 23:32:44', '2026-02-28 23:32:44', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (531, '2026-02-28 23:32:47', '2026-02-28 23:32:47', '/api/sys/dict/type/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (532, '2026-02-28 23:32:47', '2026-02-28 23:32:47', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (533, '2026-02-28 23:32:47', '2026-02-28 23:32:47', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (534, '2026-02-28 23:32:47', '2026-02-28 23:32:47', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (535, '2026-02-28 23:32:48', '2026-02-28 23:32:48', '/api/sys/dict/type/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (536, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (537, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (538, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (539, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/dict/type/page', 'GET', 200, 1, 37, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (540, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (541, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (542, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/config-group/system', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (543, '2026-02-28 23:32:49', '2026-02-28 23:32:49', '/api/sys/dict/type/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (544, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (545, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (546, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (547, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/dict/type/page', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (548, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (549, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (550, '2026-02-28 23:32:50', '2026-02-28 23:32:50', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (551, '2026-02-28 23:32:51', '2026-02-28 23:32:51', '/api/sys/dict/type/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (552, '2026-02-28 23:32:53', '2026-02-28 23:32:53', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (553, '2026-02-28 23:32:53', '2026-02-28 23:32:53', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (554, '2026-02-28 23:32:53', '2026-02-28 23:32:53', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (555, '2026-02-28 23:32:53', '2026-02-28 23:32:53', '/api/sys/dict/type/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (556, '2026-02-28 23:32:54', '2026-02-28 23:32:54', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (557, '2026-02-28 23:32:54', '2026-02-28 23:32:54', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (558, '2026-02-28 23:32:54', '2026-02-28 23:32:54', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (559, '2026-02-28 23:32:54', '2026-02-28 23:32:54', '/api/sys/dict/type/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (560, '2026-02-28 23:32:55', '2026-02-28 23:32:55', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (561, '2026-02-28 23:32:55', '2026-02-28 23:32:55', '/api/sys/config-group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (562, '2026-02-28 23:32:55', '2026-02-28 23:32:55', '/api/sys/config-group/system', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (563, '2026-02-28 23:32:57', '2026-02-28 23:32:57', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (564, '2026-02-28 23:32:57', '2026-02-28 23:32:57', '/api/sys/notice/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (565, '2026-02-28 23:32:59', '2026-02-28 23:32:59', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (566, '2026-02-28 23:32:59', '2026-02-28 23:32:59', '/api/sys/user/page', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (567, '2026-02-28 23:32:59', '2026-02-28 23:32:59', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (568, '2026-02-28 23:32:59', '2026-02-28 23:32:59', '/api/sys/notice/8', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (569, '2026-02-28 23:34:40', '2026-02-28 23:34:40', '/api/sys/notice/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (570, '2026-02-28 23:34:40', '2026-02-28 23:34:40', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (571, '2026-02-28 23:34:40', '2026-02-28 23:34:40', '/api/sys/notice/my', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (572, '2026-02-28 23:34:41', '2026-02-28 23:34:41', '/api/sys/chat/contacts', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (573, '2026-02-28 23:34:42', '2026-02-28 23:34:42', '/api/sys/notice/my', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (574, '2026-02-28 23:34:44', '2026-02-28 23:34:44', '/api/sys/notice/read-all', 'POST', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (575, '2026-02-28 23:34:44', '2026-02-28 23:34:44', '/api/sys/notice/my', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (576, '2026-02-28 23:34:47', '2026-02-28 23:34:47', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (577, '2026-02-28 23:34:47', '2026-02-28 23:34:47', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (578, '2026-02-28 23:34:47', '2026-02-28 23:34:47', '/api/sys/notice/my', 'GET', 200, 1, 32, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (579, '2026-02-28 23:34:48', '2026-02-28 23:34:48', '/api/sys/chat/contacts', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (580, '2026-02-28 23:34:49', '2026-02-28 23:34:49', '/api/sys/notice/my', 'GET', 200, 1, 25, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (581, '2026-02-28 23:34:49', '2026-02-28 23:34:49', '/api/sys/chat/contacts', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (582, '2026-02-28 23:34:50', '2026-02-28 23:34:50', '/api/sys/notice/my', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (583, '2026-02-28 23:35:11', '2026-02-28 23:35:11', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (584, '2026-02-28 23:35:11', '2026-02-28 23:35:11', '/api/sys/user/page', 'GET', 200, 1, 40, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (585, '2026-02-28 23:35:11', '2026-02-28 23:35:11', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (586, '2026-02-28 23:35:17', '2026-02-28 23:35:17', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (587, '2026-02-28 23:35:17', '2026-02-28 23:35:17', '/api/sys/menu/tree', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (588, '2026-02-28 23:35:17', '2026-02-28 23:35:17', '/api/sys/role/page', 'GET', 200, 1, 67, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (589, '2026-02-28 23:35:18', '2026-02-28 23:35:18', '/api/sys/dict/type/page', 'GET', 200, 1, 55, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (590, '2026-02-28 23:35:18', '2026-02-28 23:35:18', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (591, '2026-02-28 23:35:18', '2026-02-28 23:35:18', '/api/sys/config-group/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (592, '2026-02-28 23:35:18', '2026-02-28 23:35:18', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (593, '2026-02-28 23:35:19', '2026-02-28 23:35:19', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (594, '2026-02-28 23:35:29', '2026-02-28 23:35:29', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (595, '2026-02-28 23:35:31', '2026-02-28 23:35:31', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (596, '2026-02-28 23:35:32', '2026-02-28 23:35:32', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (597, '2026-02-28 23:35:33', '2026-02-28 23:35:33', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (598, '2026-02-28 23:35:33', '2026-02-28 23:35:33', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (599, '2026-02-28 23:35:34', '2026-02-28 23:35:34', '/api/sys/config-group/push', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (600, '2026-02-28 23:35:34', '2026-02-28 23:35:34', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (601, '2026-02-28 23:35:34', '2026-02-28 23:35:34', '/api/sys/config-group/payment', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (602, '2026-02-28 23:35:35', '2026-02-28 23:35:35', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (603, '2026-02-28 23:35:36', '2026-02-28 23:35:36', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (604, '2026-02-28 23:35:37', '2026-02-28 23:35:37', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (605, '2026-02-28 23:35:37', '2026-02-28 23:35:37', '/api/sys/config-group/sms', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (606, '2026-02-28 23:35:38', '2026-02-28 23:35:38', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (607, '2026-02-28 23:35:38', '2026-02-28 23:35:38', '/api/sys/config-group/email', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (608, '2026-02-28 23:35:39', '2026-02-28 23:35:39', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (609, '2026-02-28 23:35:39', '2026-02-28 23:35:39', '/api/sys/config-group/sms', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (610, '2026-02-28 23:35:41', '2026-02-28 23:35:41', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (611, '2026-02-28 23:35:42', '2026-02-28 23:35:42', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (612, '2026-02-28 23:35:42', '2026-02-28 23:35:42', '/api/sys/config-group/email', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (613, '2026-02-28 23:35:58', '2026-02-28 23:35:59', '/api/sys/config-group/test-email', 'POST', 200, 1, 1241, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (614, '2026-02-28 23:37:16', '2026-02-28 23:37:16', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (615, '2026-02-28 23:37:16', '2026-02-28 23:37:17', '/api/auth/captcha', 'GET', 200, 1, 226, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (616, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/auth/login', 'POST', 200, 1, 309, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (617, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/auth/info', 'GET', 200, 1, 68, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (618, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/auth/info', 'GET', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (619, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (620, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (621, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (622, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/dashboard/stats', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (623, '2026-02-28 23:37:44', '2026-02-28 23:37:44', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (624, '2026-02-28 23:37:48', '2026-02-28 23:37:48', '/api/sys/notice/channels', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (625, '2026-02-28 23:37:48', '2026-02-28 23:37:48', '/api/sys/notice/page', 'GET', 200, 1, 82, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (626, '2026-02-28 23:37:49', '2026-02-28 23:37:49', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (627, '2026-02-28 23:37:49', '2026-02-28 23:37:49', '/api/sys/user/page', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (628, '2026-02-28 23:37:49', '2026-02-28 23:37:49', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (629, '2026-02-28 23:38:00', '2026-02-28 23:38:00', '/api/sys/notice', 'POST', 200, 1, 50, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (630, '2026-02-28 23:38:00', '2026-02-28 23:38:00', '/api/sys/notice/page', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (631, '2026-02-28 23:38:02', '2026-02-28 23:38:03', '/api/sys/notice/9/publish', 'POST', 200, 1, 521, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (632, '2026-02-28 23:38:03', '2026-02-28 23:38:03', '/api/sys/notice/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (633, '2026-02-28 23:43:17', '2026-02-28 23:43:17', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (634, '2026-02-28 23:43:17', '2026-02-28 23:43:17', '/api/sys/config-group/list', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (635, '2026-02-28 23:43:18', '2026-02-28 23:43:18', '/api/sys/config-group/system', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (636, '2026-02-28 23:43:19', '2026-02-28 23:43:19', '/api/sys/config-group/push', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (637, '2026-02-28 23:44:06', '2026-02-28 23:44:06', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (638, '2026-02-28 23:44:06', '2026-02-28 23:44:06', '/api/sys/notice/page', 'GET', 200, 1, 42, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (639, '2026-02-28 23:44:07', '2026-02-28 23:44:07', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (640, '2026-02-28 23:44:07', '2026-02-28 23:44:07', '/api/sys/user/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (641, '2026-02-28 23:44:07', '2026-02-28 23:44:07', '/api/sys/dept/tree', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (642, '2026-02-28 23:44:10', '2026-02-28 23:44:10', '/api/sys/notice/9', 'DELETE', 200, 1, 58, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (643, '2026-02-28 23:44:10', '2026-02-28 23:44:10', '/api/sys/notice/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (644, '2026-02-28 23:44:12', '2026-02-28 23:44:12', '/api/sys/notice/8', 'DELETE', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (645, '2026-02-28 23:44:12', '2026-02-28 23:44:12', '/api/sys/notice/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (646, '2026-02-28 23:44:14', '2026-02-28 23:44:14', '/api/sys/notice/4', 'DELETE', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (647, '2026-02-28 23:44:14', '2026-02-28 23:44:14', '/api/sys/notice/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (648, '2026-02-28 23:44:14', '2026-02-28 23:44:14', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (649, '2026-02-28 23:44:14', '2026-02-28 23:44:14', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (650, '2026-02-28 23:44:14', '2026-02-28 23:44:14', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (651, '2026-02-28 23:44:22', '2026-02-28 23:44:22', '/api/auth/profile', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (652, '2026-02-28 23:44:31', '2026-02-28 23:44:31', '/api/auth/profile', 'PUT', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (653, '2026-02-28 23:44:31', '2026-02-28 23:44:31', '/api/auth/info', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (654, '2026-02-28 23:44:33', '2026-02-28 23:44:33', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (655, '2026-02-28 23:44:33', '2026-02-28 23:44:33', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (656, '2026-02-28 23:46:05', '2026-02-28 23:46:05', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (657, '2026-02-28 23:46:05', '2026-02-28 23:46:05', '/api/sys/config-group/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (658, '2026-02-28 23:46:05', '2026-02-28 23:46:05', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (659, '2026-02-28 23:46:08', '2026-02-28 23:46:08', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (660, '2026-02-28 23:46:27', '2026-02-28 23:46:27', '/api/sys/config-group/push', 'POST', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (661, '2026-02-28 23:46:27', '2026-02-28 23:46:27', '/api/sys/config-group/refresh', 'POST', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (662, '2026-02-28 23:46:27', '2026-02-28 23:46:27', '/api/sys/config-group/public', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (663, '2026-02-28 23:46:27', '2026-02-28 23:46:27', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (664, '2026-02-28 23:46:28', '2026-02-28 23:46:29', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (665, '2026-02-28 23:46:28', '2026-02-28 23:46:29', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (666, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/sys/chat/users', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (667, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (668, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (669, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (670, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (671, '2026-02-28 23:46:29', '2026-02-28 23:46:29', '/api/chat/group/list', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (672, '2026-02-28 23:46:30', '2026-02-28 23:46:30', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (673, '2026-02-28 23:46:30', '2026-02-28 23:46:30', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (674, '2026-02-28 23:46:31', '2026-02-28 23:46:31', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (675, '2026-02-28 23:46:31', '2026-02-28 23:46:31', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (676, '2026-02-28 23:46:31', '2026-02-28 23:46:31', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (677, '2026-02-28 23:46:38', '2026-02-28 23:46:38', '/api/sys/notice', 'POST', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (678, '2026-02-28 23:46:38', '2026-02-28 23:46:38', '/api/sys/notice/page', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (679, '2026-02-28 23:46:43', '2026-02-28 23:46:43', '/api/sys/notice/10/publish', 'POST', 200, 1, 241, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (680, '2026-02-28 23:46:43', '2026-02-28 23:46:43', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (681, '2026-02-28 23:47:28', '2026-02-28 23:47:28', '/api/sys/notice/channels', 'GET', 200, 1, 40, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (682, '2026-02-28 23:47:28', '2026-02-28 23:47:29', '/api/sys/user/page', 'GET', 200, 1, 131, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (683, '2026-02-28 23:47:29', '2026-02-28 23:47:29', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (684, '2026-02-28 23:47:29', '2026-02-28 23:47:29', '/api/sys/dept/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (685, '2026-02-28 23:47:30', '2026-02-28 23:47:30', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (686, '2026-02-28 23:47:30', '2026-02-28 23:47:30', '/api/sys/user/page', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (687, '2026-02-28 23:47:30', '2026-02-28 23:47:30', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (688, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (689, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/sys/config-group/public', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (690, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/auth/info', 'GET', 200, 1, 56, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (691, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (692, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/sys/notice/channels', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (693, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/sys/notice/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (694, '2026-02-28 23:47:32', '2026-02-28 23:47:32', '/api/sys/notice/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (695, '2026-02-28 23:47:33', '2026-02-28 23:47:33', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (696, '2026-02-28 23:47:33', '2026-02-28 23:47:33', '/api/sys/user/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (697, '2026-02-28 23:47:33', '2026-02-28 23:47:33', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (698, '2026-02-28 23:47:41', '2026-02-28 23:47:41', '/api/sys/notice', 'POST', 200, 1, 161, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (699, '2026-02-28 23:47:41', '2026-02-28 23:47:41', '/api/sys/notice/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (700, '2026-02-28 23:47:44', '2026-02-28 23:47:44', '/api/sys/notice/11/publish', 'POST', 200, 1, 341, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (701, '2026-02-28 23:47:44', '2026-02-28 23:47:44', '/api/sys/notice/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (702, '2026-02-28 23:52:45', '2026-02-28 23:52:45', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (703, '2026-02-28 23:52:45', '2026-02-28 23:52:45', '/api/sys/user/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (704, '2026-02-28 23:52:45', '2026-02-28 23:52:45', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (705, '2026-02-28 23:57:07', '2026-02-28 23:57:07', '/api/sys/notice', 'POST', 200, 1, 242, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (706, '2026-02-28 23:57:08', '2026-02-28 23:57:08', '/api/sys/notice/page', 'GET', 200, 1, 121, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (707, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/crypto/config', 'GET', 200, 1, 5, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (708, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/sys/config-group/public', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (709, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/auth/info', 'GET', 200, 1, 80, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (710, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/sys/chat/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (711, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/sys/notice/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (712, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/sys/notice/channels', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (713, '2026-02-28 23:57:13', '2026-02-28 23:57:13', '/api/sys/notice/page', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (714, '2026-02-28 23:57:16', '2026-02-28 23:57:17', '/api/sys/notice/12/publish', 'POST', 200, 1, 715, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (715, '2026-02-28 23:57:17', '2026-02-28 23:57:17', '/api/sys/notice/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (716, '2026-02-28 23:57:26', '2026-02-28 23:57:26', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (717, '2026-02-28 23:57:26', '2026-02-28 23:57:26', '/api/sys/user/page', 'GET', 200, 1, 34, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (718, '2026-02-28 23:57:26', '2026-02-28 23:57:26', '/api/sys/dept/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (719, '2026-02-28 23:57:35', '2026-02-28 23:57:35', '/api/sys/notice', 'POST', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (720, '2026-02-28 23:57:35', '2026-02-28 23:57:35', '/api/sys/notice/page', 'GET', 200, 1, 56, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (721, '2026-02-28 23:57:38', '2026-02-28 23:57:41', '/api/sys/notice/13/publish', 'POST', 200, 1, 3214, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (722, '2026-02-28 23:57:41', '2026-02-28 23:57:41', '/api/sys/notice/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (723, '2026-02-28 23:57:41', '2026-02-28 23:57:44', '/api/sys/notice/13/publish', 'POST', 200, 1, 3067, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (724, '2026-02-28 23:57:44', '2026-02-28 23:57:44', '/api/sys/notice/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (725, '2026-02-28 23:58:10', '2026-02-28 23:58:10', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (726, '2026-02-28 23:58:10', '2026-02-28 23:58:10', '/api/sys/user/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (727, '2026-02-28 23:58:10', '2026-02-28 23:58:10', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (728, '2026-02-28 23:58:10', '2026-02-28 23:58:10', '/api/sys/notice/13', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (729, '2026-02-28 23:58:23', '2026-02-28 23:58:23', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (730, '2026-02-28 23:58:23', '2026-02-28 23:58:23', '/api/sys/user/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (731, '2026-02-28 23:58:23', '2026-02-28 23:58:23', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (732, '2026-02-28 23:58:23', '2026-02-28 23:58:23', '/api/sys/notice/13', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (733, '2026-02-28 23:58:34', '2026-02-28 23:58:34', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (734, '2026-02-28 23:58:34', '2026-02-28 23:58:34', '/api/sys/user/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (735, '2026-02-28 23:58:34', '2026-02-28 23:58:34', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (736, '2026-02-28 23:58:34', '2026-02-28 23:58:34', '/api/sys/notice/13', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (737, '2026-03-01 00:01:11', '2026-03-01 00:01:11', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (738, '2026-03-01 00:01:18', '2026-03-01 00:01:18', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (739, '2026-03-01 00:01:18', '2026-03-01 00:01:18', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (740, '2026-03-01 00:01:18', '2026-03-01 00:01:18', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (741, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (742, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (743, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/page', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (744, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/chat/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (745, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (746, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (747, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (748, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (749, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/sys/notice/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (750, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (751, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (752, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (753, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (754, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (755, '2026-03-01 00:02:36', '2026-03-01 00:02:36', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (756, '2026-03-01 00:03:36', '2026-03-01 00:03:36', '/api/sys/notice/channels', 'GET', 200, 1, 74, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (757, '2026-03-01 00:03:36', '2026-03-01 00:03:36', '/api/sys/notice/page', 'GET', 200, 1, 814, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (758, '2026-03-01 00:03:37', '2026-03-01 00:03:37', '/api/crypto/config', 'GET', 200, 1, 7, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (759, '2026-03-01 00:03:37', '2026-03-01 00:03:37', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (760, '2026-03-01 00:03:42', '2026-03-01 00:03:42', '/api/sys/notice/13/send-logs', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (761, '2026-03-01 00:04:31', '2026-03-01 00:04:31', '/api/sys/notice/channels', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (762, '2026-03-01 00:04:31', '2026-03-01 00:04:31', '/api/sys/notice/page', 'GET', 200, 1, 117, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (763, '2026-03-01 00:04:31', '2026-03-01 00:04:31', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (764, '2026-03-01 00:04:31', '2026-03-01 00:04:31', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (765, '2026-03-01 00:04:33', '2026-03-01 00:04:33', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (766, '2026-03-01 00:04:33', '2026-03-01 00:04:33', '/api/sys/user/page', 'GET', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (767, '2026-03-01 00:04:33', '2026-03-01 00:04:34', '/api/sys/dept/tree', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (768, '2026-03-01 00:04:37', '2026-03-01 00:04:37', '/api/sys/notice/13', 'DELETE', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (769, '2026-03-01 00:04:37', '2026-03-01 00:04:37', '/api/sys/notice/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (770, '2026-03-01 00:04:39', '2026-03-01 00:04:39', '/api/sys/notice/12', 'DELETE', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (771, '2026-03-01 00:04:39', '2026-03-01 00:04:39', '/api/sys/notice/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (772, '2026-03-01 00:04:41', '2026-03-01 00:04:41', '/api/sys/notice/11', 'DELETE', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (773, '2026-03-01 00:04:41', '2026-03-01 00:04:41', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (774, '2026-03-01 00:04:52', '2026-03-01 00:04:52', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (775, '2026-03-01 00:04:52', '2026-03-01 00:04:52', '/api/sys/notice/page', 'GET', 200, 1, 59, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (776, '2026-03-01 00:04:52', '2026-03-01 00:04:52', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (777, '2026-03-01 00:04:52', '2026-03-01 00:04:52', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (778, '2026-03-01 00:04:54', '2026-03-01 00:04:54', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (779, '2026-03-01 00:04:54', '2026-03-01 00:04:54', '/api/sys/user/page', 'GET', 200, 1, 25, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (780, '2026-03-01 00:04:54', '2026-03-01 00:04:54', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (781, '2026-03-01 00:05:00', '2026-03-01 00:05:00', '/api/sys/notice', 'POST', 200, 1, 42, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (782, '2026-03-01 00:05:00', '2026-03-01 00:05:00', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (783, '2026-03-01 00:05:03', '2026-03-01 00:05:06', '/api/sys/notice/14/publish', 'POST', 200, 1, 2964, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (784, '2026-03-01 00:05:06', '2026-03-01 00:05:06', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (785, '2026-03-01 00:05:19', '2026-03-01 00:05:19', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (786, '2026-03-01 00:05:42', '2026-03-01 00:05:42', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (787, '2026-03-01 00:05:45', '2026-03-01 00:05:45', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (788, '2026-03-01 00:06:15', '2026-03-01 00:06:15', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (789, '2026-03-01 00:06:25', '2026-03-01 00:06:25', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (790, '2026-03-01 00:06:25', '2026-03-01 00:06:25', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (791, '2026-03-01 00:06:25', '2026-03-01 00:06:25', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (792, '2026-03-01 00:06:25', '2026-03-01 00:06:25', '/api/sys/notice/14', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (793, '2026-03-01 00:06:28', '2026-03-01 00:06:28', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (794, '2026-03-01 00:06:28', '2026-03-01 00:06:28', '/api/sys/user/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (795, '2026-03-01 00:06:28', '2026-03-01 00:06:28', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (796, '2026-03-01 00:06:28', '2026-03-01 00:06:28', '/api/sys/notice/14', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (797, '2026-03-01 00:06:30', '2026-03-01 00:06:30', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (798, '2026-03-01 00:06:35', '2026-03-01 00:06:35', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (799, '2026-03-01 00:06:35', '2026-03-01 00:06:35', '/api/sys/user/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (800, '2026-03-01 00:06:35', '2026-03-01 00:06:35', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (801, '2026-03-01 00:06:35', '2026-03-01 00:06:35', '/api/sys/notice/14', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (802, '2026-03-01 00:06:39', '2026-03-01 00:06:39', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (803, '2026-03-01 00:06:39', '2026-03-01 00:06:39', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (804, '2026-03-01 00:06:39', '2026-03-01 00:06:39', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (805, '2026-03-01 00:06:39', '2026-03-01 00:06:39', '/api/sys/notice/14', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (806, '2026-03-01 00:06:42', '2026-03-01 00:06:42', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (807, '2026-03-01 00:06:51', '2026-03-01 00:06:51', '/api/sys/chat/users', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (808, '2026-03-01 00:06:51', '2026-03-01 00:06:51', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (809, '2026-03-01 00:06:51', '2026-03-01 00:06:51', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (810, '2026-03-01 00:06:51', '2026-03-01 00:06:51', '/api/sys/chat/online/10', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (811, '2026-03-01 00:06:51', '2026-03-01 00:06:51', '/api/chat/group/list', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (812, '2026-03-01 00:06:52', '2026-03-01 00:06:52', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (813, '2026-03-01 00:06:52', '2026-03-01 00:06:52', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (814, '2026-03-01 00:06:53', '2026-03-01 00:06:53', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (815, '2026-03-01 00:06:53', '2026-03-01 00:06:53', '/api/sys/user/page', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (816, '2026-03-01 00:06:53', '2026-03-01 00:06:53', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (817, '2026-03-01 00:06:55', '2026-03-01 00:06:55', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (818, '2026-03-01 00:06:55', '2026-03-01 00:06:55', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (819, '2026-03-01 00:06:55', '2026-03-01 00:06:55', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (820, '2026-03-01 00:07:06', '2026-03-01 00:07:06', '/api/sys/post/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (821, '2026-03-01 00:07:06', '2026-03-01 00:07:06', '/api/sys/role/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (822, '2026-03-01 00:07:06', '2026-03-01 00:07:06', '/api/sys/dept/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (823, '2026-03-01 00:07:06', '2026-03-01 00:07:06', '/api/sys/user/page', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (824, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (825, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/menu/tree', 'GET', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (826, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/role/page', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (827, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (828, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/config-group/list', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (829, '2026-03-01 00:07:07', '2026-03-01 00:07:07', '/api/sys/config-group/system', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (830, '2026-03-01 00:07:08', '2026-03-01 00:07:08', '/api/sys/config-group/email', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (831, '2026-03-01 00:07:08', '2026-03-01 00:07:08', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (832, '2026-03-01 00:07:09', '2026-03-01 00:07:09', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (833, '2026-03-01 00:07:09', '2026-03-01 00:07:09', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (834, '2026-03-01 00:07:09', '2026-03-01 00:07:09', '/api/sys/config-group/push', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (835, '2026-03-01 00:07:09', '2026-03-01 00:07:09', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (836, '2026-03-01 00:07:10', '2026-03-01 00:07:10', '/api/sys/config-group/sms', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (837, '2026-03-01 00:07:10', '2026-03-01 00:07:10', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (838, '2026-03-01 00:07:11', '2026-03-01 00:07:11', '/api/sys/config-group/password', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (839, '2026-03-01 00:07:11', '2026-03-01 00:07:11', '/api/sys/config-group/login', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (840, '2026-03-01 00:07:12', '2026-03-01 00:07:12', '/api/sys/config-group/system', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (841, '2026-03-01 00:07:12', '2026-03-01 00:07:12', '/api/sys/config-group/register', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (842, '2026-03-01 00:07:13', '2026-03-01 00:07:13', '/api/sys/config-group/sms', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (843, '2026-03-01 00:07:14', '2026-03-01 00:07:14', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (844, '2026-03-01 00:07:14', '2026-03-01 00:07:14', '/api/sys/config-group/push', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (845, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/role/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (846, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/post/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (847, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/dept/tree', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (848, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/user/page', 'GET', 200, 1, 49, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (849, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (850, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/menu/tree', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (851, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/role/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (852, '2026-03-01 00:07:19', '2026-03-01 00:07:19', '/api/sys/dict/type/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (853, '2026-03-01 00:07:20', '2026-03-01 00:07:20', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (854, '2026-03-01 00:07:20', '2026-03-01 00:07:20', '/api/sys/config-group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (855, '2026-03-01 00:07:20', '2026-03-01 00:07:20', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (856, '2026-03-01 00:07:22', '2026-03-01 00:07:22', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (857, '2026-03-01 00:07:22', '2026-03-01 00:07:22', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (858, '2026-03-01 00:07:31', '2026-03-01 00:07:31', '/api/sys/chat/users', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (859, '2026-03-01 00:07:31', '2026-03-01 00:07:31', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (860, '2026-03-01 00:07:31', '2026-03-01 00:07:31', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (861, '2026-03-01 00:07:31', '2026-03-01 00:07:31', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (862, '2026-03-01 00:07:31', '2026-03-01 00:07:31', '/api/chat/group/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (863, '2026-03-01 00:07:32', '2026-03-01 00:07:32', '/api/sys/notice/page', 'GET', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (864, '2026-03-01 00:07:32', '2026-03-01 00:07:32', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (865, '2026-03-01 00:07:34', '2026-03-01 00:07:34', '/api/sys/file-group/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (866, '2026-03-01 00:07:34', '2026-03-01 00:07:34', '/api/sys/file/page-by-group', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (867, '2026-03-01 00:07:36', '2026-03-01 00:07:36', '/api/monitor/online/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (868, '2026-03-01 00:07:36', '2026-03-01 00:07:36', '/api/monitor/job/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (869, '2026-03-01 00:07:36', '2026-03-01 00:07:36', '/api/monitor/job/log/statistics', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (870, '2026-03-01 00:07:37', '2026-03-01 00:07:37', '/api/monitor/server/info', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (871, '2026-03-01 00:07:38', '2026-03-01 00:07:38', '/api/monitor/server-manager/list', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (872, '2026-03-01 00:07:38', '2026-03-01 00:07:38', '/api/monitor/api-access/page', 'GET', 200, 1, 45, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (873, '2026-03-01 00:07:38', '2026-03-01 00:07:38', '/api/monitor/api-access/statistics', 'GET', 200, 1, 80, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (874, '2026-03-01 00:07:39', '2026-03-01 00:07:39', '/api/monitor/server-manager/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (875, '2026-03-01 00:07:40', '2026-03-01 00:07:40', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (876, '2026-03-01 00:07:40', '2026-03-01 00:07:40', '/api/monitor/cache/keys', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (877, '2026-03-01 00:07:40', '2026-03-01 00:07:40', '/api/monitor/cache/stats', 'GET', 200, 1, 55, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (878, '2026-03-01 00:07:43', '2026-03-01 00:07:43', '/api/monitor/cache/stats', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (879, '2026-03-01 00:07:45', '2026-03-01 00:07:45', '/api/monitor/api-access/page', 'GET', 200, 1, 40, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (880, '2026-03-01 00:07:45', '2026-03-01 00:07:45', '/api/monitor/api-access/statistics', 'GET', 200, 1, 84, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (881, '2026-03-01 00:07:47', '2026-03-01 00:07:47', '/api/monitor/server-manager/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (882, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/server/info', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (883, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/cache/stats', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (884, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/cache/keys', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (885, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/job/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (886, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/job/log/statistics', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (887, '2026-03-01 00:07:48', '2026-03-01 00:07:48', '/api/monitor/online/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (888, '2026-03-01 00:07:51', '2026-03-01 00:07:51', '/api/sys/notice/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (889, '2026-03-01 00:07:51', '2026-03-01 00:07:51', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (890, '2026-03-01 00:07:54', '2026-03-01 00:07:54', '/api/sys/chat/users', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (891, '2026-03-01 00:07:54', '2026-03-01 00:07:54', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (892, '2026-03-01 00:07:54', '2026-03-01 00:07:54', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (893, '2026-03-01 00:07:54', '2026-03-01 00:07:54', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (894, '2026-03-01 00:07:54', '2026-03-01 00:07:54', '/api/chat/group/list', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (895, '2026-03-01 00:07:55', '2026-03-01 00:07:55', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (896, '2026-03-01 00:07:55', '2026-03-01 00:07:55', '/api/sys/notice/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (897, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (898, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (899, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/sys/notice/unread-count', 'GET', 200, 1, 66, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (900, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/sys/notice/page', 'GET', 200, 1, 83, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (901, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (902, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (903, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (904, '2026-03-01 00:08:04', '2026-03-01 00:08:04', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (905, '2026-03-01 00:08:05', '2026-03-01 00:08:05', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (906, '2026-03-01 00:08:05', '2026-03-01 00:08:05', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (907, '2026-03-01 00:08:05', '2026-03-01 00:08:05', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (908, '2026-03-01 00:08:05', '2026-03-01 00:08:05', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (909, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (910, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/notice/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (911, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (912, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (913, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/chat/users', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (914, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/chat/online/10', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (915, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/chat/online/4', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (916, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/sys/chat/online/3', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (917, '2026-03-01 00:08:11', '2026-03-01 00:08:11', '/api/chat/group/list', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (918, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/notice/channels', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (919, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/notice/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (920, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/chat/users', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (921, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/chat/online/3', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (922, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/chat/group/list', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (923, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (924, '2026-03-01 00:08:12', '2026-03-01 00:08:12', '/api/sys/chat/online/10', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (925, '2026-03-01 00:08:13', '2026-03-01 00:08:13', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (926, '2026-03-01 00:08:13', '2026-03-01 00:08:13', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (927, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/users', 'GET', 200, 1, 55, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (928, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/notice/channels', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (929, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/notice/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (930, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (931, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/users', 'GET', 200, 1, 34, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (932, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/4', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (933, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (934, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/chat/group/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (935, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (936, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (937, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (938, '2026-03-01 00:08:15', '2026-03-01 00:08:15', '/api/chat/group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (939, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/users', 'GET', 200, 1, 44, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (940, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (941, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/3', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (942, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (943, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (944, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/chat/group/list', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (945, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/notice/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (946, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/users', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (947, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (948, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/chat/group/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (949, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (950, '2026-03-01 00:08:16', '2026-03-01 00:08:16', '/api/sys/chat/online/4', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (951, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (952, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (953, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/chat/users', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (954, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/chat/online/10', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (955, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (956, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (957, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/chat/group/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (958, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (959, '2026-03-01 00:08:17', '2026-03-01 00:08:17', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (960, '2026-03-01 00:08:18', '2026-03-01 00:08:18', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (961, '2026-03-01 00:08:18', '2026-03-01 00:08:18', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (962, '2026-03-01 00:08:18', '2026-03-01 00:08:18', '/api/sys/dept/tree', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (963, '2026-03-01 00:08:20', '2026-03-01 00:08:20', '/api/sys/notice/channels', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (964, '2026-03-01 00:08:20', '2026-03-01 00:08:20', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (965, '2026-03-01 00:08:20', '2026-03-01 00:08:20', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (966, '2026-03-01 00:08:20', '2026-03-01 00:08:20', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (967, '2026-03-01 00:08:21', '2026-03-01 00:08:21', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (968, '2026-03-01 00:08:21', '2026-03-01 00:08:21', '/api/sys/user/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (969, '2026-03-01 00:08:21', '2026-03-01 00:08:21', '/api/sys/dept/tree', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (970, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/sys/config-group/public', 'GET', 200, 1, 99, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (971, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/crypto/config', 'GET', 200, 1, 94, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (972, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/auth/info', 'GET', 200, 1, 103, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (973, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/sys/notice/unread-count', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (974, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/sys/chat/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (975, '2026-03-01 00:09:09', '2026-03-01 00:09:09', '/api/sys/notice/channels', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (976, '2026-03-01 00:09:09', '2026-03-01 00:09:10', '/api/sys/notice/page', 'GET', 200, 1, 113, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (977, '2026-03-01 00:09:11', '2026-03-01 00:09:11', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (978, '2026-03-01 00:09:14', '2026-03-01 00:09:16', '/api/sys/notice/14/retry', 'POST', 200, 1, 2355, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (979, '2026-03-01 00:09:16', '2026-03-01 00:09:16', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (980, '2026-03-01 00:10:07', '2026-03-01 00:10:07', '/api/sys/role/list', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (981, '2026-03-01 00:10:07', '2026-03-01 00:10:07', '/api/sys/post/list', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (982, '2026-03-01 00:10:07', '2026-03-01 00:10:07', '/api/sys/dept/tree', 'GET', 200, 1, 32, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (983, '2026-03-01 00:10:07', '2026-03-01 00:10:07', '/api/sys/user/page', 'GET', 200, 1, 54, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (984, '2026-03-01 00:10:14', '2026-03-01 00:10:14', '/api/sys/user/10', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (985, '2026-03-01 00:10:17', '2026-03-01 00:10:17', '/api/sys/user/4', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (986, '2026-03-01 00:10:19', '2026-03-01 00:10:19', '/api/sys/user/3', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (987, '2026-03-01 00:10:28', '2026-03-01 00:10:28', '/api/sys/user', 'PUT', 200, 1, 54, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (988, '2026-03-01 00:10:28', '2026-03-01 00:10:28', '/api/sys/user/page', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (989, '2026-03-01 00:10:30', '2026-03-01 00:10:30', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (990, '2026-03-01 00:10:30', '2026-03-01 00:10:30', '/api/sys/notice/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (991, '2026-03-01 00:10:33', '2026-03-01 00:10:33', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (992, '2026-03-01 00:10:34', '2026-03-01 00:10:36', '/api/sys/notice/14/retry', 'POST', 200, 1, 2091, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (993, '2026-03-01 00:10:36', '2026-03-01 00:10:36', '/api/sys/notice/14/send-logs', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (994, '2026-03-01 00:10:42', '2026-03-01 00:10:42', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (995, '2026-03-01 00:10:42', '2026-03-01 00:10:42', '/api/sys/user/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (996, '2026-03-01 00:10:42', '2026-03-01 00:10:42', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (997, '2026-03-01 00:10:48', '2026-03-01 00:10:48', '/api/sys/notice', 'POST', 200, 1, 25, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (998, '2026-03-01 00:10:48', '2026-03-01 00:10:48', '/api/sys/notice/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (999, '2026-03-01 00:10:50', '2026-03-01 00:10:53', '/api/sys/notice/15/publish', 'POST', 200, 1, 2796, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1000, '2026-03-01 00:10:53', '2026-03-01 00:10:53', '/api/sys/notice/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1001, '2026-03-01 00:11:11', '2026-03-01 00:11:11', '/api/sys/notice/channels', 'GET', 200, 1, 98, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1002, '2026-03-01 00:11:11', '2026-03-01 00:11:11', '/api/sys/notice/page', 'GET', 200, 1, 599, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1003, '2026-03-01 00:11:11', '2026-03-01 00:11:11', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1004, '2026-03-01 00:11:11', '2026-03-01 00:11:11', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1005, '2026-03-01 00:11:14', '2026-03-01 00:11:14', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1006, '2026-03-01 00:11:14', '2026-03-01 00:11:14', '/api/sys/user/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1007, '2026-03-01 00:11:14', '2026-03-01 00:11:14', '/api/sys/dept/tree', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1008, '2026-03-01 00:11:28', '2026-03-01 00:11:28', '/api/sys/notice', 'POST', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1009, '2026-03-01 00:11:28', '2026-03-01 00:11:28', '/api/sys/notice/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1010, '2026-03-01 00:11:32', '2026-03-01 00:11:34', '/api/sys/notice/16/publish', 'POST', 200, 1, 1708, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1011, '2026-03-01 00:11:34', '2026-03-01 00:11:34', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1012, '2026-03-01 00:11:46', '2026-03-01 00:11:46', '/api/sys/notice/16', 'DELETE', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1013, '2026-03-01 00:11:46', '2026-03-01 00:11:46', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1014, '2026-03-01 00:11:49', '2026-03-01 00:11:49', '/api/sys/notice/15/send-logs', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1015, '2026-03-01 00:12:01', '2026-03-01 00:12:01', '/api/sys/notice/15', 'DELETE', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1016, '2026-03-01 00:12:01', '2026-03-01 00:12:01', '/api/sys/notice/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1017, '2026-03-01 00:12:03', '2026-03-01 00:12:03', '/api/sys/notice/14', 'DELETE', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1018, '2026-03-01 00:12:03', '2026-03-01 00:12:03', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1019, '2026-03-01 00:12:05', '2026-03-01 00:12:05', '/api/sys/notice/10', 'DELETE', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1020, '2026-03-01 00:12:05', '2026-03-01 00:12:05', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1021, '2026-03-01 00:12:05', '2026-03-01 00:12:05', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1022, '2026-03-01 00:12:05', '2026-03-01 00:12:05', '/api/sys/user/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1023, '2026-03-01 00:12:05', '2026-03-01 00:12:05', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1024, '2026-03-01 00:12:13', '2026-03-01 00:12:13', '/api/sys/notice', 'POST', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1025, '2026-03-01 00:12:13', '2026-03-01 00:12:13', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1026, '2026-03-01 00:12:15', '2026-03-01 00:12:17', '/api/sys/notice/17/publish', 'POST', 200, 1, 1627, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1027, '2026-03-01 00:12:17', '2026-03-01 00:12:17', '/api/sys/notice/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1028, '2026-03-01 00:12:18', '2026-03-01 00:12:18', '/api/sys/notice/17/send-logs', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1029, '2026-03-01 00:12:30', '2026-03-01 00:12:30', '/api/sys/role/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1030, '2026-03-01 00:12:30', '2026-03-01 00:12:30', '/api/sys/dept/tree', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1031, '2026-03-01 00:12:30', '2026-03-01 00:12:30', '/api/sys/post/list', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1032, '2026-03-01 00:12:30', '2026-03-01 00:12:30', '/api/sys/user/page', 'GET', 200, 1, 25, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1033, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1034, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/role/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1035, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/menu/tree', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1036, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/dict/type/page', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1037, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1038, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/config-group/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1039, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1040, '2026-03-01 00:12:31', '2026-03-01 00:12:31', '/api/sys/dict/type/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1041, '2026-03-01 00:12:32', '2026-03-01 00:12:32', '/api/sys/role/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1042, '2026-03-01 00:12:32', '2026-03-01 00:12:32', '/api/sys/post/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1043, '2026-03-01 00:12:32', '2026-03-01 00:12:32', '/api/sys/dept/tree', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1044, '2026-03-01 00:12:32', '2026-03-01 00:12:32', '/api/sys/user/page', 'GET', 200, 1, 47, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1045, '2026-03-01 00:12:32', '2026-03-01 00:12:32', '/api/dashboard/stats', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1046, '2026-03-01 00:13:38', '2026-03-01 00:13:38', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1047, '2026-03-01 00:13:38', '2026-03-01 00:13:38', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1048, '2026-03-01 00:13:38', '2026-03-01 00:13:38', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1049, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1050, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/role/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1051, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/menu/tree', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1052, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/post/list', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1053, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/role/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1054, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/dept/tree', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1055, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/user/page', 'GET', 200, 1, 52, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1056, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/menu/tree', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1057, '2026-03-01 00:13:39', '2026-03-01 00:13:39', '/api/sys/dict/type/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1058, '2026-03-01 00:13:40', '2026-03-01 00:13:40', '/api/sys/menu/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1059, '2026-03-01 00:13:40', '2026-03-01 00:13:40', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1060, '2026-03-01 00:13:40', '2026-03-01 00:13:40', '/api/sys/role/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1061, '2026-03-01 00:13:40', '2026-03-01 00:13:40', '/api/sys/menu/tree', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1062, '2026-03-01 00:13:41', '2026-03-01 00:13:41', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1063, '2026-03-01 00:13:41', '2026-03-01 00:13:41', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1064, '2026-03-01 00:13:42', '2026-03-01 00:13:42', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1065, '2026-03-01 00:13:42', '2026-03-01 00:13:42', '/api/sys/user/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1066, '2026-03-01 00:13:42', '2026-03-01 00:13:42', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1067, '2026-03-01 00:13:46', '2026-03-01 00:13:46', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1068, '2026-03-01 00:13:46', '2026-03-01 00:13:46', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1069, '2026-03-01 00:13:46', '2026-03-01 00:13:46', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1070, '2026-03-01 00:13:47', '2026-03-01 00:13:47', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1071, '2026-03-01 00:13:47', '2026-03-01 00:13:47', '/api/sys/config-group/storage', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1072, '2026-03-01 00:13:48', '2026-03-01 00:13:48', '/api/sys/config-group/push', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1073, '2026-03-01 00:13:52', '2026-03-01 00:13:52', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1074, '2026-03-01 00:13:52', '2026-03-01 00:13:52', '/api/sys/notice/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1075, '2026-03-01 00:13:54', '2026-03-01 00:13:54', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1076, '2026-03-01 00:13:54', '2026-03-01 00:13:54', '/api/sys/user/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1077, '2026-03-01 00:13:54', '2026-03-01 00:13:54', '/api/sys/dept/tree', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1078, '2026-03-01 00:14:03', '2026-03-01 00:14:03', '/api/sys/post/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1079, '2026-03-01 00:14:03', '2026-03-01 00:14:03', '/api/sys/role/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1080, '2026-03-01 00:14:03', '2026-03-01 00:14:03', '/api/sys/dept/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1081, '2026-03-01 00:14:03', '2026-03-01 00:14:03', '/api/sys/user/page', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1082, '2026-03-01 00:14:03', '2026-03-01 00:14:03', '/api/sys/menu/tree', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1083, '2026-03-01 00:15:22', '2026-03-01 00:15:22', '/api/dashboard/stats', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1084, '2026-03-01 00:15:22', '2026-03-01 00:15:22', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1085, '2026-03-01 00:15:56', '2026-03-01 00:15:56', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1086, '2026-03-01 00:15:56', '2026-03-01 00:15:56', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1087, '2026-03-01 00:15:58', '2026-03-01 00:15:58', '/api/sys/notice/17/send-logs', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1088, '2026-03-01 00:16:01', '2026-03-01 00:16:01', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1089, '2026-03-01 00:16:01', '2026-03-01 00:16:01', '/api/sys/user/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1090, '2026-03-01 00:16:01', '2026-03-01 00:16:01', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1091, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/chat/users', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1092, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/chat/online/4', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1093, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1094, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1095, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/chat/group/list', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1096, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1097, '2026-03-01 00:16:04', '2026-03-01 00:16:04', '/api/sys/notice/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1098, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/chat/users', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1099, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/chat/online/3', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1100, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/chat/online/4', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1101, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1102, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/chat/group/list', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1103, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/notice/channels', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1104, '2026-03-01 00:16:08', '2026-03-01 00:16:08', '/api/sys/notice/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1105, '2026-03-01 00:16:09', '2026-03-01 00:16:09', '/api/sys/menu/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1106, '2026-03-01 00:16:10', '2026-03-01 00:16:10', '/api/sys/dict/type/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1107, '2026-03-01 00:16:10', '2026-03-01 00:16:10', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1108, '2026-03-01 00:16:10', '2026-03-01 00:16:10', '/api/sys/config-group/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1109, '2026-03-01 00:16:10', '2026-03-01 00:16:10', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1110, '2026-03-01 00:16:11', '2026-03-01 00:16:11', '/api/sys/dict/type/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1111, '2026-03-01 00:16:11', '2026-03-01 00:16:11', '/api/sys/menu/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1112, '2026-03-01 00:16:12', '2026-03-01 00:16:12', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1113, '2026-03-01 00:16:12', '2026-03-01 00:16:12', '/api/sys/role/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1114, '2026-03-01 00:16:12', '2026-03-01 00:16:12', '/api/sys/menu/tree', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1115, '2026-03-01 00:16:12', '2026-03-01 00:16:12', '/api/sys/menu/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1116, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/dept/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1117, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/role/page', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1118, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/menu/tree', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1119, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/role/list', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1120, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/dept/tree', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1121, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/post/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1122, '2026-03-01 00:16:13', '2026-03-01 00:16:13', '/api/sys/user/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1123, '2026-03-01 00:16:15', '2026-03-01 00:16:15', '/api/dashboard/stats', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1124, '2026-03-01 10:44:09', '2026-03-01 10:44:09', '/api/sys/config-group/public', 'GET', 200, 1, 4, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1125, '2026-03-01 10:44:09', '2026-03-01 10:44:09', '/api/auth/captcha', 'GET', 200, 1, 295, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1126, '2026-03-01 10:44:16', '2026-03-01 10:44:16', '/api/auth/login', 'POST', 200, 1, 157, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1127, '2026-03-01 10:44:16', '2026-03-01 10:44:16', '/api/auth/info', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1128, '2026-03-01 10:44:17', '2026-03-01 10:44:17', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1129, '2026-03-01 10:44:17', '2026-03-01 10:44:17', '/api/dashboard/stats', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1130, '2026-03-01 10:44:17', '2026-03-01 10:44:17', '/api/sys/notice/unread-count', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1131, '2026-03-01 10:44:20', '2026-03-01 10:44:20', '/api/monitor/online/list', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1132, '2026-03-01 10:44:21', '2026-03-01 10:44:21', '/api/monitor/job/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1133, '2026-03-01 10:44:21', '2026-03-01 10:44:21', '/api/monitor/job/log/statistics', 'GET', 200, 1, 50, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1134, '2026-03-01 10:44:21', '2026-03-01 10:44:21', '/api/monitor/server/info', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1135, '2026-03-01 10:44:21', '2026-03-01 10:44:21', '/api/monitor/server-manager/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1136, '2026-03-01 10:44:21', '2026-03-01 10:44:21', '/api/monitor/api-access/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1137, '2026-03-01 10:44:21', '2026-03-01 10:44:22', '/api/monitor/api-access/statistics', 'GET', 200, 1, 70, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1138, '2026-03-01 10:44:31', '2026-03-01 10:44:32', '/api/monitor/api-access/statistics', 'GET', 200, 1, 58, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1139, '2026-03-01 10:44:39', '2026-03-01 10:44:39', '/api/monitor/server/info', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1140, '2026-03-01 10:44:41', '2026-03-01 10:44:41', '/api/monitor/cache/keys', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1141, '2026-03-01 10:44:41', '2026-03-01 10:44:41', '/api/monitor/cache/stats', 'GET', 200, 1, 50, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1142, '2026-03-01 10:44:42', '2026-03-01 10:44:42', '/api/monitor/job/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1143, '2026-03-01 10:44:42', '2026-03-01 10:44:42', '/api/monitor/job/log/statistics', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1144, '2026-03-01 10:44:46', '2026-03-01 10:44:46', '/api/monitor/online/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1145, '2026-03-01 10:44:47', '2026-03-01 10:44:47', '/api/monitor/operlog/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1146, '2026-03-01 10:44:47', '2026-03-01 10:44:47', '/api/monitor/loginlog/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1147, '2026-03-01 10:44:48', '2026-03-01 10:44:48', '/api/monitor/operlog/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1148, '2026-03-01 10:44:49', '2026-03-01 10:44:49', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1149, '2026-03-01 10:44:49', '2026-03-01 10:44:49', '/api/sys/user/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1150, '2026-03-01 10:44:49', '2026-03-01 10:44:49', '/api/sys/post/tree', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1151, '2026-03-01 10:44:49', '2026-03-01 10:44:49', '/api/sys/user/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1152, '2026-03-01 10:44:50', '2026-03-01 10:44:50', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1153, '2026-03-01 10:44:50', '2026-03-01 10:44:50', '/api/sys/user/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1154, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/role/list', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1155, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/post/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1156, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1157, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/user/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1158, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/dept/tree', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1159, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/role/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1160, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/menu/tree', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1161, '2026-03-01 10:44:51', '2026-03-01 10:44:51', '/api/sys/menu/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1162, '2026-03-01 10:44:52', '2026-03-01 10:44:52', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1163, '2026-03-01 10:44:52', '2026-03-01 10:44:52', '/api/sys/config-group/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1164, '2026-03-01 10:44:52', '2026-03-01 10:44:52', '/api/sys/config-group/system', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1165, '2026-03-01 10:44:53', '2026-03-01 10:44:53', '/api/sys/dict/type/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1166, '2026-03-01 10:44:53', '2026-03-01 10:44:53', '/api/sys/config-group/sms-logs/recent', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1167, '2026-03-01 10:44:53', '2026-03-01 10:44:53', '/api/sys/config-group/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1168, '2026-03-01 10:44:53', '2026-03-01 10:44:53', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1169, '2026-03-01 10:44:55', '2026-03-01 10:44:55', '/api/sys/config-group/password', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1170, '2026-03-01 10:44:56', '2026-03-01 10:44:56', '/api/sys/config-group/email', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1171, '2026-03-01 10:44:56', '2026-03-01 10:44:56', '/api/sys/config-group/emailTemplate', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1172, '2026-03-01 10:44:57', '2026-03-01 10:44:57', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1173, '2026-03-01 10:44:57', '2026-03-01 10:44:57', '/api/sys/config-group/payment', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1174, '2026-03-01 10:44:58', '2026-03-01 10:44:58', '/api/sys/config-group/security', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1175, '2026-03-01 10:44:59', '2026-03-01 10:44:59', '/api/sys/config-group/payment', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1176, '2026-03-01 10:44:59', '2026-03-01 10:44:59', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1177, '2026-03-01 10:44:59', '2026-03-01 10:44:59', '/api/sys/config-group/payment', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1178, '2026-03-01 10:45:00', '2026-03-01 10:45:00', '/api/sys/config-group/security', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1179, '2026-03-01 10:45:01', '2026-03-01 10:45:01', '/api/sys/config-group/wechatMiniProgram', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1180, '2026-03-01 10:45:01', '2026-03-01 10:45:01', '/api/sys/config-group/wechatMp', 'GET', 200, 1, 0, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1181, '2026-03-01 10:45:01', '2026-03-01 10:45:01', '/api/api/wechat/mp/menu', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1182, '2026-03-01 10:45:07', '2026-03-01 10:45:07', '/api/sys/config-group/thirdParty', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1183, '2026-03-01 10:45:07', '2026-03-01 10:45:07', '/api/sys/config-group/push', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1184, '2026-03-01 10:45:08', '2026-03-01 10:45:08', '/api/sys/config-group/sms', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1185, '2026-03-01 10:45:08', '2026-03-01 10:45:08', '/api/sys/config-group/email', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1186, '2026-03-01 10:45:08', '2026-03-01 10:45:08', '/api/sys/config-group/password', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1187, '2026-03-01 10:45:09', '2026-03-01 10:45:09', '/api/sys/config-group/login', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1188, '2026-03-01 10:45:09', '2026-03-01 10:45:09', '/api/sys/config-group/register', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1189, '2026-03-01 10:45:11', '2026-03-01 10:45:11', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1190, '2026-03-01 10:45:11', '2026-03-01 10:45:11', '/api/sys/config-group/register', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1191, '2026-03-01 10:45:12', '2026-03-01 10:45:12', '/api/sys/config-group/login', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1192, '2026-03-01 10:45:12', '2026-03-01 10:45:12', '/api/sys/config-group/system', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1193, '2026-03-01 10:45:13', '2026-03-01 10:45:13', '/api/sys/config-group/register', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1194, '2026-03-01 10:45:13', '2026-03-01 10:45:13', '/api/sys/config-group/login', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1195, '2026-03-01 10:45:13', '2026-03-01 10:45:13', '/api/sys/config-group/register', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1196, '2026-03-01 10:45:17', '2026-03-01 10:45:17', '/api/sys/notice/channels', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1197, '2026-03-01 10:45:17', '2026-03-01 10:45:17', '/api/sys/notice/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1198, '2026-03-01 10:45:18', '2026-03-01 10:45:18', '/api/sys/file-group/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1199, '2026-03-01 10:45:18', '2026-03-01 10:45:18', '/api/sys/file/page-by-group', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1200, '2026-03-01 11:13:41', '2026-03-01 11:13:41', '/api/crypto/config', 'GET', 200, 1, 127, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1201, '2026-03-01 11:13:41', '2026-03-01 11:13:41', '/api/sys/config-group/public', 'GET', 200, 1, 130, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1202, '2026-03-01 11:13:41', '2026-03-01 11:13:41', '/api/auth/info', 'GET', 200, 1, 138, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1203, '2026-03-01 11:13:41', '2026-03-01 11:13:41', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1204, '2026-03-01 11:13:41', '2026-03-01 11:13:41', '/api/sys/chat/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1205, '2026-03-01 11:13:42', '2026-03-01 11:13:42', '/api/sys/file-group/list', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1206, '2026-03-01 11:13:42', '2026-03-01 11:13:42', '/api/sys/file/page-by-group', 'GET', 200, 1, 129, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1207, '2026-03-01 11:13:46', '2026-03-01 11:13:46', '/api/tool/gen/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1208, '2026-03-01 11:13:53', '2026-03-01 11:13:53', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1209, '2026-03-01 11:14:05', '2026-03-01 11:14:06', '/api/tool/gen/generate/4', 'POST', 200, 1, 233, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1210, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1211, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1212, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/auth/info', 'GET', 200, 1, 45, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1213, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1214, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/sys/notice/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1215, '2026-03-01 11:14:06', '2026-03-01 11:14:06', '/api/tool/gen/page', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1216, '2026-03-01 11:15:15', '2026-03-01 11:15:15', '/api/sys/dept/tree', 'GET', 200, 1, 110, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1217, '2026-03-01 11:15:15', '2026-03-01 11:15:15', '/api/sys/menu/tree', 'GET', 200, 1, 126, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1218, '2026-03-01 11:15:15', '2026-03-01 11:15:15', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1219, '2026-03-01 11:15:15', '2026-03-01 11:15:15', '/api/sys/role/page', 'GET', 200, 1, 175, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1220, '2026-03-01 11:15:17', '2026-03-01 11:15:17', '/api/sys/role/1', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1221, '2026-03-01 11:15:29', '2026-03-01 11:15:29', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1222, '2026-03-01 11:15:29', '2026-03-01 11:15:29', '/api/sys/config-group/public', 'GET', 200, 1, 37, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1223, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1224, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1225, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/auth/info', 'GET', 200, 1, 63, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1226, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1227, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/sys/chat/unread-count', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1228, '2026-03-01 11:15:33', '2026-03-01 11:15:33', '/api/dashboard/stats', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1229, '2026-03-01 11:15:36', '2026-03-01 11:15:36', '/api/sys/dept/tree', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1230, '2026-03-01 11:15:36', '2026-03-01 11:15:36', '/api/sys/role/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1231, '2026-03-01 11:15:36', '2026-03-01 11:15:36', '/api/sys/menu/tree', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1232, '2026-03-01 11:15:38', '2026-03-01 11:15:38', '/api/sys/role/1', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1233, '2026-03-01 11:15:47', '2026-03-01 11:15:47', '/api/sys/role', 'PUT', 200, 1, 177, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1234, '2026-03-01 11:15:47', '2026-03-01 11:15:47', '/api/sys/role/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1235, '2026-03-01 11:15:50', '2026-03-01 11:15:50', '/api/sys/role/1', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1236, '2026-03-01 11:15:54', '2026-03-01 11:15:54', '/api/sys/role', 'PUT', 200, 1, 123, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1237, '2026-03-01 11:15:54', '2026-03-01 11:15:54', '/api/sys/role/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1238, '2026-03-01 11:15:55', '2026-03-01 11:15:55', '/api/sys/role/1', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1239, '2026-03-01 11:15:59', '2026-03-01 11:15:59', '/api/sys/role', 'PUT', 200, 1, 136, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1240, '2026-03-01 11:15:59', '2026-03-01 11:15:59', '/api/sys/role/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1241, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1242, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1243, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/auth/info', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1244, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/dept/tree', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1245, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/menu/tree', 'GET', 200, 1, 51, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1246, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/role/page', 'GET', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1247, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/notice/unread-count', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1248, '2026-03-01 11:16:01', '2026-03-01 11:16:01', '/api/sys/chat/unread-count', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1249, '2026-03-01 11:16:04', '2026-03-01 11:16:04', '/api/system/student/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1250, '2026-03-01 11:16:14', '2026-03-01 11:16:14', '/api/system/student', 'POST', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1251, '2026-03-01 11:16:14', '2026-03-01 11:16:14', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1252, '2026-03-01 11:16:34', '2026-03-01 11:16:34', '/api/system/student/5', 'DELETE', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1253, '2026-03-01 11:16:34', '2026-03-01 11:16:34', '/api/system/student/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1254, '2026-03-01 11:16:38', '2026-03-01 11:16:38', '/api/tool/gen/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1255, '2026-03-01 11:16:41', '2026-03-01 11:16:42', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1256, '2026-03-01 11:16:47', '2026-03-01 11:16:47', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1257, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1258, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1259, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/auth/info', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1260, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/sys/notice/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1261, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1262, '2026-03-01 11:16:48', '2026-03-01 11:16:48', '/api/tool/gen/page', 'GET', 200, 1, 45, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1263, '2026-03-01 11:16:54', '2026-03-01 11:16:54', '/api/tool/gen/4', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1264, '2026-03-01 11:17:45', '2026-03-01 11:17:45', '/api/sys/dict/type/page', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1265, '2026-03-01 11:18:09', '2026-03-01 11:18:09', '/api/sys/dict/type/1', 'DELETE', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1266, '2026-03-01 11:18:09', '2026-03-01 11:18:09', '/api/sys/dict/type/page', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1267, '2026-03-01 11:18:21', '2026-03-01 11:18:21', '/api/sys/dict/type', 'POST', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1268, '2026-03-01 11:18:21', '2026-03-01 11:18:21', '/api/sys/dict/type/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1269, '2026-03-01 11:18:23', '2026-03-01 11:18:23', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1270, '2026-03-01 11:18:32', '2026-03-01 11:18:32', '/api/sys/dict/data', 'POST', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1271, '2026-03-01 11:18:32', '2026-03-01 11:18:32', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1272, '2026-03-01 11:18:38', '2026-03-01 11:18:38', '/api/sys/dict/data', 'POST', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1273, '2026-03-01 11:18:38', '2026-03-01 11:18:38', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1274, '2026-03-01 11:18:41', '2026-03-01 11:18:41', '/api/tool/gen/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1275, '2026-03-01 11:18:43', '2026-03-01 11:18:43', '/api/tool/gen/4', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1276, '2026-03-01 11:21:01', '2026-03-01 11:21:01', '/api/tool/gen/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1277, '2026-03-01 11:21:01', '2026-03-01 11:21:01', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1278, '2026-03-01 11:21:05', '2026-03-01 11:21:05', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1279, '2026-03-01 11:21:05', '2026-03-01 11:21:05', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1280, '2026-03-01 11:21:14', '2026-03-01 11:21:14', '/api/tool/gen/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1281, '2026-03-01 11:21:14', '2026-03-01 11:21:14', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1282, '2026-03-01 11:21:19', '2026-03-01 11:21:19', '/api/tool/gen/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1283, '2026-03-01 11:21:19', '2026-03-01 11:21:19', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1284, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/crypto/config', 'GET', 200, 1, 87, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1285, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/sys/config-group/public', 'GET', 200, 1, 83, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1286, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/auth/info', 'GET', 200, 1, 98, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1287, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1288, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/sys/notice/unread-count', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1289, '2026-03-01 11:23:41', '2026-03-01 11:23:41', '/api/tool/gen/page', 'GET', 200, 1, 118, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1290, '2026-03-01 11:23:43', '2026-03-01 11:23:43', '/api/sys/dict/type/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1291, '2026-03-01 11:23:43', '2026-03-01 11:23:43', '/api/tool/gen/4', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1292, '2026-03-01 11:24:18', '2026-03-01 11:24:18', '/api/tool/gen', 'PUT', 200, 1, 91, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1293, '2026-03-01 11:24:18', '2026-03-01 11:24:18', '/api/tool/gen/page', 'GET', 200, 1, 42, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1294, '2026-03-01 11:24:22', '2026-03-01 11:24:22', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1295, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/tool/gen/generate/4', 'POST', 200, 1, 204, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1296, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1297, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1298, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/auth/info', 'GET', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1299, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1300, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/sys/chat/unread-count', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1301, '2026-03-01 11:24:24', '2026-03-01 11:24:24', '/api/tool/gen/page', 'GET', 200, 1, 75, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1302, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/sys/config-group/public', 'GET', 200, 1, 110, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1303, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/crypto/config', 'GET', 200, 1, 106, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1304, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/auth/info', 'GET', 200, 1, 115, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1305, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/sys/notice/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1306, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/sys/chat/unread-count', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1307, '2026-03-01 11:24:48', '2026-03-01 11:24:48', '/api/tool/gen/page', 'GET', 200, 1, 94, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1308, '2026-03-01 11:25:05', '2026-03-01 11:25:05', '/api/sys/notice/channels', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1309, '2026-03-01 11:25:05', '2026-03-01 11:25:05', '/api/sys/notice/page', 'GET', 200, 1, 97, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1310, '2026-03-01 11:25:06', '2026-03-01 11:25:06', '/api/sys/chat/users', 'GET', 200, 1, 37, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1311, '2026-03-01 11:25:06', '2026-03-01 11:25:06', '/api/sys/chat/online/4', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1312, '2026-03-01 11:25:06', '2026-03-01 11:25:06', '/api/sys/chat/online/10', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1313, '2026-03-01 11:25:06', '2026-03-01 11:25:06', '/api/sys/chat/online/3', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1314, '2026-03-01 11:25:06', '2026-03-01 11:25:06', '/api/chat/group/list', 'GET', 200, 1, 31, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1315, '2026-03-01 11:25:08', '2026-03-01 11:25:08', '/api/tool/gen/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1316, '2026-03-01 11:25:11', '2026-03-01 11:25:11', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1317, '2026-03-01 11:25:11', '2026-03-01 11:25:11', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1318, '2026-03-01 11:25:11', '2026-03-01 11:25:11', '/api/auth/info', 'GET', 200, 1, 42, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1319, '2026-03-01 11:25:12', '2026-03-01 11:25:12', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1320, '2026-03-01 11:25:12', '2026-03-01 11:25:12', '/api/sys/notice/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1321, '2026-03-01 11:25:12', '2026-03-01 11:25:12', '/api/tool/gen/page', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1322, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1323, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/sys/config-group/public', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1324, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/auth/info', 'GET', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1325, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1326, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1327, '2026-03-01 11:25:37', '2026-03-01 11:25:37', '/api/tool/gen/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1328, '2026-03-01 11:25:44', '2026-03-01 11:25:44', '/api/system/student/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1329, '2026-03-01 11:25:44', '2026-03-01 11:25:44', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1330, '2026-03-01 11:25:44', '2026-03-01 11:25:44', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1331, '2026-03-01 11:25:58', '2026-03-01 11:25:58', '/api/system/student', 'POST', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1332, '2026-03-01 11:26:49', '2026-03-01 11:26:49', '/api/system/student', 'POST', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1333, '2026-03-01 11:26:55', '2026-03-01 11:26:55', '/api/system/student', 'POST', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1334, '2026-03-01 11:26:55', '2026-03-01 11:26:55', '/api/system/student/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1335, '2026-03-01 11:27:08', '2026-03-01 11:27:08', '/api/system/student/6', 'DELETE', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1336, '2026-03-01 11:27:08', '2026-03-01 11:27:08', '/api/system/student/page', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1337, '2026-03-01 11:27:18', '2026-03-01 11:27:18', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1338, '2026-03-01 11:27:19', '2026-03-01 11:27:19', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1339, '2026-03-01 11:27:19', '2026-03-01 11:27:19', '/api/system/student/page', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1340, '2026-03-01 11:27:19', '2026-03-01 11:27:19', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1341, '2026-03-01 11:27:19', '2026-03-01 11:27:19', '/api/tool/gen/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1342, '2026-03-01 11:27:20', '2026-03-01 11:27:20', '/api/sys/dict/type/list', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1343, '2026-03-01 11:27:20', '2026-03-01 11:27:20', '/api/tool/gen/4', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1344, '2026-03-01 11:27:44', '2026-03-01 11:27:44', '/api/tool/gen', 'PUT', 200, 1, 47, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1345, '2026-03-01 11:27:44', '2026-03-01 11:27:44', '/api/tool/gen/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1346, '2026-03-01 11:27:47', '2026-03-01 11:27:47', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1347, '2026-03-01 11:27:48', '2026-03-01 11:27:48', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1348, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1349, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/sys/config-group/public', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1350, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/auth/info', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1351, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1352, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1353, '2026-03-01 11:27:49', '2026-03-01 11:27:49', '/api/tool/gen/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1354, '2026-03-01 11:27:55', '2026-03-01 11:27:55', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1355, '2026-03-01 11:27:56', '2026-03-01 11:27:56', '/api/tool/gen/generate/4', 'POST', 200, 1, 146, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1356, '2026-03-01 11:27:56', '2026-03-01 11:27:56', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1357, '2026-03-01 11:27:56', '2026-03-01 11:27:56', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1358, '2026-03-01 11:27:56', '2026-03-01 11:27:56', '/api/auth/info', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1359, '2026-03-01 11:27:57', '2026-03-01 11:27:57', '/api/sys/chat/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1360, '2026-03-01 11:27:57', '2026-03-01 11:27:57', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1361, '2026-03-01 11:27:57', '2026-03-01 11:27:57', '/api/tool/gen/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1362, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/crypto/config', 'GET', 200, 1, 89, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1363, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/sys/config-group/public', 'GET', 200, 1, 100, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1364, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/auth/info', 'GET', 200, 1, 134, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1365, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/sys/notice/unread-count', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1366, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/sys/chat/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1367, '2026-03-01 11:28:20', '2026-03-01 11:28:20', '/api/tool/gen/page', 'GET', 200, 1, 89, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1368, '2026-03-01 11:28:57', '2026-03-01 11:28:57', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1369, '2026-03-01 11:28:57', '2026-03-01 11:28:57', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1370, '2026-03-01 11:28:57', '2026-03-01 11:28:58', '/api/auth/info', 'GET', 200, 1, 58, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1371, '2026-03-01 11:28:58', '2026-03-01 11:28:58', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1372, '2026-03-01 11:28:58', '2026-03-01 11:28:58', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1373, '2026-03-01 11:28:58', '2026-03-01 11:28:58', '/api/tool/gen/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1374, '2026-03-01 11:29:17', '2026-03-01 11:29:17', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1375, '2026-03-01 11:29:17', '2026-03-01 11:29:17', '/api/system/student/page', 'GET', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1376, '2026-03-01 11:29:17', '2026-03-01 11:29:17', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1377, '2026-03-01 11:29:17', '2026-03-01 11:29:17', '/api/crypto/config', 'GET', 200, 1, 4, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1378, '2026-03-01 11:29:17', '2026-03-01 11:29:17', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1379, '2026-03-01 11:29:28', '2026-03-01 11:29:28', '/api/sys/file/upload/image', 'POST', 200, 1, 46, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1380, '2026-03-01 11:29:31', '2026-03-01 11:29:31', '/api/system/student', 'POST', 200, 1, 46, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1381, '2026-03-01 11:29:32', '2026-03-01 11:29:32', '/api/system/student/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1382, '2026-03-01 11:31:03', '2026-03-01 11:31:03', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1383, '2026-03-01 11:31:03', '2026-03-01 11:31:03', '/api/system/student/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1384, '2026-03-01 11:31:03', '2026-03-01 11:31:03', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1385, '2026-03-01 11:31:03', '2026-03-01 11:31:03', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1386, '2026-03-01 11:31:03', '2026-03-01 11:31:03', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1387, '2026-03-01 11:31:07', '2026-03-01 11:31:07', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1388, '2026-03-01 11:31:07', '2026-03-01 11:31:07', '/api/system/student/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1389, '2026-03-01 11:31:07', '2026-03-01 11:31:07', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1390, '2026-03-01 11:31:07', '2026-03-01 11:31:07', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1391, '2026-03-01 11:31:07', '2026-03-01 11:31:07', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1392, '2026-03-01 11:32:58', '2026-03-01 11:32:58', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1393, '2026-03-01 11:32:58', '2026-03-01 11:32:58', '/api/system/student/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1394, '2026-03-01 11:32:58', '2026-03-01 11:32:58', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1395, '2026-03-01 11:32:59', '2026-03-01 11:32:59', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1396, '2026-03-01 11:32:59', '2026-03-01 11:32:59', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1397, '2026-03-01 11:35:23', '2026-03-01 11:35:23', '/api/system/student/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1398, '2026-03-01 11:35:23', '2026-03-01 11:35:23', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1399, '2026-03-01 11:35:23', '2026-03-01 11:35:23', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1400, '2026-03-01 11:35:23', '2026-03-01 11:35:23', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1401, '2026-03-01 11:35:23', '2026-03-01 11:35:23', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1402, '2026-03-01 11:35:27', '2026-03-01 11:35:27', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1403, '2026-03-01 11:35:27', '2026-03-01 11:35:27', '/api/system/student/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1404, '2026-03-01 11:35:27', '2026-03-01 11:35:27', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1405, '2026-03-01 11:35:27', '2026-03-01 11:35:27', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1406, '2026-03-01 11:35:27', '2026-03-01 11:35:27', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1407, '2026-03-01 11:35:30', '2026-03-01 11:35:30', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1408, '2026-03-01 11:35:30', '2026-03-01 11:35:30', '/api/system/student/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1409, '2026-03-01 11:35:30', '2026-03-01 11:35:30', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1410, '2026-03-01 11:35:30', '2026-03-01 11:35:30', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1411, '2026-03-01 11:35:30', '2026-03-01 11:35:30', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1412, '2026-03-01 11:35:34', '2026-03-01 11:35:34', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1413, '2026-03-01 11:35:34', '2026-03-01 11:35:34', '/api/system/student/page', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1414, '2026-03-01 11:35:34', '2026-03-01 11:35:34', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1415, '2026-03-01 11:35:34', '2026-03-01 11:35:34', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1416, '2026-03-01 11:35:34', '2026-03-01 11:35:34', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1417, '2026-03-01 11:35:41', '2026-03-01 11:35:41', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1418, '2026-03-01 11:35:41', '2026-03-01 11:35:41', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1419, '2026-03-01 11:35:41', '2026-03-01 11:35:41', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1420, '2026-03-01 11:35:41', '2026-03-01 11:35:41', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1421, '2026-03-01 11:35:41', '2026-03-01 11:35:41', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1422, '2026-03-01 11:35:46', '2026-03-01 11:35:46', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1423, '2026-03-01 11:35:46', '2026-03-01 11:35:46', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1424, '2026-03-01 11:35:46', '2026-03-01 11:35:46', '/api/system/student/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1425, '2026-03-01 11:35:46', '2026-03-01 11:35:46', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1426, '2026-03-01 11:35:54', '2026-03-01 11:35:54', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1427, '2026-03-01 11:35:54', '2026-03-01 11:35:54', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1428, '2026-03-01 11:35:54', '2026-03-01 11:35:54', '/api/system/student/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1429, '2026-03-01 11:35:54', '2026-03-01 11:35:54', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1430, '2026-03-01 11:43:18', '2026-03-01 11:43:18', '/api/crypto/config', 'GET', 200, 1, 86, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1431, '2026-03-01 11:43:18', '2026-03-01 11:43:18', '/api/sys/config-group/public', 'GET', 200, 1, 77, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1432, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1433, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1434, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/auth/info', 'GET', 200, 1, 79, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1435, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/sys/chat/unread-count', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1436, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/dashboard/stats', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1437, '2026-03-01 11:43:22', '2026-03-01 11:43:22', '/api/sys/notice/unread-count', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1438, '2026-03-01 11:43:23', '2026-03-01 11:43:23', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1439, '2026-03-01 11:43:23', '2026-03-01 11:43:23', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1440, '2026-03-01 11:43:23', '2026-03-01 11:43:23', '/api/auth/info', 'GET', 200, 1, 46, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1441, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/sys/chat/unread-count', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1442, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/sys/notice/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1443, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/dashboard/stats', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1444, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/crypto/config', 'GET', 200, 1, 3, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1445, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1446, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/auth/info', 'GET', 200, 1, 35, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1447, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/sys/chat/unread-count', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1448, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/sys/notice/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1449, '2026-03-01 11:43:24', '2026-03-01 11:43:24', '/api/dashboard/stats', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1450, '2026-03-01 11:43:26', '2026-03-01 11:43:26', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1451, '2026-03-01 11:43:26', '2026-03-01 11:43:26', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1452, '2026-03-01 11:43:26', '2026-03-01 11:43:26', '/api/system/student/page', 'GET', 200, 1, 85, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1453, '2026-03-01 11:43:28', '2026-03-01 11:43:28', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1454, '2026-03-01 11:43:28', '2026-03-01 11:43:28', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1455, '2026-03-01 11:43:29', '2026-03-01 11:43:29', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1456, '2026-03-01 11:43:29', '2026-03-01 11:43:29', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1457, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1458, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1459, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1460, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1461, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1462, '2026-03-01 11:43:30', '2026-03-01 11:43:30', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1463, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1464, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1465, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1466, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1467, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1468, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1469, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1470, '2026-03-01 11:43:31', '2026-03-01 11:43:31', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1471, '2026-03-01 11:43:32', '2026-03-01 11:43:32', '/api/auth/info', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1472, '2026-03-01 11:43:32', '2026-03-01 11:43:32', '/api/sys/notice/unread-count', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1473, '2026-03-01 11:43:32', '2026-03-01 11:43:32', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1474, '2026-03-01 11:43:32', '2026-03-01 11:43:32', '/api/dashboard/stats', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1475, '2026-03-01 11:43:35', '2026-03-01 11:43:35', '/api/tool/gen/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1476, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1477, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1478, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/auth/info', 'GET', 200, 1, 34, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1479, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1480, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1481, '2026-03-01 11:43:36', '2026-03-01 11:43:36', '/api/tool/gen/page', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1482, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1483, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1484, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/auth/info', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1485, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1486, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/sys/chat/unread-count', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1487, '2026-03-01 11:43:37', '2026-03-01 11:43:37', '/api/tool/gen/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1488, '2026-03-01 11:43:38', '2026-03-01 11:43:38', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1489, '2026-03-01 11:43:38', '2026-03-01 11:43:38', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1490, '2026-03-01 11:43:38', '2026-03-01 11:43:38', '/api/auth/info', 'GET', 200, 1, 62, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1491, '2026-03-01 11:43:39', '2026-03-01 11:43:39', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1492, '2026-03-01 11:43:39', '2026-03-01 11:43:39', '/api/sys/notice/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1493, '2026-03-01 11:43:39', '2026-03-01 11:43:39', '/api/tool/gen/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1494, '2026-03-01 11:43:41', '2026-03-01 11:43:41', '/api/sys/file-group/list', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1495, '2026-03-01 11:43:41', '2026-03-01 11:43:41', '/api/sys/file/page-by-group', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1496, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1497, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1498, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/auth/info', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1499, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/sys/notice/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1500, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1501, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/sys/file-group/list', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1502, '2026-03-01 11:43:43', '2026-03-01 11:43:43', '/api/sys/file/page-by-group', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1503, '2026-03-01 11:43:45', '2026-03-01 11:43:45', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1504, '2026-03-01 11:43:45', '2026-03-01 11:43:45', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1505, '2026-03-01 11:43:45', '2026-03-01 11:43:45', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1506, '2026-03-01 11:43:49', '2026-03-01 11:43:49', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1507, '2026-03-01 11:43:49', '2026-03-01 11:43:49', '/api/system/student/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1508, '2026-03-01 11:43:49', '2026-03-01 11:43:49', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1509, '2026-03-01 11:43:50', '2026-03-01 11:43:50', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1510, '2026-03-01 11:43:50', '2026-03-01 11:43:50', '/api/system/student/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1511, '2026-03-01 11:43:51', '2026-03-01 11:43:51', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1512, '2026-03-01 11:44:39', '2026-03-01 11:44:39', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1513, '2026-03-01 11:44:39', '2026-03-01 11:44:40', '/api/auth/captcha', 'GET', 200, 1, 272, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1514, '2026-03-01 11:44:48', '2026-03-01 11:44:48', '/api/auth/login', 'POST', 200, 1, 39, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1515, '2026-03-01 11:44:48', '2026-03-01 11:44:48', '/api/auth/captcha', 'GET', 200, 1, 6, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1516, '2026-03-01 11:44:53', '2026-03-01 11:44:53', '/api/auth/login', 'POST', 200, 1, 17, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1517, '2026-03-01 11:44:53', '2026-03-01 11:44:53', '/api/auth/captcha', 'GET', 200, 1, 8, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1518, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/auth/login', 'POST', 200, 1, 173, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1519, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/auth/info', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1520, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1521, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/dashboard/stats', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1522, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/sys/notice/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1523, '2026-03-01 11:44:57', '2026-03-01 11:44:57', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1524, '2026-03-01 11:45:01', '2026-03-01 11:45:01', '/api/tool/gen/page', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1525, '2026-03-01 11:45:05', '2026-03-01 11:45:05', '/api/tool/gen/preview/4', 'GET', 200, 1, 148, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1526, '2026-03-01 11:45:42', '2026-03-01 11:45:42', '/api/sys/dict/type/list', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1527, '2026-03-01 11:45:42', '2026-03-01 11:45:42', '/api/tool/gen/4', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1528, '2026-03-01 11:45:57', '2026-03-01 11:45:57', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1529, '2026-03-01 11:45:57', '2026-03-01 11:45:57', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1530, '2026-03-01 11:45:57', '2026-03-01 11:45:57', '/api/tool/gen/page', 'GET', 200, 1, 139, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1531, '2026-03-01 11:46:02', '2026-03-01 11:46:02', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1532, '2026-03-01 11:46:03', '2026-03-01 11:46:03', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 53, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1533, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1534, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1535, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/auth/info', 'GET', 200, 1, 37, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1536, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/sys/notice/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1537, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/sys/chat/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1538, '2026-03-01 11:46:04', '2026-03-01 11:46:04', '/api/tool/gen/page', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1539, '2026-03-01 11:47:12', '2026-03-01 11:47:12', '/api/tool/gen/page', 'GET', 200, 1, 149, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1540, '2026-03-01 11:47:12', '2026-03-01 11:47:12', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1541, '2026-03-01 11:47:20', '2026-03-01 11:47:20', '/api/tool/gen/preview/4', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1542, '2026-03-01 11:48:07', '2026-03-01 11:48:07', '/api/crypto/config', 'GET', 200, 1, 125, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1543, '2026-03-01 11:48:07', '2026-03-01 11:48:07', '/api/sys/config-group/public', 'GET', 200, 1, 137, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1544, '2026-03-01 11:48:07', '2026-03-01 11:48:07', '/api/auth/info', 'GET', 200, 1, 129, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1545, '2026-03-01 11:48:07', '2026-03-01 11:48:07', '/api/sys/notice/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1546, '2026-03-01 11:48:07', '2026-03-01 11:48:07', '/api/sys/chat/unread-count', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1547, '2026-03-01 11:48:08', '2026-03-01 11:48:08', '/api/tool/gen/page', 'GET', 200, 1, 106, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1548, '2026-03-01 11:48:10', '2026-03-01 11:48:10', '/api/tool/gen/preview/4', 'GET', 200, 1, 120, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1549, '2026-03-01 11:48:47', '2026-03-01 11:48:47', '/api/tool/gen/preview/4', 'GET', 200, 1, 41, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1550, '2026-03-01 11:49:37', '2026-03-01 11:49:37', '/api/sys/dict/type/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1551, '2026-03-01 11:49:37', '2026-03-01 11:49:37', '/api/tool/gen/4', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1552, '2026-03-01 11:50:40', '2026-03-01 11:50:40', '/api/tool/gen/page', 'GET', 200, 1, 33, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1553, '2026-03-01 11:50:40', '2026-03-01 11:50:40', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1554, '2026-03-01 11:50:52', '2026-03-01 11:50:52', '/api/tool/gen/page', 'GET', 200, 1, 227, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1555, '2026-03-01 11:50:52', '2026-03-01 11:50:52', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1556, '2026-03-01 11:50:53', '2026-03-01 11:50:53', '/api/tool/gen/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1557, '2026-03-01 11:50:53', '2026-03-01 11:50:53', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1558, '2026-03-01 11:51:20', '2026-03-01 11:51:20', '/api/tool/gen/preview/4', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1559, '2026-03-01 11:51:24', '2026-03-01 11:51:24', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1560, '2026-03-01 11:51:24', '2026-03-01 11:51:24', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1561, '2026-03-01 11:51:29', '2026-03-01 11:51:29', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1562, '2026-03-01 11:51:29', '2026-03-01 11:51:29', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1563, '2026-03-01 11:51:31', '2026-03-01 11:51:31', '/api/tool/gen/page', 'GET', 200, 1, 55, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1564, '2026-03-01 11:51:31', '2026-03-01 11:51:31', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1565, '2026-03-01 11:51:33', '2026-03-01 11:51:33', '/api/tool/gen/preview/4', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1566, '2026-03-01 11:53:23', '2026-03-01 11:53:23', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1567, '2026-03-01 11:53:23', '2026-03-01 11:53:23', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1568, '2026-03-01 11:53:25', '2026-03-01 11:53:25', '/api/tool/gen/page', 'GET', 200, 1, 117, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1569, '2026-03-01 11:53:25', '2026-03-01 11:53:25', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1570, '2026-03-01 11:53:54', '2026-03-01 11:53:54', '/api/tool/gen/preview/4', 'GET', 200, 1, 74, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1571, '2026-03-01 11:54:03', '2026-03-01 11:54:03', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1572, '2026-03-01 11:54:03', '2026-03-01 11:54:03', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1573, '2026-03-01 11:54:06', '2026-03-01 11:54:06', '/api/auth/info', 'GET', 200, 1, 32, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1574, '2026-03-01 11:54:06', '2026-03-01 11:54:06', '/api/sys/notice/unread-count', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1575, '2026-03-01 11:54:06', '2026-03-01 11:54:06', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1576, '2026-03-01 11:54:06', '2026-03-01 11:54:06', '/api/dashboard/stats', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1577, '2026-03-01 11:54:13', '2026-03-01 11:54:13', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1578, '2026-03-01 11:54:13', '2026-03-01 11:54:13', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1579, '2026-03-01 11:54:37', '2026-03-01 11:54:37', '/api/sys/dict/type/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1580, '2026-03-01 11:54:37', '2026-03-01 11:54:37', '/api/tool/gen/4', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1581, '2026-03-01 11:54:51', '2026-03-01 11:54:51', '/api/tool/gen/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1582, '2026-03-01 11:54:51', '2026-03-01 11:54:51', '/api/tool/gen/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1583, '2026-03-01 11:54:52', '2026-03-01 11:54:52', '/api/tool/gen/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1584, '2026-03-01 11:54:52', '2026-03-01 11:54:52', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1585, '2026-03-01 11:54:52', '2026-03-01 11:54:52', '/api/tool/gen/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1586, '2026-03-01 11:54:53', '2026-03-01 11:54:53', '/api/tool/gen/preview/4', 'GET', 200, 1, 39, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1587, '2026-03-01 11:56:27', '2026-03-01 11:56:27', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1588, '2026-03-01 11:56:27', '2026-03-01 11:56:27', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1589, '2026-03-01 11:56:27', '2026-03-01 11:56:28', '/api/auth/info', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1590, '2026-03-01 11:56:28', '2026-03-01 11:56:28', '/api/sys/notice/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1591, '2026-03-01 11:56:28', '2026-03-01 11:56:28', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1592, '2026-03-01 11:56:28', '2026-03-01 11:56:28', '/api/tool/gen/page', 'GET', 200, 1, 35, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1593, '2026-03-01 11:56:47', '2026-03-01 11:56:47', '/api/tool/gen/preview/4', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1594, '2026-03-01 11:56:52', '2026-03-01 11:56:52', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1595, '2026-03-01 11:56:52', '2026-03-01 11:56:52', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1596, '2026-03-01 11:56:53', '2026-03-01 11:56:53', '/api/auth/info', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1597, '2026-03-01 11:56:53', '2026-03-01 11:56:53', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1598, '2026-03-01 11:56:53', '2026-03-01 11:56:53', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1599, '2026-03-01 11:56:53', '2026-03-01 11:56:53', '/api/dashboard/stats', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1600, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/crypto/config', 'GET', 200, 1, 0, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1601, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1602, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/auth/info', 'GET', 200, 1, 29, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1603, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1604, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/sys/notice/unread-count', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1605, '2026-03-01 11:56:59', '2026-03-01 11:56:59', '/api/tool/gen/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1606, '2026-03-01 11:57:02', '2026-03-01 11:57:02', '/api/tool/gen/preview/4', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1607, '2026-03-01 11:57:17', '2026-03-01 11:57:17', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1608, '2026-03-01 11:57:17', '2026-03-01 11:57:17', '/api/sys/config-group/public', 'GET', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1609, '2026-03-01 11:57:29', '2026-03-01 11:57:29', '/api/tool/gen/preview/4', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1610, '2026-03-01 11:58:03', '2026-03-01 11:58:03', '/api/tool/gen/preview/4', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1611, '2026-03-01 11:58:36', '2026-03-01 11:58:36', '/api/sys/dict/type/list', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1612, '2026-03-01 11:58:36', '2026-03-01 11:58:36', '/api/tool/gen/4', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1613, '2026-03-01 12:02:06', '2026-03-01 12:02:06', '/api/tool/gen/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1614, '2026-03-01 12:02:06', '2026-03-01 12:02:06', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1615, '2026-03-01 12:02:10', '2026-03-01 12:02:10', '/api/tool/gen/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1616, '2026-03-01 12:02:10', '2026-03-01 12:02:10', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1617, '2026-03-01 12:04:08', '2026-03-01 12:04:09', '/api/tool/gen/preview/4', 'GET', 200, 1, 203, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1618, '2026-03-01 12:04:19', '2026-03-01 12:04:19', '/api/crypto/config', 'GET', 200, 1, 5, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1619, '2026-03-01 12:04:19', '2026-03-01 12:04:19', '/api/sys/config-group/public', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1620, '2026-03-01 12:04:19', '2026-03-01 12:04:19', '/api/auth/info', 'GET', 200, 1, 92, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1621, '2026-03-01 12:04:20', '2026-03-01 12:04:20', '/api/sys/notice/unread-count', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1622, '2026-03-01 12:04:20', '2026-03-01 12:04:20', '/api/sys/chat/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1623, '2026-03-01 12:04:20', '2026-03-01 12:04:20', '/api/tool/gen/page', 'GET', 200, 1, 112, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1624, '2026-03-01 12:04:24', '2026-03-01 12:04:24', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1625, '2026-03-01 12:04:24', '2026-03-01 12:04:24', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1626, '2026-03-01 12:04:24', '2026-03-01 12:04:24', '/api/auth/info', 'GET', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1627, '2026-03-01 12:04:25', '2026-03-01 12:04:25', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1628, '2026-03-01 12:04:25', '2026-03-01 12:04:25', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1629, '2026-03-01 12:04:25', '2026-03-01 12:04:25', '/api/tool/gen/page', 'GET', 200, 1, 22, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1630, '2026-03-01 12:04:26', '2026-03-01 12:04:26', '/api/tool/gen/preview/4', 'GET', 200, 1, 34, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1631, '2026-03-01 12:04:29', '2026-03-01 12:04:29', '/api/sys/dict/type/list', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1632, '2026-03-01 12:04:29', '2026-03-01 12:04:29', '/api/tool/gen/4', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1633, '2026-03-01 12:04:40', '2026-03-01 12:04:40', '/api/tool/gen', 'PUT', 200, 1, 91, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1634, '2026-03-01 12:04:40', '2026-03-01 12:04:40', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1635, '2026-03-01 12:04:46', '2026-03-01 12:04:46', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1636, '2026-03-01 12:04:47', '2026-03-01 12:04:47', '/api/tool/gen/generate/4', 'POST', 200, 1, 160, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1637, '2026-03-01 12:04:47', '2026-03-01 12:04:47', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1638, '2026-03-01 12:04:47', '2026-03-01 12:04:47', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1639, '2026-03-01 12:04:47', '2026-03-01 12:04:47', '/api/auth/info', 'GET', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1640, '2026-03-01 12:04:48', '2026-03-01 12:04:48', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1641, '2026-03-01 12:04:48', '2026-03-01 12:04:48', '/api/sys/chat/unread-count', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1642, '2026-03-01 12:04:48', '2026-03-01 12:04:48', '/api/tool/gen/page', 'GET', 200, 1, 136, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1643, '2026-03-01 12:05:30', '2026-03-01 12:05:30', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 91, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1644, '2026-03-01 12:05:30', '2026-03-01 12:05:30', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1645, '2026-03-01 12:05:30', '2026-03-01 12:05:30', '/api/crypto/config', 'GET', 200, 1, 6, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1646, '2026-03-01 12:05:30', '2026-03-01 12:05:30', '/api/system/student/page', 'GET', 200, 1, 132, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1647, '2026-03-01 12:05:58', '2026-03-01 12:05:59', '/api/system/student/template', 'GET', 200, 1, 826, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1648, '2026-03-01 12:06:10', '2026-03-01 12:06:10', '/api/system/student/7', 'DELETE', 200, 1, 43, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1649, '2026-03-01 12:06:10', '2026-03-01 12:06:10', '/api/system/student/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1650, '2026-03-01 12:06:16', '2026-03-01 12:06:16', '/api/tool/gen/page', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1651, '2026-03-01 12:06:18', '2026-03-01 12:06:18', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1652, '2026-03-01 12:06:19', '2026-03-01 12:06:19', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 37, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1653, '2026-03-01 12:06:19', '2026-03-01 12:06:19', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1654, '2026-03-01 12:06:19', '2026-03-01 12:06:19', '/api/sys/config-group/public', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1655, '2026-03-01 12:06:19', '2026-03-01 12:06:19', '/api/auth/info', 'GET', 200, 1, 57, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1656, '2026-03-01 12:06:20', '2026-03-01 12:06:20', '/api/sys/notice/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1657, '2026-03-01 12:06:20', '2026-03-01 12:06:20', '/api/sys/chat/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1658, '2026-03-01 12:06:20', '2026-03-01 12:06:20', '/api/tool/gen/page', 'GET', 200, 1, 28, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1659, '2026-03-01 12:06:25', '2026-03-01 12:06:25', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1660, '2026-03-01 12:06:35', '2026-03-01 12:06:35', '/api/sys/dict/type/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1661, '2026-03-01 12:06:35', '2026-03-01 12:06:35', '/api/tool/gen/4', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1662, '2026-03-01 12:06:53', '2026-03-01 12:06:53', '/api/tool/gen', 'PUT', 200, 1, 60, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1663, '2026-03-01 12:06:53', '2026-03-01 12:06:53', '/api/tool/gen/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1664, '2026-03-01 12:06:58', '2026-03-01 12:06:58', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1665, '2026-03-01 12:07:01', '2026-03-01 12:07:02', '/api/tool/gen/generate/4', 'POST', 200, 1, 210, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1666, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1667, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1668, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/auth/info', 'GET', 200, 1, 36, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1669, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/sys/notice/unread-count', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1670, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/sys/chat/unread-count', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1671, '2026-03-01 12:07:02', '2026-03-01 12:07:02', '/api/tool/gen/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1672, '2026-03-01 12:07:32', '2026-03-01 12:07:32', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 99, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1673, '2026-03-01 12:07:32', '2026-03-01 12:07:32', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1674, '2026-03-01 12:07:32', '2026-03-01 12:07:32', '/api/crypto/config', 'GET', 200, 1, 24, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1675, '2026-03-01 12:07:32', '2026-03-01 12:07:32', '/api/system/student/page', 'GET', 200, 1, 162, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1676, '2026-03-01 12:08:04', '2026-03-01 12:08:04', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1677, '2026-03-01 12:08:04', '2026-03-01 12:08:04', '/api/system/student/page', 'GET', 200, 1, 31, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1678, '2026-03-01 12:08:04', '2026-03-01 12:08:04', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1679, '2026-03-01 12:08:27', '2026-03-01 12:08:27', '/api/sys/file/upload/image', 'POST', 200, 1, 51, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1680, '2026-03-01 12:08:31', '2026-03-01 12:08:31', '/api/system/student', 'POST', 200, 1, 38, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1681, '2026-03-01 12:08:31', '2026-03-01 12:08:31', '/api/system/student/page', 'GET', 200, 1, 31, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1682, '2026-03-01 12:08:47', '2026-03-01 12:08:47', '/api/system/student', 'PUT', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1683, '2026-03-01 12:08:56', '2026-03-01 12:08:56', '/api/tool/gen/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1684, '2026-03-01 12:08:57', '2026-03-01 12:08:57', '/api/sys/dict/type/list', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1685, '2026-03-01 12:08:57', '2026-03-01 12:08:57', '/api/tool/gen/4', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1686, '2026-03-01 12:09:27', '2026-03-01 12:09:27', '/api/tool/gen', 'PUT', 200, 1, 48, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1687, '2026-03-01 12:09:27', '2026-03-01 12:09:27', '/api/tool/gen/page', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1688, '2026-03-01 12:09:30', '2026-03-01 12:09:30', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1689, '2026-03-01 12:09:32', '2026-03-01 12:09:32', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1690, '2026-03-01 12:09:32', '2026-03-01 12:09:32', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1691, '2026-03-01 12:09:32', '2026-03-01 12:09:32', '/api/sys/config-group/public', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1692, '2026-03-01 12:09:32', '2026-03-01 12:09:32', '/api/auth/info', 'GET', 200, 1, 60, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1693, '2026-03-01 12:09:33', '2026-03-01 12:09:33', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1694, '2026-03-01 12:09:33', '2026-03-01 12:09:33', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1695, '2026-03-01 12:09:33', '2026-03-01 12:09:33', '/api/tool/gen/page', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1696, '2026-03-01 12:09:42', '2026-03-01 12:09:42', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1697, '2026-03-01 12:09:44', '2026-03-01 12:09:44', '/api/tool/gen/generate/4', 'POST', 200, 1, 209, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1698, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1699, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/sys/config-group/public', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1700, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/auth/info', 'GET', 200, 1, 41, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1701, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/sys/chat/unread-count', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1702, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/sys/notice/unread-count', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1703, '2026-03-01 12:09:45', '2026-03-01 12:09:45', '/api/tool/gen/page', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1704, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/crypto/config', 'GET', 200, 1, 66, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1705, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/sys/config-group/public', 'GET', 200, 1, 67, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1706, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/auth/info', 'GET', 200, 1, 104, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1707, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/sys/notice/unread-count', 'GET', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1708, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/sys/chat/unread-count', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1709, '2026-03-01 12:10:19', '2026-03-01 12:10:19', '/api/tool/gen/page', 'GET', 200, 1, 204, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1710, '2026-03-01 12:10:21', '2026-03-01 12:10:21', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1711, '2026-03-01 12:10:21', '2026-03-01 12:10:21', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1712, '2026-03-01 12:10:21', '2026-03-01 12:10:21', '/api/system/student/page', 'GET', 200, 1, 31, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1713, '2026-03-01 12:10:33', '2026-03-01 12:10:34', '/api/tool/gen/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1714, '2026-03-01 12:10:41', '2026-03-01 12:10:41', '/api/sys/dict/type/list', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1715, '2026-03-01 12:10:41', '2026-03-01 12:10:41', '/api/tool/gen/4', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1716, '2026-03-01 12:10:49', '2026-03-01 12:10:49', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1717, '2026-03-01 12:10:49', '2026-03-01 12:10:49', '/api/system/student/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1718, '2026-03-01 12:10:49', '2026-03-01 12:10:49', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1719, '2026-03-01 12:10:54', '2026-03-01 12:10:54', '/api/system/student', 'PUT', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1720, '2026-03-01 12:10:56', '2026-03-01 12:10:56', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1721, '2026-03-01 12:10:56', '2026-03-01 12:10:56', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1722, '2026-03-01 12:10:59', '2026-03-01 12:10:59', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1723, '2026-03-01 12:11:15', '2026-03-01 12:11:15', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1724, '2026-03-01 12:11:48', '2026-03-01 12:11:48', '/api/system/student', 'PUT', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1725, '2026-03-01 12:12:30', '2026-03-01 12:12:30', '/api/tool/gen/page', 'GET', 200, 1, 7, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1726, '2026-03-01 12:12:39', '2026-03-01 12:12:39', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1727, '2026-03-01 12:12:39', '2026-03-01 12:12:39', '/api/system/student/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1728, '2026-03-01 12:12:39', '2026-03-01 12:12:39', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1729, '2026-03-01 12:12:40', '2026-03-01 12:12:40', '/api/tool/gen/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1730, '2026-03-01 12:13:36', '2026-03-01 12:13:36', '/api/tool/gen/page', 'GET', 200, 1, 155, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1731, '2026-03-01 12:13:36', '2026-03-01 12:13:36', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1732, '2026-03-01 12:14:02', '2026-03-01 12:14:02', '/api/tool/gen/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1733, '2026-03-01 12:14:02', '2026-03-01 12:14:02', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1734, '2026-03-01 12:14:29', '2026-03-01 12:14:29', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1735, '2026-03-01 12:14:37', '2026-03-01 12:14:37', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 51, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1736, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1737, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1738, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/auth/info', 'GET', 200, 1, 40, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1739, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/sys/chat/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1740, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1741, '2026-03-01 12:14:38', '2026-03-01 12:14:38', '/api/tool/gen/page', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1742, '2026-03-01 12:15:09', '2026-03-01 12:15:09', '/api/crypto/config', 'GET', 200, 1, 122, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1743, '2026-03-01 12:15:09', '2026-03-01 12:15:09', '/api/sys/config-group/public', 'GET', 200, 1, 104, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1744, '2026-03-01 12:15:09', '2026-03-01 12:15:09', '/api/auth/info', 'GET', 200, 1, 113, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1745, '2026-03-01 12:15:10', '2026-03-01 12:15:10', '/api/sys/notice/unread-count', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1746, '2026-03-01 12:15:10', '2026-03-01 12:15:10', '/api/sys/chat/unread-count', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1747, '2026-03-01 12:15:10', '2026-03-01 12:15:10', '/api/tool/gen/page', 'GET', 200, 1, 100, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1748, '2026-03-01 12:15:13', '2026-03-01 12:15:13', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1749, '2026-03-01 12:15:14', '2026-03-01 12:15:14', '/api/tool/gen/generate/4', 'POST', 200, 1, 274, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1750, '2026-03-01 12:15:14', '2026-03-01 12:15:14', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1751, '2026-03-01 12:15:14', '2026-03-01 12:15:14', '/api/sys/config-group/public', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1752, '2026-03-01 12:15:15', '2026-03-01 12:15:15', '/api/auth/info', 'GET', 200, 1, 58, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1753, '2026-03-01 12:15:15', '2026-03-01 12:15:15', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1754, '2026-03-01 12:15:15', '2026-03-01 12:15:15', '/api/sys/chat/unread-count', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1755, '2026-03-01 12:15:15', '2026-03-01 12:15:15', '/api/tool/gen/page', 'GET', 200, 1, 17, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1756, '2026-03-01 12:15:17', '2026-03-01 12:15:17', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1757, '2026-03-01 12:15:17', '2026-03-01 12:15:17', '/api/system/student/page', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1758, '2026-03-01 12:15:17', '2026-03-01 12:15:17', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1759, '2026-03-01 12:15:41', '2026-03-01 12:15:41', '/api/crypto/config', 'GET', 200, 1, 92, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1760, '2026-03-01 12:15:41', '2026-03-01 12:15:41', '/api/sys/config-group/public', 'GET', 200, 1, 96, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1761, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1762, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1763, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/auth/info', 'GET', 200, 1, 104, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1764, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/sys/notice/unread-count', 'GET', 200, 1, 27, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1765, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/dashboard/stats', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1766, '2026-03-01 12:15:44', '2026-03-01 12:15:44', '/api/sys/chat/unread-count', 'GET', 200, 1, 19, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1767, '2026-03-01 12:15:50', '2026-03-01 12:15:50', '/api/tool/gen/page', 'GET', 200, 1, 95, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1768, '2026-03-01 12:15:50', '2026-03-01 12:15:50', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1769, '2026-03-01 12:15:50', '2026-03-01 12:15:50', '/api/system/student/page', 'GET', 200, 1, 20, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1770, '2026-03-01 12:15:50', '2026-03-01 12:15:50', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1771, '2026-03-01 12:15:54', '2026-03-01 12:15:54', '/api/system/student/8', 'DELETE', 200, 1, 67, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1772, '2026-03-01 12:15:54', '2026-03-01 12:15:54', '/api/system/student/page', 'GET', 200, 1, 14, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1773, '2026-03-01 12:16:10', '2026-03-01 12:16:10', '/api/sys/file/upload/image', 'POST', 200, 1, 24, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1774, '2026-03-01 12:16:12', '2026-03-01 12:16:12', '/api/system/student', 'POST', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1775, '2026-03-01 12:16:13', '2026-03-01 12:16:13', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1776, '2026-03-01 12:16:24', '2026-03-01 12:16:24', '/api/system/student', 'PUT', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1777, '2026-03-01 12:16:27', '2026-03-01 12:16:27', '/api/system/student', 'PUT', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1778, '2026-03-01 12:16:28', '2026-03-01 12:16:28', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1779, '2026-03-01 12:16:34', '2026-03-01 12:16:34', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1780, '2026-03-01 12:16:53', '2026-03-01 12:16:53', '/api/system/student', 'PUT', 200, 1, 1, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1781, '2026-03-01 12:17:14', '2026-03-01 12:17:14', '/api/tool/gen/page', 'GET', 200, 1, 38, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1782, '2026-03-01 12:17:17', '2026-03-01 12:17:17', '/api/sys/dict/type/list', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1783, '2026-03-01 12:17:17', '2026-03-01 12:17:17', '/api/tool/gen/4', 'GET', 200, 1, 16, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1784, '2026-03-01 12:17:59', '2026-03-01 12:17:59', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1785, '2026-03-01 12:17:59', '2026-03-01 12:17:59', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1786, '2026-03-01 12:17:59', '2026-03-01 12:17:59', '/api/system/student/page', 'GET', 200, 1, 93, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1787, '2026-03-01 12:17:59', '2026-03-01 12:17:59', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1788, '2026-03-01 12:17:59', '2026-03-01 12:17:59', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 15, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1789, '2026-03-01 12:20:00', '2026-03-01 12:20:00', '/api/crypto/config', 'GET', 200, 1, 130, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1790, '2026-03-01 12:20:00', '2026-03-01 12:20:00', '/api/sys/config-group/public', 'GET', 200, 1, 126, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1791, '2026-03-01 12:20:03', '2026-03-01 12:20:03', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1792, '2026-03-01 12:20:03', '2026-03-01 12:20:03', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1793, '2026-03-01 12:20:03', '2026-03-01 12:20:04', '/api/auth/info', 'GET', 200, 1, 98, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1794, '2026-03-01 12:20:04', '2026-03-01 12:20:04', '/api/sys/notice/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1795, '2026-03-01 12:20:04', '2026-03-01 12:20:04', '/api/sys/chat/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1796, '2026-03-01 12:20:04', '2026-03-01 12:20:04', '/api/dashboard/stats', 'GET', 200, 1, 26, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1797, '2026-03-01 12:20:07', '2026-03-01 12:20:07', '/api/tool/gen/page', 'GET', 200, 1, 93, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1798, '2026-03-01 12:20:09', '2026-03-01 12:20:09', '/api/tool/gen/preview-remove/4', 'GET', 200, 1, 18, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1799, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/tool/gen/remove-code/4', 'DELETE', 200, 1, 53, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1800, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/crypto/config', 'GET', 200, 1, 2, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1801, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/sys/config-group/public', 'GET', 200, 1, 2, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1802, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/auth/info', 'GET', 200, 1, 47, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1803, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/sys/chat/unread-count', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1804, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/sys/notice/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1805, '2026-03-01 12:20:10', '2026-03-01 12:20:10', '/api/tool/gen/page', 'GET', 200, 1, 63, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1806, '2026-03-01 12:20:16', '2026-03-01 12:20:16', '/api/tool/gen/preview-generate/4', 'GET', 200, 1, 10, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1807, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/tool/gen/generate/4', 'POST', 200, 1, 230, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1808, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1809, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/sys/config-group/public', 'GET', 200, 1, 4, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1810, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/auth/info', 'GET', 200, 1, 35, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1811, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/sys/notice/unread-count', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1812, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/sys/chat/unread-count', 'GET', 200, 1, 11, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1813, '2026-03-01 12:20:17', '2026-03-01 12:20:17', '/api/tool/gen/page', 'GET', 200, 1, 23, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1814, '2026-03-01 12:20:20', '2026-03-01 12:20:20', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 55, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1815, '2026-03-01 12:20:20', '2026-03-01 12:20:20', '/api/system/student/page', 'GET', 200, 1, 49, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1816, '2026-03-01 12:20:20', '2026-03-01 12:20:20', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 6, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1817, '2026-03-01 12:21:27', '2026-03-01 12:21:27', '/api/crypto/config', 'GET', 200, 1, 58, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1818, '2026-03-01 12:21:27', '2026-03-01 12:21:27', '/api/sys/config-group/public', 'GET', 200, 1, 57, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1819, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/crypto/config', 'GET', 200, 1, 1, '127.0.0.1', NULL);
INSERT INTO `sys_api_access_log` VALUES (1820, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/sys/config-group/public', 'GET', 200, 1, 3, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1821, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/auth/info', 'GET', 200, 1, 83, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1822, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/sys/notice/unread-count', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1823, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/sys/chat/unread-count', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1824, '2026-03-01 12:21:31', '2026-03-01 12:21:31', '/api/dashboard/stats', 'GET', 200, 1, 30, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1825, '2026-03-01 12:21:33', '2026-03-01 12:21:33', '/api/tool/gen/page', 'GET', 200, 1, 85, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1826, '2026-03-01 12:21:34', '2026-03-01 12:21:34', '/api/sys/dict/data/type/gender', 'GET', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1827, '2026-03-01 12:21:34', '2026-03-01 12:21:34', '/api/system/student/page', 'GET', 200, 1, 21, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1828, '2026-03-01 12:21:34', '2026-03-01 12:21:34', '/api/sys/dict/data/type/sys_status', 'GET', 200, 1, 5, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1829, '2026-03-01 12:21:38', '2026-03-01 12:21:38', '/api/system/student', 'PUT', 200, 1, 41, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1830, '2026-03-01 12:21:38', '2026-03-01 12:21:38', '/api/system/student/page', 'GET', 200, 1, 8, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1831, '2026-03-01 12:21:44', '2026-03-01 12:21:44', '/api/system/student', 'PUT', 200, 1, 12, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1832, '2026-03-01 12:21:44', '2026-03-01 12:21:44', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1833, '2026-03-01 12:21:51', '2026-03-01 12:21:51', '/api/system/student', 'PUT', 200, 1, 13, '127.0.0.1', 1);
INSERT INTO `sys_api_access_log` VALUES (1834, '2026-03-01 12:21:51', '2026-03-01 12:21:51', '/api/system/student/page', 'GET', 200, 1, 9, '127.0.0.1', 1);

-- ----------------------------
-- Table structure for `sys_chat_group`
-- ----------------------------
DROP TABLE IF EXISTS `sys_chat_group`;
CREATE TABLE `sys_chat_group`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '群ID',
`name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '群名称',
`avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '群头像',
`owner_id` bigint NOT NULL COMMENT '群主ID',
`announcement` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '群公告',
`max_members` int NULL DEFAULT 200 COMMENT '最大成员数',
`status` tinyint NULL DEFAULT 1 COMMENT '状态：0-解散 1-正常',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_owner_id`(`owner_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '群聊表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_chat_group
-- ----------------------------
INSERT INTO `sys_chat_group` VALUES (1, '测试', NULL, 2, '1111111111', 200, 0, '2026-01-31 11:24:29', '2026-01-31 12:39:26');
INSERT INTO `sys_chat_group` VALUES (2, '内部沟通群', NULL, 1, NULL, 200, 1, '2026-01-31 12:42:47', '2026-02-07 09:54:17');
INSERT INTO `sys_chat_group` VALUES (3, '测试', NULL, 1, NULL, 200, 1, '2026-01-31 23:20:05', '2026-01-31 23:20:37');

-- ----------------------------
-- Table structure for `sys_chat_group_member`
-- ----------------------------
DROP TABLE IF EXISTS `sys_chat_group_member`;
CREATE TABLE `sys_chat_group_member`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`group_id` bigint NOT NULL COMMENT '群ID',
`user_id` bigint NOT NULL COMMENT '用户ID',
`nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '群内昵称',
`role` tinyint NULL DEFAULT 0 COMMENT '角色：0-普通成员 1-管理员 2-群主',
`muted` tinyint NULL DEFAULT 0 COMMENT '是否禁言：0-否 1-是',
`join_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_group_user`(`group_id` ASC, `user_id` ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '群成员表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_chat_group_member
-- ----------------------------
INSERT INTO `sys_chat_group_member` VALUES (4, 2, 1, NULL, 2, 0, '2026-01-31 12:42:47');
INSERT INTO `sys_chat_group_member` VALUES (5, 2, 2, NULL, 0, 0, '2026-01-31 12:42:47');
INSERT INTO `sys_chat_group_member` VALUES (6, 2, 3, NULL, 0, 0, '2026-01-31 12:42:47');
INSERT INTO `sys_chat_group_member` VALUES (7, 3, 1, NULL, 2, 0, '2026-01-31 23:20:05');
INSERT INTO `sys_chat_group_member` VALUES (8, 3, 2, NULL, 0, 0, '2026-01-31 23:20:05');
INSERT INTO `sys_chat_group_member` VALUES (9, 3, 3, NULL, 0, 0, '2026-01-31 23:20:05');
INSERT INTO `sys_chat_group_member` VALUES (10, 3, 4, NULL, 0, 0, '2026-01-31 23:20:05');
INSERT INTO `sys_chat_group_member` VALUES (11, 3, 5, NULL, 0, 0, '2026-01-31 23:20:05');

-- ----------------------------
-- Table structure for `sys_chat_group_message`
-- ----------------------------
DROP TABLE IF EXISTS `sys_chat_group_message`;
CREATE TABLE `sys_chat_group_message`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '消息ID',
`group_id` bigint NOT NULL COMMENT '群ID',
`sender_id` bigint NOT NULL COMMENT '发送者ID',
`sender_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '发送者名称',
`sender_avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '发送者头像',
`content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '消息内容',
`msg_type` tinyint NULL DEFAULT 1 COMMENT '消息类型：1-文本 2-图片 3-文件 4-系统消息',
`send_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_group_id`(`group_id` ASC) USING BTREE,
  INDEX `idx_send_time`(`send_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 111 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '群消息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_chat_group_message
-- ----------------------------
INSERT INTO `sys_chat_group_message` VALUES (1, 1, 0, '系统消息', NULL, 'test 创建了群聊', 4, '2026-01-31 11:24:29');
INSERT INTO `sys_chat_group_message` VALUES (2, 1, 2, 'test', NULL, '你好', 1, '2026-01-31 11:24:35');
INSERT INTO `sys_chat_group_message` VALUES (3, 1, 1, '超级管理员', NULL, '1111', 1, '2026-01-31 11:24:49');
INSERT INTO `sys_chat_group_message` VALUES (4, 1, 2, 'test', NULL, '1212', 1, '2026-01-31 11:24:51');
INSERT INTO `sys_chat_group_message` VALUES (5, 1, 2, 'test', NULL, '哈哈哈', 1, '2026-01-31 11:24:57');
INSERT INTO `sys_chat_group_message` VALUES (6, 1, 1, '超级管理员', NULL, '牛逼的额啊', 1, '2026-01-31 11:25:03');
INSERT INTO `sys_chat_group_message` VALUES (7, 1, 2, 'test', NULL, '111', 1, '2026-01-31 11:25:13');
INSERT INTO `sys_chat_group_message` VALUES (8, 1, 1, '超级管理员', NULL, '112', 1, '2026-01-31 11:25:17');
INSERT INTO `sys_chat_group_message` VALUES (9, 1, 2, 'test', NULL, '哈哈哈', 1, '2026-01-31 11:25:21');
INSERT INTO `sys_chat_group_message` VALUES (10, 1, 2, 'test', NULL, '牛逼', 1, '2026-01-31 11:25:24');
INSERT INTO `sys_chat_group_message` VALUES (11, 1, 1, '超级管理员', NULL, '老牛逼', 1, '2026-01-31 11:25:27');
INSERT INTO `sys_chat_group_message` VALUES (12, 1, 2, 'test', NULL, '你是', 1, '2026-01-31 11:25:30');
INSERT INTO `sys_chat_group_message` VALUES (13, 1, 1, '超级管理员', NULL, '？？？', 1, '2026-01-31 11:25:34');
INSERT INTO `sys_chat_group_message` VALUES (14, 1, 1, '超级管理员', NULL, '傻逼的吧', 1, '2026-01-31 11:25:37');
INSERT INTO `sys_chat_group_message` VALUES (15, 1, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:26:07');
INSERT INTO `sys_chat_group_message` VALUES (16, 1, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:26:08');
INSERT INTO `sys_chat_group_message` VALUES (17, 1, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:26:08');
INSERT INTO `sys_chat_group_message` VALUES (18, 1, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:26:08');
INSERT INTO `sys_chat_group_message` VALUES (19, 1, 2, 'test', NULL, '121212', 1, '2026-01-31 12:26:13');
INSERT INTO `sys_chat_group_message` VALUES (20, 1, 1, '超级管理员', NULL, '222', 1, '2026-01-31 12:26:15');
INSERT INTO `sys_chat_group_message` VALUES (21, 1, 2, 'test', NULL, '牛逼啊', 1, '2026-01-31 12:26:19');
INSERT INTO `sys_chat_group_message` VALUES (22, 1, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:26:21');
INSERT INTO `sys_chat_group_message` VALUES (23, 1, 1, '超级管理员', NULL, 'http://localhost:8080/file/images/2026/01/31/1b4f6f9062ab400f9259bdac0eb8db10.jpg', 2, '2026-01-31 12:26:52');
INSERT INTO `sys_chat_group_message` VALUES (24, 1, 2, 'test', NULL, '111', 1, '2026-01-31 12:26:58');
INSERT INTO `sys_chat_group_message` VALUES (25, 1, 1, '超级管理员', NULL, 'http://localhost:8080/file/images/2026/01/31/788f706ff0a548c0a4b744de208e73a5.jpg', 2, '2026-01-31 12:27:03');
INSERT INTO `sys_chat_group_message` VALUES (26, 1, 1, '超级管理员', NULL, '😊', 1, '2026-01-31 12:29:07');
INSERT INTO `sys_chat_group_message` VALUES (27, 1, 2, 'test', NULL, '22', 1, '2026-01-31 12:29:17');
INSERT INTO `sys_chat_group_message` VALUES (28, 1, 2, 'test', NULL, '22', 1, '2026-01-31 12:29:24');
INSERT INTO `sys_chat_group_message` VALUES (29, 1, 1, '超级管理员', NULL, '22222', 1, '2026-01-31 12:38:58');
INSERT INTO `sys_chat_group_message` VALUES (30, 1, 2, 'test', NULL, '哈哈哈', 1, '2026-01-31 12:39:05');
INSERT INTO `sys_chat_group_message` VALUES (31, 1, 1, '超级管理员', NULL, '牛逼啊', 1, '2026-01-31 12:39:10');
INSERT INTO `sys_chat_group_message` VALUES (32, 1, 2, 'test', NULL, '111', 1, '2026-01-31 12:39:26');
INSERT INTO `sys_chat_group_message` VALUES (33, 2, 0, '系统消息', NULL, '超级管理员 创建了群聊', 4, '2026-01-31 12:42:48');
INSERT INTO `sys_chat_group_message` VALUES (34, 2, 1, '超级管理员', NULL, '1111', 1, '2026-01-31 12:42:51');
INSERT INTO `sys_chat_group_message` VALUES (35, 2, 2, 'test', NULL, '牛逼啊', 1, '2026-01-31 12:43:00');
INSERT INTO `sys_chat_group_message` VALUES (36, 2, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:43:03');
INSERT INTO `sys_chat_group_message` VALUES (37, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:43:04');
INSERT INTO `sys_chat_group_message` VALUES (38, 2, 2, 'test', NULL, '2', 1, '2026-01-31 12:43:05');
INSERT INTO `sys_chat_group_message` VALUES (39, 2, 2, 'test', NULL, '1', 1, '2026-01-31 12:43:05');
INSERT INTO `sys_chat_group_message` VALUES (40, 2, 2, 'test', NULL, '21', 1, '2026-01-31 12:43:05');
INSERT INTO `sys_chat_group_message` VALUES (41, 2, 2, 'test', NULL, '2', 1, '2026-01-31 12:43:05');
INSERT INTO `sys_chat_group_message` VALUES (42, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:43:05');
INSERT INTO `sys_chat_group_message` VALUES (43, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:43:07');
INSERT INTO `sys_chat_group_message` VALUES (44, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:43:07');
INSERT INTO `sys_chat_group_message` VALUES (45, 2, 1, '超级管理员', NULL, '3', 1, '2026-01-31 12:43:07');
INSERT INTO `sys_chat_group_message` VALUES (46, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:43:07');
INSERT INTO `sys_chat_group_message` VALUES (47, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:43:07');
INSERT INTO `sys_chat_group_message` VALUES (48, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:43:08');
INSERT INTO `sys_chat_group_message` VALUES (49, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:43:08');
INSERT INTO `sys_chat_group_message` VALUES (50, 2, 2, 'test', NULL, '1', 1, '2026-01-31 12:43:09');
INSERT INTO `sys_chat_group_message` VALUES (51, 2, 2, 'test', NULL, '21', 1, '2026-01-31 12:43:09');
INSERT INTO `sys_chat_group_message` VALUES (52, 2, 2, 'test', NULL, '2', 1, '2026-01-31 12:43:09');
INSERT INTO `sys_chat_group_message` VALUES (53, 2, 2, 'test', NULL, '1', 1, '2026-01-31 12:43:09');
INSERT INTO `sys_chat_group_message` VALUES (54, 2, 2, 'test', NULL, '3', 1, '2026-01-31 12:43:10');
INSERT INTO `sys_chat_group_message` VALUES (55, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:43:10');
INSERT INTO `sys_chat_group_message` VALUES (56, 2, 1, '超级管理员', NULL, '可以的', 1, '2026-01-31 12:43:29');
INSERT INTO `sys_chat_group_message` VALUES (57, 2, 2, 'test', NULL, '好用的额', 1, '2026-01-31 12:43:32');
INSERT INTO `sys_chat_group_message` VALUES (58, 2, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:44:53');
INSERT INTO `sys_chat_group_message` VALUES (59, 2, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:45:00');
INSERT INTO `sys_chat_group_message` VALUES (60, 2, 1, '超级管理员', NULL, '222', 1, '2026-01-31 12:45:13');
INSERT INTO `sys_chat_group_message` VALUES (61, 2, 2, 'test', NULL, '111', 1, '2026-01-31 12:51:12');
INSERT INTO `sys_chat_group_message` VALUES (62, 2, 1, '超级管理员', NULL, '1111111', 1, '2026-01-31 12:51:16');
INSERT INTO `sys_chat_group_message` VALUES (63, 2, 2, 'test', NULL, '66666666', 1, '2026-01-31 12:51:20');
INSERT INTO `sys_chat_group_message` VALUES (64, 2, 1, '超级管理员', NULL, '111', 1, '2026-01-31 12:52:08');
INSERT INTO `sys_chat_group_message` VALUES (65, 2, 1, '超级管理员', NULL, '212', 1, '2026-01-31 12:52:09');
INSERT INTO `sys_chat_group_message` VALUES (66, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:52:09');
INSERT INTO `sys_chat_group_message` VALUES (67, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:52:09');
INSERT INTO `sys_chat_group_message` VALUES (68, 2, 1, '超级管理员', NULL, '21', 1, '2026-01-31 12:52:10');
INSERT INTO `sys_chat_group_message` VALUES (69, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:52:10');
INSERT INTO `sys_chat_group_message` VALUES (70, 2, 1, '超级管理员', NULL, '1111111111', 1, '2026-01-31 12:52:26');
INSERT INTO `sys_chat_group_message` VALUES (71, 2, 1, '超级管理员', NULL, '222', 1, '2026-01-31 12:52:30');
INSERT INTO `sys_chat_group_message` VALUES (72, 2, 1, '超级管理员', NULL, '111111111', 1, '2026-01-31 12:53:21');
INSERT INTO `sys_chat_group_message` VALUES (73, 2, 1, '超级管理员', NULL, '1212', 1, '2026-01-31 12:53:23');
INSERT INTO `sys_chat_group_message` VALUES (74, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:23');
INSERT INTO `sys_chat_group_message` VALUES (75, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:24');
INSERT INTO `sys_chat_group_message` VALUES (76, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:53:24');
INSERT INTO `sys_chat_group_message` VALUES (77, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:24');
INSERT INTO `sys_chat_group_message` VALUES (78, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:25');
INSERT INTO `sys_chat_group_message` VALUES (79, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:53:25');
INSERT INTO `sys_chat_group_message` VALUES (80, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (81, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (82, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (83, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (84, 2, 1, '超级管理员', NULL, '21', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (85, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:26');
INSERT INTO `sys_chat_group_message` VALUES (86, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:27');
INSERT INTO `sys_chat_group_message` VALUES (87, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:27');
INSERT INTO `sys_chat_group_message` VALUES (88, 2, 1, '超级管理员', NULL, '1', 1, '2026-01-31 12:53:27');
INSERT INTO `sys_chat_group_message` VALUES (89, 2, 1, '超级管理员', NULL, '2', 1, '2026-01-31 12:53:27');
INSERT INTO `sys_chat_group_message` VALUES (90, 2, 1, '超级管理员', NULL, '12', 1, '2026-01-31 12:53:27');
INSERT INTO `sys_chat_group_message` VALUES (91, 2, 2, 'test', NULL, '1212', 1, '2026-01-31 12:53:30');
INSERT INTO `sys_chat_group_message` VALUES (92, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:53:31');
INSERT INTO `sys_chat_group_message` VALUES (93, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:53:31');
INSERT INTO `sys_chat_group_message` VALUES (94, 2, 2, 'test', NULL, '12', 1, '2026-01-31 12:53:31');
INSERT INTO `sys_chat_group_message` VALUES (95, 2, 3, 'mars', NULL, '111', 1, '2026-01-31 13:54:46');
INSERT INTO `sys_chat_group_message` VALUES (96, 2, 3, 'mars', NULL, '11', 1, '2026-01-31 13:54:48');
INSERT INTO `sys_chat_group_message` VALUES (97, 2, 3, 'mars', NULL, '12', 1, '2026-01-31 13:54:49');
INSERT INTO `sys_chat_group_message` VALUES (98, 2, 3, 'mars', NULL, '12', 1, '2026-01-31 13:54:49');
INSERT INTO `sys_chat_group_message` VALUES (99, 2, 3, 'mars', NULL, '1', 1, '2026-01-31 13:54:49');
INSERT INTO `sys_chat_group_message` VALUES (100, 3, 0, '系统消息', NULL, '超级管理员 创建了群聊', 4, '2026-01-31 23:20:06');
INSERT INTO `sys_chat_group_message` VALUES (101, 3, 1, '超级管理员', NULL, '1111', 1, '2026-01-31 23:20:08');
INSERT INTO `sys_chat_group_message` VALUES (102, 3, 4, 'lisi', NULL, 'hahah', 1, '2026-01-31 23:20:20');
INSERT INTO `sys_chat_group_message` VALUES (103, 3, 4, 'lisi', NULL, '111', 1, '2026-01-31 23:20:28');
INSERT INTO `sys_chat_group_message` VALUES (104, 3, 1, '超级管理员', NULL, '牛逼的', 1, '2026-01-31 23:20:34');
INSERT INTO `sys_chat_group_message` VALUES (105, 3, 4, 'lisi', NULL, '11212', 1, '2026-01-31 23:20:37');
INSERT INTO `sys_chat_group_message` VALUES (106, 3, 4, 'lisi', NULL, '1', 1, '2026-01-31 23:20:37');
INSERT INTO `sys_chat_group_message` VALUES (107, 3, 4, 'lisi', NULL, '12', 1, '2026-01-31 23:20:37');
INSERT INTO `sys_chat_group_message` VALUES (108, 3, 4, 'lisi', NULL, '1', 1, '2026-01-31 23:20:37');
INSERT INTO `sys_chat_group_message` VALUES (109, 2, 1, '超级管理员', NULL, '哈哈哈', 1, '2026-02-07 09:54:05');
INSERT INTO `sys_chat_group_message` VALUES (110, 2, 3, 'mars', NULL, '有点东西', 1, '2026-02-07 09:54:17');

-- ----------------------------
-- Table structure for `sys_chat_message`
-- ----------------------------
DROP TABLE IF EXISTS `sys_chat_message`;
CREATE TABLE `sys_chat_message`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '消息ID',
`sender_id` bigint NOT NULL COMMENT '发送者ID',
`sender_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '发送者名称',
`sender_avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '发送者头像',
`receiver_id` bigint NOT NULL COMMENT '接收者ID(0表示群发)',
`content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '消息内容',
`msg_type` tinyint NULL DEFAULT 1 COMMENT '消息类型(1文本 2图片 3文件)',
`is_read` tinyint NULL DEFAULT 0 COMMENT '是否已读(0未读 1已读)',
`send_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_sender_id`(`sender_id` ASC) USING BTREE,
  INDEX `idx_receiver_id`(`receiver_id` ASC) USING BTREE,
  INDEX `idx_send_time`(`send_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 504 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '聊天消息表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_chat_message
-- ----------------------------
INSERT INTO `sys_chat_message` VALUES (137, 1, '超级管理员', NULL, 3, '111', 1, 1, '2026-01-31 11:09:21');
INSERT INTO `sys_chat_message` VALUES (216, 1, '超级管理员', NULL, 2, '111', 1, 1, '2026-01-31 12:50:28');
INSERT INTO `sys_chat_message` VALUES (217, 2, 'test', NULL, 1, '1111', 1, 1, '2026-01-31 12:50:35');
INSERT INTO `sys_chat_message` VALUES (218, 2, 'test', NULL, 1, '222', 1, 1, '2026-01-31 12:50:39');
INSERT INTO `sys_chat_message` VALUES (219, 1, '超级管理员', NULL, 2, '1111', 1, 1, '2026-01-31 12:50:41');
INSERT INTO `sys_chat_message` VALUES (220, 1, '超级管理员', NULL, 2, '222', 1, 1, '2026-01-31 12:50:46');
INSERT INTO `sys_chat_message` VALUES (221, 1, '超级管理员', NULL, 2, '222', 1, 1, '2026-01-31 12:51:07');
INSERT INTO `sys_chat_message` VALUES (222, 2, 'test', NULL, 1, '2222222222', 1, 1, '2026-01-31 12:53:37');
INSERT INTO `sys_chat_message` VALUES (223, 1, '超级管理员', NULL, 2, '哈哈哈', 1, 1, '2026-01-31 12:53:44');
INSERT INTO `sys_chat_message` VALUES (224, 1, '超级管理员', NULL, 2, '牛逼的', 1, 1, '2026-01-31 12:53:45');
INSERT INTO `sys_chat_message` VALUES (225, 2, 'test', NULL, 1, '哈哈哈', 1, 1, '2026-01-31 12:54:24');
INSERT INTO `sys_chat_message` VALUES (226, 2, 'test', NULL, 1, '牛逼的额啊', 1, 1, '2026-01-31 12:54:26');
INSERT INTO `sys_chat_message` VALUES (227, 1, '超级管理员', NULL, 2, '11', 1, 1, '2026-01-31 12:55:04');
INSERT INTO `sys_chat_message` VALUES (228, 2, 'test', NULL, 1, '111', 1, 1, '2026-01-31 13:48:21');
INSERT INTO `sys_chat_message` VALUES (229, 1, '超级管理员', NULL, 2, '1212', 1, 1, '2026-01-31 13:48:25');
INSERT INTO `sys_chat_message` VALUES (230, 1, '超级管理员', NULL, 2, '1212', 1, 1, '2026-01-31 13:48:37');
INSERT INTO `sys_chat_message` VALUES (231, 2, 'test', NULL, 1, '222', 1, 1, '2026-01-31 13:49:04');
INSERT INTO `sys_chat_message` VALUES (232, 1, '超级管理员', NULL, 2, '1111111', 1, 1, '2026-01-31 13:49:07');
INSERT INTO `sys_chat_message` VALUES (233, 2, 'test', NULL, 1, '121', 1, 1, '2026-01-31 13:49:08');
INSERT INTO `sys_chat_message` VALUES (234, 1, '超级管理员', NULL, 2, '1111111', 1, 1, '2026-01-31 13:49:11');
INSERT INTO `sys_chat_message` VALUES (235, 2, 'test', NULL, 1, '222', 1, 1, '2026-01-31 13:49:12');
INSERT INTO `sys_chat_message` VALUES (236, 1, '超级管理员', NULL, 2, '222222222222', 1, 1, '2026-01-31 13:49:14');
INSERT INTO `sys_chat_message` VALUES (237, 2, 'test', NULL, 1, '11111', 1, 1, '2026-01-31 13:52:30');
INSERT INTO `sys_chat_message` VALUES (238, 1, '超级管理员', NULL, 2, '111', 1, 1, '2026-01-31 13:52:37');
INSERT INTO `sys_chat_message` VALUES (239, 1, '超级管理员', NULL, 2, '22222222222', 1, 1, '2026-01-31 13:52:52');
INSERT INTO `sys_chat_message` VALUES (240, 2, 'test', NULL, 1, '牛逼的', 1, 1, '2026-01-31 13:52:55');
INSERT INTO `sys_chat_message` VALUES (241, 1, '超级管理员', NULL, 2, '哈哈哈', 1, 1, '2026-01-31 13:52:58');
INSERT INTO `sys_chat_message` VALUES (242, 3, 'mars', NULL, 1, '222', 1, 1, '2026-01-31 13:54:24');
INSERT INTO `sys_chat_message` VALUES (243, 3, 'mars', NULL, 2, '1111', 1, 1, '2026-01-31 13:54:27');
INSERT INTO `sys_chat_message` VALUES (244, 1, '超级管理员', NULL, 3, 'nihao', 1, 1, '2026-01-31 13:54:35');
INSERT INTO `sys_chat_message` VALUES (245, 1, '超级管理员', NULL, 3, '11', 1, 1, '2026-01-31 13:55:37');
INSERT INTO `sys_chat_message` VALUES (246, 3, 'mars', NULL, 1, '1212', 1, 1, '2026-01-31 13:55:45');
INSERT INTO `sys_chat_message` VALUES (247, 1, '超级管理员', NULL, 2, '111', 1, 1, '2026-01-31 13:57:32');
INSERT INTO `sys_chat_message` VALUES (248, 1, '超级管理员', NULL, 2, '111', 1, 1, '2026-01-31 13:57:41');
INSERT INTO `sys_chat_message` VALUES (249, 2, 'test', NULL, 1, '1212', 1, 1, '2026-01-31 13:57:52');
INSERT INTO `sys_chat_message` VALUES (250, 1, '超级管理员', NULL, 2, '2222', 1, 1, '2026-01-31 13:57:55');
INSERT INTO `sys_chat_message` VALUES (251, 2, 'test', NULL, 1, '222', 1, 1, '2026-01-31 14:00:09');
INSERT INTO `sys_chat_message` VALUES (252, 2, 'test', NULL, 1, '1212', 1, 1, '2026-01-31 14:00:18');
INSERT INTO `sys_chat_message` VALUES (253, 2, 'test', NULL, 1, '2222222', 1, 1, '2026-01-31 14:00:21');
INSERT INTO `sys_chat_message` VALUES (254, 2, 'test', NULL, 1, '111111111111111111111', 1, 1, '2026-01-31 14:00:25');
INSERT INTO `sys_chat_message` VALUES (255, 1, '超级管理员', NULL, 2, '22222222222', 1, 1, '2026-01-31 14:00:30');
INSERT INTO `sys_chat_message` VALUES (256, 1, '超级管理员', NULL, 2, '1111111111111', 1, 0, '2026-01-31 14:00:38');
INSERT INTO `sys_chat_message` VALUES (257, 1, '超级管理员', NULL, 2, '1212', 1, 0, '2026-01-31 14:00:41');
INSERT INTO `sys_chat_message` VALUES (258, 1, '超级管理员', NULL, 2, '121312', 1, 0, '2026-01-31 14:00:43');
INSERT INTO `sys_chat_message` VALUES (259, 1, '超级管理员', NULL, 2, '121212', 1, 0, '2026-01-31 14:00:47');
INSERT INTO `sys_chat_message` VALUES (260, 1, '超级管理员', NULL, 2, '121', 1, 0, '2026-01-31 14:00:47');
INSERT INTO `sys_chat_message` VALUES (261, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:47');
INSERT INTO `sys_chat_message` VALUES (262, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:48');
INSERT INTO `sys_chat_message` VALUES (263, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:48');
INSERT INTO `sys_chat_message` VALUES (264, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:48');
INSERT INTO `sys_chat_message` VALUES (265, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:48');
INSERT INTO `sys_chat_message` VALUES (266, 1, '超级管理员', NULL, 2, '21', 1, 0, '2026-01-31 14:00:48');
INSERT INTO `sys_chat_message` VALUES (267, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (268, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (269, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (270, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (271, 1, '超级管理员', NULL, 2, '21', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (272, 1, '超级管理员', NULL, 2, '3', 1, 0, '2026-01-31 14:00:49');
INSERT INTO `sys_chat_message` VALUES (273, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:50');
INSERT INTO `sys_chat_message` VALUES (274, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:50');
INSERT INTO `sys_chat_message` VALUES (275, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:50');
INSERT INTO `sys_chat_message` VALUES (276, 1, '超级管理员', NULL, 2, '21', 1, 0, '2026-01-31 14:00:50');
INSERT INTO `sys_chat_message` VALUES (277, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:50');
INSERT INTO `sys_chat_message` VALUES (278, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:51');
INSERT INTO `sys_chat_message` VALUES (279, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:51');
INSERT INTO `sys_chat_message` VALUES (280, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:51');
INSERT INTO `sys_chat_message` VALUES (281, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:51');
INSERT INTO `sys_chat_message` VALUES (282, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:51');
INSERT INTO `sys_chat_message` VALUES (283, 1, '超级管理员', NULL, 2, '3', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (284, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (285, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (286, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (287, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (288, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:52');
INSERT INTO `sys_chat_message` VALUES (289, 1, '超级管理员', NULL, 2, '121', 1, 0, '2026-01-31 14:00:53');
INSERT INTO `sys_chat_message` VALUES (290, 1, '超级管理员', NULL, 2, '3', 1, 0, '2026-01-31 14:00:53');
INSERT INTO `sys_chat_message` VALUES (291, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:53');
INSERT INTO `sys_chat_message` VALUES (292, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:53');
INSERT INTO `sys_chat_message` VALUES (293, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:54');
INSERT INTO `sys_chat_message` VALUES (294, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:54');
INSERT INTO `sys_chat_message` VALUES (295, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:54');
INSERT INTO `sys_chat_message` VALUES (296, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:54');
INSERT INTO `sys_chat_message` VALUES (297, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:54');
INSERT INTO `sys_chat_message` VALUES (298, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (299, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (300, 1, '超级管理员', NULL, 2, '21', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (301, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (302, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (303, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:55');
INSERT INTO `sys_chat_message` VALUES (304, 1, '超级管理员', NULL, 2, '13', 1, 0, '2026-01-31 14:00:56');
INSERT INTO `sys_chat_message` VALUES (305, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:56');
INSERT INTO `sys_chat_message` VALUES (306, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:56');
INSERT INTO `sys_chat_message` VALUES (307, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:56');
INSERT INTO `sys_chat_message` VALUES (308, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:56');
INSERT INTO `sys_chat_message` VALUES (309, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:57');
INSERT INTO `sys_chat_message` VALUES (310, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:57');
INSERT INTO `sys_chat_message` VALUES (311, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:57');
INSERT INTO `sys_chat_message` VALUES (312, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:57');
INSERT INTO `sys_chat_message` VALUES (313, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:58');
INSERT INTO `sys_chat_message` VALUES (314, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:58');
INSERT INTO `sys_chat_message` VALUES (315, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:58');
INSERT INTO `sys_chat_message` VALUES (316, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:00:58');
INSERT INTO `sys_chat_message` VALUES (317, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:59');
INSERT INTO `sys_chat_message` VALUES (318, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:59');
INSERT INTO `sys_chat_message` VALUES (319, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:00:59');
INSERT INTO `sys_chat_message` VALUES (320, 1, '超级管理员', NULL, 2, '31', 1, 0, '2026-01-31 14:00:59');
INSERT INTO `sys_chat_message` VALUES (321, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:00:59');
INSERT INTO `sys_chat_message` VALUES (322, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:01:00');
INSERT INTO `sys_chat_message` VALUES (323, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:00');
INSERT INTO `sys_chat_message` VALUES (324, 1, '超级管理员', NULL, 2, '3', 1, 0, '2026-01-31 14:01:00');
INSERT INTO `sys_chat_message` VALUES (325, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:00');
INSERT INTO `sys_chat_message` VALUES (326, 1, '超级管理员', NULL, 2, '21', 1, 0, '2026-01-31 14:01:00');
INSERT INTO `sys_chat_message` VALUES (327, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:01:01');
INSERT INTO `sys_chat_message` VALUES (328, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:01:03');
INSERT INTO `sys_chat_message` VALUES (329, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:03');
INSERT INTO `sys_chat_message` VALUES (330, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:04');
INSERT INTO `sys_chat_message` VALUES (331, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-01-31 14:01:04');
INSERT INTO `sys_chat_message` VALUES (332, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:04');
INSERT INTO `sys_chat_message` VALUES (333, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-01-31 14:01:04');
INSERT INTO `sys_chat_message` VALUES (334, 1, '超级管理员', NULL, 2, '3', 1, 0, '2026-01-31 14:01:04');
INSERT INTO `sys_chat_message` VALUES (335, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-01-31 14:01:05');
INSERT INTO `sys_chat_message` VALUES (336, 1, '超级管理员', NULL, 2, '121', 1, 0, '2026-01-31 14:01:05');
INSERT INTO `sys_chat_message` VALUES (337, 1, '超级管理员', NULL, 2, '111', 1, 0, '2026-01-31 14:08:18');
INSERT INTO `sys_chat_message` VALUES (338, 1, '超级管理员', NULL, 2, '1212', 1, 0, '2026-01-31 14:24:15');
INSERT INTO `sys_chat_message` VALUES (339, 1, '超级管理员', NULL, 2, '1212', 1, 0, '2026-01-31 14:25:30');
INSERT INTO `sys_chat_message` VALUES (340, 1, '超级管理员', NULL, 3, '111', 1, 1, '2026-01-31 14:31:43');
INSERT INTO `sys_chat_message` VALUES (341, 3, 'mars', NULL, 1, '222', 1, 1, '2026-01-31 14:31:48');
INSERT INTO `sys_chat_message` VALUES (342, 1, '超级管理员', NULL, 2, '你好', 1, 0, '2026-01-31 20:48:31');
INSERT INTO `sys_chat_message` VALUES (343, 1, '超级管理员', NULL, 4, '11', 1, 1, '2026-01-31 21:37:40');
INSERT INTO `sys_chat_message` VALUES (344, 4, 'lisi', NULL, 1, 'nihao', 1, 1, '2026-01-31 21:37:46');
INSERT INTO `sys_chat_message` VALUES (345, 5, 'mars666', NULL, 2, '1212', 1, 0, '2026-01-31 22:31:32');
INSERT INTO `sys_chat_message` VALUES (346, 5, 'mars666', NULL, 1, '11', 1, 1, '2026-01-31 22:32:42');
INSERT INTO `sys_chat_message` VALUES (347, 1, '超级管理员', NULL, 4, '111', 1, 1, '2026-01-31 22:54:12');
INSERT INTO `sys_chat_message` VALUES (348, 1, '超级管理员', NULL, 4, '111', 1, 1, '2026-01-31 23:19:38');
INSERT INTO `sys_chat_message` VALUES (349, 1, '超级管理员', NULL, 4, '稍等，我确认一下', 1, 1, '2026-01-31 23:19:48');
INSERT INTO `sys_chat_message` VALUES (350, 1, '超级管理员', NULL, 4, '感谢你的反馈', 1, 1, '2026-01-31 23:19:52');
INSERT INTO `sys_chat_message` VALUES (351, 1, '超级管理员', NULL, 2, 'hahah', 1, 0, '2026-02-03 09:03:27');
INSERT INTO `sys_chat_message` VALUES (352, 1, '超级管理员', NULL, 2, '你好', 1, 0, '2026-02-03 09:03:29');
INSERT INTO `sys_chat_message` VALUES (353, 1, '超级管理员', NULL, 2, '你好', 1, 0, '2026-02-07 09:53:11');
INSERT INTO `sys_chat_message` VALUES (354, 3, 'mars', NULL, 1, '1', 1, 1, '2026-02-07 09:53:42');
INSERT INTO `sys_chat_message` VALUES (355, 3, 'mars', NULL, 1, '11', 1, 1, '2026-02-07 09:53:43');
INSERT INTO `sys_chat_message` VALUES (356, 3, 'mars', NULL, 1, '2', 1, 1, '2026-02-07 09:53:44');
INSERT INTO `sys_chat_message` VALUES (357, 3, 'mars', NULL, 1, '12', 1, 1, '2026-02-07 09:53:50');
INSERT INTO `sys_chat_message` VALUES (358, 3, 'mars', NULL, 1, '13', 1, 1, '2026-02-07 09:53:50');
INSERT INTO `sys_chat_message` VALUES (359, 3, 'mars', NULL, 1, '12', 1, 1, '2026-02-07 09:53:51');
INSERT INTO `sys_chat_message` VALUES (360, 3, 'mars', NULL, 1, '3', 1, 1, '2026-02-07 09:53:51');
INSERT INTO `sys_chat_message` VALUES (361, 3, 'mars', NULL, 1, '12', 1, 1, '2026-02-07 09:53:51');
INSERT INTO `sys_chat_message` VALUES (362, 3, 'mars', NULL, 1, '3', 1, 1, '2026-02-07 09:53:52');
INSERT INTO `sys_chat_message` VALUES (363, 3, 'mars', NULL, 1, '1', 1, 1, '2026-02-07 09:53:52');
INSERT INTO `sys_chat_message` VALUES (364, 3, 'mars', NULL, 1, '2', 1, 1, '2026-02-07 09:53:52');
INSERT INTO `sys_chat_message` VALUES (365, 3, 'mars', NULL, 1, '1', 1, 1, '2026-02-07 09:53:52');
INSERT INTO `sys_chat_message` VALUES (366, 1, '超级管理员', NULL, 3, '222', 1, 1, '2026-02-07 09:53:56');
INSERT INTO `sys_chat_message` VALUES (367, 1, '超级管理员', NULL, 3, '22', 1, 1, '2026-02-07 22:16:53');
INSERT INTO `sys_chat_message` VALUES (368, 1, '超级管理员', NULL, 3, '12', 1, 1, '2026-02-07 22:16:53');
INSERT INTO `sys_chat_message` VALUES (369, 3, 'mars', NULL, 1, 'hahha', 1, 1, '2026-02-07 22:17:46');
INSERT INTO `sys_chat_message` VALUES (370, 1, '超级管理员', NULL, 3, '1', 1, 1, '2026-02-07 22:17:54');
INSERT INTO `sys_chat_message` VALUES (371, 1, '超级管理员', NULL, 3, '11', 1, 1, '2026-02-07 22:17:55');
INSERT INTO `sys_chat_message` VALUES (372, 3, 'mars', NULL, 1, '有点东西啊', 1, 1, '2026-02-07 22:18:07');
INSERT INTO `sys_chat_message` VALUES (373, 1, '超级管理员', NULL, 7, '111', 1, 0, '2026-02-08 14:46:57');
INSERT INTO `sys_chat_message` VALUES (374, 1, '超级管理员', NULL, 7, '222', 1, 0, '2026-02-08 14:47:09');
INSERT INTO `sys_chat_message` VALUES (375, 1, '超级管理员', NULL, 7, '222', 1, 0, '2026-02-08 14:49:30');
INSERT INTO `sys_chat_message` VALUES (376, 1, '超级管理员', NULL, 7, '222', 1, 0, '2026-02-08 14:55:04');
INSERT INTO `sys_chat_message` VALUES (377, 1, '超级管理员', NULL, 10, '111', 1, 1, '2026-02-08 17:24:04');
INSERT INTO `sys_chat_message` VALUES (378, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 17:24:16');
INSERT INTO `sys_chat_message` VALUES (379, 1, '超级管理员', NULL, 10, 'hahah', 1, 1, '2026-02-08 17:24:20');
INSERT INTO `sys_chat_message` VALUES (380, 1, '超级管理员', NULL, 10, '牛逼啊', 1, 1, '2026-02-08 17:24:25');
INSERT INTO `sys_chat_message` VALUES (381, 10, 'Mars', 'Zev+JAmwlem/Y8N5.X6N4DTKdz36zGco2W8Manbj77m9ul7TSvZyidbZVTm0VaX3cRc1bYlVtd4aF6xAgp7NLzMa5gUZtSbq3WbfQF64DbryX2gCjdQ5jctIsee8QluGv', 1, '你好', 1, 1, '2026-02-08 17:24:31');
INSERT INTO `sys_chat_message` VALUES (382, 10, 'Mars', 'Zev+JAmwlem/Y8N5.X6N4DTKdz36zGco2W8Manbj77m9ul7TSvZyidbZVTm0VaX3cRc1bYlVtd4aF6xAgp7NLzMa5gUZtSbq3WbfQF64DbryX2gCjdQ5jctIsee8QluGv', 1, '有点东西啊', 1, 1, '2026-02-08 17:24:39');
INSERT INTO `sys_chat_message` VALUES (383, 1, '超级管理员', NULL, 10, '11', 1, 1, '2026-02-08 17:24:44');
INSERT INTO `sys_chat_message` VALUES (384, 1, '超级管理员', NULL, 10, '哈哈哈', 1, 1, '2026-02-08 17:24:46');
INSERT INTO `sys_chat_message` VALUES (385, 1, '超级管理员', NULL, 10, '没我内天的', 1, 1, '2026-02-08 17:24:47');
INSERT INTO `sys_chat_message` VALUES (386, 1, '超级管理员', NULL, 10, '没问题啊', 1, 1, '2026-02-08 17:24:50');
INSERT INTO `sys_chat_message` VALUES (387, 1, '超级管理员', NULL, 10, '111', 1, 1, '2026-02-08 17:25:19');
INSERT INTO `sys_chat_message` VALUES (388, 1, '超级管理员', NULL, 10, '哈哈哈', 1, 1, '2026-02-08 17:25:22');
INSERT INTO `sys_chat_message` VALUES (389, 1, '超级管理员', NULL, 10, 'u屁懂啊吗动漫行', 1, 1, '2026-02-08 17:25:25');
INSERT INTO `sys_chat_message` VALUES (390, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:25:27');
INSERT INTO `sys_chat_message` VALUES (391, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:25:27');
INSERT INTO `sys_chat_message` VALUES (392, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:25:27');
INSERT INTO `sys_chat_message` VALUES (393, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:25:27');
INSERT INTO `sys_chat_message` VALUES (394, 1, '超级管理员', NULL, 10, '212', 1, 1, '2026-02-08 17:25:29');
INSERT INTO `sys_chat_message` VALUES (395, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:25:30');
INSERT INTO `sys_chat_message` VALUES (396, 1, '超级管理员', NULL, 10, '131', 1, 1, '2026-02-08 17:25:30');
INSERT INTO `sys_chat_message` VALUES (397, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:25:31');
INSERT INTO `sys_chat_message` VALUES (398, 1, '超级管理员', NULL, 10, '123123', 1, 1, '2026-02-08 17:25:32');
INSERT INTO `sys_chat_message` VALUES (399, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:25:32');
INSERT INTO `sys_chat_message` VALUES (400, 10, 'Mars', 'Zev+JAmwlem/Y8N5.X6N4DTKdz36zGco2W8Manbj77m9ul7TSvZyidbZVTm0VaX3cRc1bYlVtd4aF6xAgp7NLzMa5gUZtSbq3WbfQF64DbryX2gCjdQ5jctIsee8QluGv', 1, '哈哈哈', 1, 1, '2026-02-08 17:25:38');
INSERT INTO `sys_chat_message` VALUES (401, 10, 'Mars', 'Zev+JAmwlem/Y8N5.X6N4DTKdz36zGco2W8Manbj77m9ul7TSvZyidbZVTm0VaX3cRc1bYlVtd4aF6xAgp7NLzMa5gUZtSbq3WbfQF64DbryX2gCjdQ5jctIsee8QluGv', 1, '12', 1, 1, '2026-02-08 17:25:41');
INSERT INTO `sys_chat_message` VALUES (402, 10, 'Mars', 'Zev+JAmwlem/Y8N5.X6N4DTKdz36zGco2W8Manbj77m9ul7TSvZyidbZVTm0VaX3cRc1bYlVtd4aF6xAgp7NLzMa5gUZtSbq3WbfQF64DbryX2gCjdQ5jctIsee8QluGv', 1, '11', 1, 1, '2026-02-08 17:25:44');
INSERT INTO `sys_chat_message` VALUES (403, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:27:22');
INSERT INTO `sys_chat_message` VALUES (404, 1, '超级管理员', NULL, 10, '111', 1, 1, '2026-02-08 17:27:25');
INSERT INTO `sys_chat_message` VALUES (405, 1, '超级管理员', NULL, 10, '212', 1, 1, '2026-02-08 17:27:26');
INSERT INTO `sys_chat_message` VALUES (406, 1, '超级管理员', NULL, 10, '112', 1, 1, '2026-02-08 17:27:35');
INSERT INTO `sys_chat_message` VALUES (407, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:23');
INSERT INTO `sys_chat_message` VALUES (408, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:25');
INSERT INTO `sys_chat_message` VALUES (409, 1, '超级管理员', NULL, 10, '3', 1, 1, '2026-02-08 17:30:25');
INSERT INTO `sys_chat_message` VALUES (410, 1, '超级管理员', NULL, 10, '21', 1, 1, '2026-02-08 17:30:26');
INSERT INTO `sys_chat_message` VALUES (411, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:30:27');
INSERT INTO `sys_chat_message` VALUES (412, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:27');
INSERT INTO `sys_chat_message` VALUES (413, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:30:27');
INSERT INTO `sys_chat_message` VALUES (414, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:28');
INSERT INTO `sys_chat_message` VALUES (415, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:28');
INSERT INTO `sys_chat_message` VALUES (416, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:28');
INSERT INTO `sys_chat_message` VALUES (417, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:28');
INSERT INTO `sys_chat_message` VALUES (418, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:28');
INSERT INTO `sys_chat_message` VALUES (419, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:29');
INSERT INTO `sys_chat_message` VALUES (420, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:29');
INSERT INTO `sys_chat_message` VALUES (421, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:29');
INSERT INTO `sys_chat_message` VALUES (422, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:29');
INSERT INTO `sys_chat_message` VALUES (423, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:29');
INSERT INTO `sys_chat_message` VALUES (424, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:30:30');
INSERT INTO `sys_chat_message` VALUES (425, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:30:31');
INSERT INTO `sys_chat_message` VALUES (426, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:31:22');
INSERT INTO `sys_chat_message` VALUES (427, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:31:24');
INSERT INTO `sys_chat_message` VALUES (428, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:31:25');
INSERT INTO `sys_chat_message` VALUES (429, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '哈哈哈', 1, 1, '2026-02-08 17:34:12');
INSERT INTO `sys_chat_message` VALUES (430, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '有点东西', 1, 1, '2026-02-08 17:34:14');
INSERT INTO `sys_chat_message` VALUES (431, 1, '超级管理员', NULL, 10, '22', 1, 1, '2026-02-08 17:38:17');
INSERT INTO `sys_chat_message` VALUES (432, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '111', 1, 1, '2026-02-08 17:46:43');
INSERT INTO `sys_chat_message` VALUES (433, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '22', 1, 1, '2026-02-08 17:46:52');
INSERT INTO `sys_chat_message` VALUES (434, 1, '超级管理员', NULL, 10, '22', 1, 1, '2026-02-08 17:49:30');
INSERT INTO `sys_chat_message` VALUES (435, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 17:52:00');
INSERT INTO `sys_chat_message` VALUES (436, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:52:01');
INSERT INTO `sys_chat_message` VALUES (437, 1, '超级管理员', NULL, 10, '13', 1, 1, '2026-02-08 17:52:02');
INSERT INTO `sys_chat_message` VALUES (438, 1, '超级管理员', NULL, 10, '22', 1, 1, '2026-02-08 17:54:26');
INSERT INTO `sys_chat_message` VALUES (439, 1, '超级管理员', NULL, 10, '哈哈哈', 1, 1, '2026-02-08 17:54:29');
INSERT INTO `sys_chat_message` VALUES (440, 1, '超级管理员', NULL, 10, '有点东西', 1, 1, '2026-02-08 17:54:31');
INSERT INTO `sys_chat_message` VALUES (441, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '牛逼的', 1, 1, '2026-02-08 17:54:39');
INSERT INTO `sys_chat_message` VALUES (442, 1, '超级管理员', NULL, 10, '哈哈哈', 1, 1, '2026-02-08 17:54:43');
INSERT INTO `sys_chat_message` VALUES (443, 1, '超级管理员', NULL, 10, '你好', 1, 1, '2026-02-08 17:54:47');
INSERT INTO `sys_chat_message` VALUES (444, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 17:55:01');
INSERT INTO `sys_chat_message` VALUES (445, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 17:55:03');
INSERT INTO `sys_chat_message` VALUES (446, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:55:04');
INSERT INTO `sys_chat_message` VALUES (447, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:55:04');
INSERT INTO `sys_chat_message` VALUES (448, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:55:04');
INSERT INTO `sys_chat_message` VALUES (449, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:55:04');
INSERT INTO `sys_chat_message` VALUES (450, 1, '超级管理员', NULL, 10, '111', 1, 1, '2026-02-08 17:55:08');
INSERT INTO `sys_chat_message` VALUES (451, 1, '超级管理员', NULL, 10, '11', 1, 1, '2026-02-08 17:55:15');
INSERT INTO `sys_chat_message` VALUES (452, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '111', 1, 1, '2026-02-08 17:55:21');
INSERT INTO `sys_chat_message` VALUES (453, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 17:55:25');
INSERT INTO `sys_chat_message` VALUES (454, 1, '超级管理员', NULL, 10, '33', 1, 1, '2026-02-08 17:55:26');
INSERT INTO `sys_chat_message` VALUES (455, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 17:55:27');
INSERT INTO `sys_chat_message` VALUES (456, 10, 'Mars', 'http://localhost:8080/api/files/images/2026/02/08/fdc1626199204477ae2093aeedc7aec8.jpeg', 1, '11', 1, 1, '2026-02-08 17:55:31');
INSERT INTO `sys_chat_message` VALUES (457, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 17:55:35');
INSERT INTO `sys_chat_message` VALUES (458, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 18:03:07');
INSERT INTO `sys_chat_message` VALUES (459, 1, '超级管理员', NULL, 10, '111', 1, 1, '2026-02-08 18:03:15');
INSERT INTO `sys_chat_message` VALUES (460, 1, '超级管理员', NULL, 10, '222', 1, 1, '2026-02-08 18:05:16');
INSERT INTO `sys_chat_message` VALUES (461, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 18:05:19');
INSERT INTO `sys_chat_message` VALUES (462, 1, '超级管理员', NULL, 10, '121', 1, 1, '2026-02-08 18:05:20');
INSERT INTO `sys_chat_message` VALUES (463, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '哈哈哈', 1, 1, '2026-02-08 18:05:26');
INSERT INTO `sys_chat_message` VALUES (464, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '牛逼', 1, 1, '2026-02-08 18:05:36');
INSERT INTO `sys_chat_message` VALUES (465, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '🤗🤗🤔🤔🤔', 1, 1, '2026-02-08 18:05:39');
INSERT INTO `sys_chat_message` VALUES (466, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '李敏', 1, 1, '2026-02-08 18:05:44');
INSERT INTO `sys_chat_message` VALUES (467, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '啊哈哈哈', 1, 1, '2026-02-08 18:05:50');
INSERT INTO `sys_chat_message` VALUES (468, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '有点东西', 1, 1, '2026-02-08 18:05:58');
INSERT INTO `sys_chat_message` VALUES (469, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '牛逼', 1, 1, '2026-02-08 18:06:12');
INSERT INTO `sys_chat_message` VALUES (470, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '啊哈哈', 1, 1, '2026-02-08 18:06:25');
INSERT INTO `sys_chat_message` VALUES (471, 1, '超级管理员', NULL, 10, '212', 1, 1, '2026-02-08 18:06:29');
INSERT INTO `sys_chat_message` VALUES (472, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 18:06:31');
INSERT INTO `sys_chat_message` VALUES (473, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 18:06:31');
INSERT INTO `sys_chat_message` VALUES (474, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 18:06:31');
INSERT INTO `sys_chat_message` VALUES (475, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 18:06:31');
INSERT INTO `sys_chat_message` VALUES (476, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (477, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (478, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (479, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (480, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (481, 1, '超级管理员', NULL, 10, '1', 1, 1, '2026-02-08 18:06:32');
INSERT INTO `sys_chat_message` VALUES (482, 1, '超级管理员', NULL, 10, '2', 1, 1, '2026-02-08 18:06:33');
INSERT INTO `sys_chat_message` VALUES (483, 1, '超级管理员', NULL, 10, '12', 1, 1, '2026-02-08 18:06:33');
INSERT INTO `sys_chat_message` VALUES (484, 10, 'Mars', 'http://m8e8f9e2.natappfree.ccUwFJO7qRoTLVK2Dd.d4QaPhYpq2qtueEW3UevAMTiKfwtL/i8tzAcwK04/RUiPB1q5AS3pUmjxEcMIGGO6yLhVb8hZESA0pDM1ipQ0YIQS3+HAy8D333uNbXXb3rYz0Y=', 1, '哈哈哈', 1, 1, '2026-02-08 18:06:37');
INSERT INTO `sys_chat_message` VALUES (485, 4, 'lisi', NULL, 1, '111', 1, 1, '2026-02-09 12:57:56');
INSERT INTO `sys_chat_message` VALUES (486, 4, 'lisi', NULL, 1, '111', 1, 1, '2026-02-09 12:58:07');
INSERT INTO `sys_chat_message` VALUES (487, 11, 'mars02', NULL, 1, '111', 1, 1, '2026-02-10 20:52:21');
INSERT INTO `sys_chat_message` VALUES (488, 1, '超级管理员', NULL, 11, '22', 1, 1, '2026-02-10 20:52:30');
INSERT INTO `sys_chat_message` VALUES (489, 11, 'mars02', NULL, 1, '111', 1, 1, '2026-02-10 20:52:34');
INSERT INTO `sys_chat_message` VALUES (490, 11, 'mars02', NULL, 1, '😊😍🥰🤨', 1, 1, '2026-02-10 20:52:38');
INSERT INTO `sys_chat_message` VALUES (491, 11, 'mars02', NULL, 1, '稍等，我确认一下', 1, 1, '2026-02-10 20:52:40');
INSERT INTO `sys_chat_message` VALUES (492, 1, '超级管理员', NULL, 11, '111', 1, 1, '2026-02-10 20:52:49');
INSERT INTO `sys_chat_message` VALUES (493, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-02-24 14:32:58');
INSERT INTO `sys_chat_message` VALUES (494, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-02-24 14:32:59');
INSERT INTO `sys_chat_message` VALUES (495, 1, '超级管理员', NULL, 2, '12', 1, 0, '2026-02-24 14:32:59');
INSERT INTO `sys_chat_message` VALUES (496, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-02-24 14:32:59');
INSERT INTO `sys_chat_message` VALUES (497, 1, '超级管理员', NULL, 2, '2', 1, 0, '2026-02-24 14:32:59');
INSERT INTO `sys_chat_message` VALUES (498, 1, '超级管理员', NULL, 2, '1', 1, 0, '2026-02-24 14:32:59');
INSERT INTO `sys_chat_message` VALUES (499, 1, '超级管理员', NULL, 2, '哈哈哈', 1, 0, '2026-02-24 14:33:02');
INSERT INTO `sys_chat_message` VALUES (500, 1, '超级管理员', NULL, 2, '牛逼的', 1, 0, '2026-02-24 14:33:05');
INSERT INTO `sys_chat_message` VALUES (501, 1, '超级管理员', NULL, 5, '111', 1, 0, '2026-02-25 12:19:32');
INSERT INTO `sys_chat_message` VALUES (502, 1, '超级管理员', NULL, 5, 'hahah', 1, 0, '2026-02-25 12:19:34');
INSERT INTO `sys_chat_message` VALUES (503, 1, '超级管理员', NULL, 5, '牛逼啊', 1, 0, '2026-02-25 12:19:37');

-- ----------------------------
-- Table structure for `sys_config_group`
-- ----------------------------
DROP TABLE IF EXISTS `sys_config_group`;
CREATE TABLE `sys_config_group`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`group_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分组编码',
`group_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分组名称',
`group_icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '分组图标',
`config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '配置值(JSON格式)',
`sort` int NULL DEFAULT 0 COMMENT '排序',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-禁用 1-启用)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_group_code`(`group_code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 17 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统配置分组表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_config_group
-- ----------------------------
INSERT INTO `sys_config_group` VALUES (1, 'system', '系统配置', NULL, '{\"siteName\":\"Mars-Admin\",\"siteDescription\":\"现代化企业级管理系统\",\"siteLogo\":\"\",\"copyright\":\"版权所有 © 成都火星网络科技有限公司 2025-2030\",\"icp\":\"\",\"watermarkEnabled\":true,\"watermarkType\":\"username\",\"watermarkCustomText\":\"\",\"watermarkOpacity\":0.05}', 1, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 14:38:29');
INSERT INTO `sys_config_group` VALUES (2, 'register', '注册配置', NULL, '{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":true}', 2, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 14:38:29');
INSERT INTO `sys_config_group` VALUES (3, 'login', '登录配置', NULL, '{\"captchaEnabled\":true,\"captchaType\":\"image\",\"maxRetryCount\":5,\"lockTime\":30,\"rememberMe\":true,\"singleLogin\":false}', 3, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 15:38:39');
INSERT INTO `sys_config_group` VALUES (4, 'password', '密码配置', NULL, '{\"minLength\":6,\"maxLength\":20,\"requireUppercase\":false,\"requireLowercase\":false,\"requireNumber\":false,\"requireSpecial\":false,\"expireDays\":0}', 4, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 14:38:29');
INSERT INTO `sys_config_group` VALUES (5, 'email', '邮件配置', NULL, '{\"host\":\"smtp.qq.com\",\"port\":465,\"username\":\"__REDACTED__\",\"password\":\"__REDACTED__\",\"fromName\":\"Mars管理系统\",\"ssl\":true,\"enabled\":true}', 5, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 22:13:14');
INSERT INTO `sys_config_group` VALUES (6, 'emailTemplate', '邮件模板', NULL, '{\"verifyCode\":\"您的验证码是：{code}，有效期{expire}分钟。\",\"resetPassword\":\"您正在重置密码，验证码：{code}，有效期{expire}分钟。\",\"welcome\":\"欢迎注册{siteName}，您的账号已创建成功。\"}', 6, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 14:38:29');
INSERT INTO `sys_config_group` VALUES (7, 'sms', '短信配置', NULL, '{\"provider\":\"aliyun\",\"accessKeyId\":\"__REDACTED__\",\"accessKeySecret\":\"__REDACTED__\",\"signName\":\"__REDACTED__\",\"tencentAppId\":\"\",\"templateVerifyCode\":\"SMS_225366344\",\"templateResetPassword\":\"\",\"templateNotice\":\"\",\"enabled\":true}', 7, 1, NULL, '2026-01-31 14:38:29', '2026-02-13 13:52:21');
INSERT INTO `sys_config_group` VALUES (9, 'storage', '文件配置', NULL, '{\"provider\":\"local\",\"domain\":\"https://mars-1259757313.cos.ap-guangzhou.myqcloud.com\",\"localPath\":\"./uploads\",\"maxSize\":100,\"allowTypes\":\"jpg,jpeg,png,gif,webp,bmp,ico,svg,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,csv,xml,json,yaml,yml,html,htm,css,js,ts,vue,java,py,go,sql,sh,bat,mp4,avi,mov,wmv,flv,mkv,webm,mp3,wav,ogg,flac,aac,zip,rar,7z,tar,gz,apk,exe,dmg\",\"minioEndpoint\":\"\",\"minioAccessKey\":\"__REDACTED__\",\"minioSecretKey\":\"__REDACTED__\",\"minioBucket\":\"\",\"aliyunEndpoint\":\"https://oss-cn-beijing.aliyuncs.com\",\"aliyunAccessKey\":\"__REDACTED__\",\"aliyunSecretKey\":\"__REDACTED__\",\"aliyunBucket\":\"test\",\"tencentSecretId\":\"__REDACTED__\",\"tencentSecretKey\":\"__REDACTED__\",\"tencentBucket\":\"111\",\"tencentRegion\":\"ap-guangzhou\",\"rustfsEndpoint\":\"\",\"rustfsAccessKey\":\"__REDACTED__\",\"rustfsSecretKey\":\"__REDACTED__\",\"rustfsBucket\":\"\"}', 9, 1, NULL, '2026-01-31 14:38:29', '2026-02-02 17:02:01');
INSERT INTO `sys_config_group` VALUES (10, 'push', '推送配置', NULL, '{\"dingtalk\":{\"signName\":\"__REDACTED__\",\"tokenId\":\"__REDACTED__\"},\"feishu\":{\"signName\":\"__REDACTED__\",\"tokenId\":\"__REDACTED__\"},\"wechat_work\":{\"signName\":\"\",\"tokenId\":\"\"}}', 10, 1, NULL, '2026-01-31 14:38:29', '2026-02-13 13:53:13');
INSERT INTO `sys_config_group` VALUES (11, 'thirdParty', '第三方配置', NULL, '{\"wechat\":{\"enabled\":false,\"appId\":\"\",\"appSecret\":\"\"},\"alipay\":{\"enabled\":false,\"appId\":\"\",\"privateKey\":\"\",\"publicKey\":\"\"},\"github\":{\"enabled\":false,\"clientId\":\"\",\"clientSecret\":\"\"}}', 11, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 14:38:29');
INSERT INTO `sys_config_group` VALUES (12, 'payment', '支付配置', NULL, '{\r\n    \"wechatPay\": {\r\n        \"enabled\": true,\r\n        \"mchId\": \"1627500294\",\r\n        \"appId\": \"wxe97894ad8c7ef7e0\",\r\n        \"apiKey\": \"\",\r\n        \"apiV3Key\": \"lxpvkwojpnxafnoutgqowbecdwdsmpwq\",\r\n        \"privateKey\": \"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlGsA4SciJOYYq\\nTL+/hYlaRLkkJ060c+2MrOl7egozzwddhNLHRC0wasgGdQdbDI39mAm34I7mLdMV\\nlv10dgtKXgpQBHc9QPKy3bPFcgFrz7rxS0YcFrqmzzB69a0LVVfAsZE2SD/4yKc3\\nVFW8cLKQZKRYYm3gZGwN0rsJFVU3dfWgOaoNlBkc5bNIbY7j4aHeW7tJXOQCiig6\\nKj+Dh7r1/POzTciCfqVB1Vjf+VkFMuF6oyKLxMBzFzxvXCGw3PySL6HuY1g5xI7j\\nbNi+xfqtzxZEQAv1QjbfBjzygQXeLCpsuYGVFRRVdyNYxkV90FDVI8swLXpMh65b\\nYNgBGtn1AgMBAAECggEBAKlIx+mPk07aI2mUBkcU+7WofAjbxosN8eP1TBxBw9Ie\\nUnnmj/xPQvi4ng4vYP0E3NIaCmxE0DICgCs+ww7Pvm336LTRZ+3p1KsXqCLnp2cr\\nOh3bGfXdUZO6Gj9w0qlCKTInwn2SizpfwTbf6O3xc++/fbQVHs0kRrc8E5mVmr77\\n01aGIJvXxtQPfdn/R2TMBwqiN8pO5igILlDzNAEusXnfSDOp3rYsXwcnCxJqgnVm\\nydlo7JMU2iqRKSD09qeKFgb+Hbr9aJIQdcvjGBSNmF3MsCFgs/XIb47B4xvy2HBN\\nvIBRwBy08fFeih0GE+0IKr0LyAQ8naMjRTD8A6SbPE0CgYEA9HJ+qigfUPsh/Q+u\\nyyoZeIrsR1xoNVcwANwpWnChsic+B3V/D/pWMJxPv9wKRsVt/dc4kVht//j69tS8\\ny3BFoUxSfUuoK5hdhI8osk3wdVFOnrPPs57s2bMcPPF3Rd5iMvcRNqM1IENCpDAR\\n4zlrEqcMpGSNfaSVhFEyo0fvsV8CgYEA7+6gxxkZJD7DwoVUk8w0BJoq7pNUZc43\\nC0uI8EIRCWxSkd5ahruJjreJuFM1IQUmmqFgewdhEIdUjyORwgVQlo469uwqYPQ5\\n8RWMJcQVK8+QEWV/TdywO3P7oEFgFmVlII/h7Janz/ZlOFZ1X8ANVvpenqgeB2j+\\nl1JMVfjnUSsCgYAHmvRT6PGofFe/XtiKW6H1PSVCxx464p6MuEzVEoIFX/EvHDm6\\nzogV9RcKGhd7wjK83hBVfVHWz/FG8rF5BuIztYMvgMYXrSLjt+yFN6WOkNwIVgHV\\nTdGCqG7tennCg7u8aDFx6LwDZ/RP1WsJDcVGDEp5ZuN8ED3SoxAXQmqzswKBgCk3\\nOtM40oLRbVtq//5ro7vup9VX5bWfWQFNtnZfQwH1Y7G/GpnueVDU4omRcZz8f4cs\\nlaBMwjXOqY31NEK6Gv/h6usj4pvJGHL7mpmaN3DRNRRn9RhxAq0T3XPIBzORs2+G\\nh+7WanllADpPT9Zk7WW1mK90fcQUGzfvYUGbglEFAoGARffpCUANEp1oedOyUVRN\\nSKIvSRggxxqMuzSdnm7eGKDmm+kbA8Iig2C0jgcn4vQZpngbhlNsGrb26Bvdh8wE\\nTBtkcxSBjzsFBdE4kSdVqxnZeVezouWixvkxL4ax1xwczS9hyJlunDljsUb2PkwZ\\nBE39glMdpIqGYrpSTM3p6mI=\\n-----END PRIVATE KEY-----\",\r\n        \"certSerialNo\": \"2FD947564972A8536BDD750944C4796CDF3265EB\",\r\n        \"notifyUrl\": \"http://q668fd96.natappfree.cc/api/pay/notify/wechat\"\r\n    },\r\n    \"alipay\": {\r\n        \"enabled\": true,\r\n        \"appId\": \"2021005192689177\",\r\n        \"privateKey\": \"__REDACTED__\",\r\n        \"publicKey\": \"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiwci3m6eLWeR1kgfeWm/F0V1e68VWUyRB4N5mhnxryTHqiLeN8ilxN9Kn/Ute1C9cL3b4hfx3NYk7zt60QWP9ly8QJQOlqd1H7XsG16AlEpsIaN1SrMYWq16nAD6uwvMmK0nTdzhuNIKOfdC2YWyv3AJTWh0nCTddYV2D+eSH/Ui6xkfgK8pFn/X1Q0xjXvuZrsXxF+WTk5mymEy2u4Kp7/rD/lClfNAv68kOHe92iKj1VzhtROrSp5//xuvL2PA7FLMqo5olZpBmda3eMWgnvHNwvaJvHJENN2ubANwMPNkwMkQ7MKLCBI33fzEERxJBACrJCc6lo8t+wq3zDo/uwIDAQAB\",\r\n        \"signType\": \"RSA2\",\r\n        \"charset\": \"UTF-8\",\r\n        \"gatewayUrl\": \"https://openapi.alipay.com/gateway.do\",\r\n        \"notifyUrl\": \"http://q668fd96.natappfree.cc/api/pay/notify/alipay\",\r\n        \"returnUrl\": \"\"\r\n    }\r\n}', 12, 1, NULL, '2026-01-31 14:38:29', '2026-01-31 16:13:21');
INSERT INTO `sys_config_group` VALUES (13, 'security', '安全配置', NULL, '{\"encryptEnabled\":true,\"encryptScope\":\"global\",\"encryptPublicKey\":\"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxwcKZj5Wdozt6+8i9H2WW2eNaNUvI9iyU7Ot2P5XW9MSfTqRTCbv/aVEUOm60SHm7OXFAbuwUeuo6Pu2P7qPffXiqCXBdC1joo7VywNlapnmkwXP6jhuP+oHM31BvG2uInv40LHocUIRbMhREavnw+By7kT3Cq2SmgLBGsRkoIrpAuMBe47n8DjRGq2cvFde/EoChO0uO0AxlTUpfNXatUDGH0NtCEJeECoMBkg4nI0JAPnZETkimurbryPFoAVk5ld/GJg5WruQ1piicy9YgbOhjWnmb6gJ1RUU9xypNeHI/jLQCdjBn4NGQFtD73v36/WFnv4MgFAZV6iKr5kSdQIDAQAB\",\"encryptPrivateKey\":\"__REDACTED__\",\"xssFilter\":true,\"sqlInject\":true,\"disableDevtool\":false,\"tokenName\":\"Authorization\",\"tokenTimeout\":3600,\"tokenActiveTimeout\":86400,\"tokenIsConcurrent\":true,\"tokenIsShare\":true,\"tokenStyle\":\"uuid\",\"tokenIsLog\":false,\"tokenIsReadBody\":false,\"tokenIsReadCookie\":false,\"tokenIsReadHeader\":true,\"tokenIsPrint\":true,\"tokenIsWriteHeader\":false}', 13, 1, NULL, '2026-01-31 14:38:29', '2026-02-07 16:04:06');
INSERT INTO `sys_config_group` VALUES (15, 'wechatMiniProgram', '小程序配置', NULL, '{\"enabled\":true,\"appId\":\"wxe97894ad8c7ef7e0\",\"appSecret\":\"__REDACTED__\"}', 14, 1, '微信小程序登录配置', '2026-02-03 10:48:41', '2026-02-03 10:48:41');
INSERT INTO `sys_config_group` VALUES (16, 'wechatMp', '公众号配置', NULL, '{\"enabled\":true,\"appId\":\"wx12721c4ea1370b36\",\"appSecret\":\"__REDACTED__\",\"token\":\"__REDACTED__\",\"aesKey\":\"__REDACTED__\",\"callbackUrl\":\"https://api.mars-coder.cn/api/wechat/callback\",\"oauthRedirectUrl\":\"http://localhost:3001/login\",\"menuConfig\":\"\"}', 15, 1, '微信公众号配置', '2026-02-03 10:48:41', '2026-02-03 10:48:41');

-- ----------------------------
-- Table structure for `sys_dept`
-- ----------------------------
DROP TABLE IF EXISTS `sys_dept`;
CREATE TABLE `sys_dept`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`parent_id` bigint NULL DEFAULT 0 COMMENT '父部门ID',
`ancestors` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '祖级列表',
`dept_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '部门名称',
`sort` int NULL DEFAULT 0 COMMENT '显示顺序',
`leader` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '负责人',
`phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '联系电话',
`email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '邮箱',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-停用 1-正常)',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '部门表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_dept
-- ----------------------------
INSERT INTO `sys_dept` VALUES (1, 0, '0', '火星网络科技', -2, '管理员', NULL, NULL, 1, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_dept` VALUES (2, 1, '0,1', '技术部', 0, '张三', NULL, NULL, 1, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_dept` VALUES (3, 1, '0,1', '产品部', 1, '李四', NULL, NULL, 1, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_dept` VALUES (4, 1, '0,1', '运营部', 2, '王五', NULL, NULL, 1, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_dept` VALUES (5, 0, '0', '测试', -1, 'lisi', '19999999999', '', 1, '2026-02-10 15:59:43', '2026-02-10 15:59:43', 1, 1, 0);
INSERT INTO `sys_dept` VALUES (6, 5, '0,5', '测试01部门', 1, '11', '22', '2', 1, '2026-02-10 16:10:49', '2026-02-10 16:10:49', 1, 1, 0);
INSERT INTO `sys_dept` VALUES (7, 5, '0,5', '测试02部门', 0, '01', '202', '2', 1, '2026-02-10 16:11:02', '2026-02-10 16:11:02', 1, 1, 0);
INSERT INTO `sys_dept` VALUES (8, 5, '0,5', '测试001', 2, '001', '1', '2', 1, '2026-02-10 16:11:15', '2026-02-10 16:11:15', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_dict_data`
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_data`;
CREATE TABLE `sys_dict_data`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`sort` int NULL DEFAULT 0 COMMENT '字典排序',
`dict_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典标签',
`dict_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典键值',
`dict_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型',
`css_class` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '样式属性',
`list_class` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '表格回显样式',
`is_default` tinyint NULL DEFAULT 0 COMMENT '是否默认(0-否 1-是)',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-停用 1-正常)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '字典数据表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_dict_data
-- ----------------------------
INSERT INTO `sys_dict_data` VALUES (1, 1, '男', '1', 'sys_user_sex', NULL, 'default', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (2, 2, '女', '2', 'sys_user_sex', NULL, 'default', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (3, 3, '未知', '0', 'sys_user_sex', NULL, 'default', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (4, 1, '正常', '1', 'sys_status', NULL, 'success', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (5, 2, '停用', '0', 'sys_status', NULL, 'error', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (6, 1, '是', '1', 'sys_yes_no', NULL, 'success', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (7, 2, '否', '0', 'sys_yes_no', NULL, 'error', 0, 1, NULL, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_data` VALUES (8, 0, 'sex', '1', 'sex', NULL, 'default', 0, 1, '', '2026-01-29 23:21:38', '2026-01-29 23:21:38', 1, 1, 0);
INSERT INTO `sys_dict_data` VALUES (9, 0, '女', '0', 'sex', NULL, 'default', 0, 1, '', '2026-01-29 23:21:58', '2026-01-29 23:21:58', 1, 1, 0);
INSERT INTO `sys_dict_data` VALUES (10, 0, '男', '1', 'gender', NULL, 'default', 0, 1, '', '2026-03-01 11:18:33', '2026-03-01 11:18:33', 1, 1, 0);
INSERT INTO `sys_dict_data` VALUES (11, 0, '女', '2', 'gender', NULL, 'default', 0, 1, '', '2026-03-01 11:18:39', '2026-03-01 11:18:39', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_dict_type`
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict_type`;
CREATE TABLE `sys_dict_type`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`dict_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典名称',
`dict_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '字典类型',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-停用 1-正常)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_dict_type`(`dict_type` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '字典类型表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_dict_type
-- ----------------------------
INSERT INTO `sys_dict_type` VALUES (1, '用户性别', 'sys_user_sex', 1, '用户性别列表', '2026-01-29 22:42:08', '2026-03-01 11:18:09', NULL, 1, 1);
INSERT INTO `sys_dict_type` VALUES (2, '系统状态', 'sys_status', 1, '系统通用状态', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_type` VALUES (3, '是否', 'sys_yes_no', 1, '是否选项', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_dict_type` VALUES (4, '性别', 'sex', 1, '', '2026-01-29 23:21:29', '2026-02-07 15:33:54', 1, 1, 1);
INSERT INTO `sys_dict_type` VALUES (5, '111', '222', 1, '', '2026-02-07 19:42:53', '2026-02-07 23:26:19', 1, 1, 1);
INSERT INTO `sys_dict_type` VALUES (6, '222', '333', 1, '', '2026-02-07 19:43:46', '2026-02-07 23:26:17', 1, 1, 1);
INSERT INTO `sys_dict_type` VALUES (7, '用户性别', 'gender', 1, '', '2026-01-29 22:42:08', '2026-01-29 22:42:08', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_file`
-- ----------------------------
DROP TABLE IF EXISTS `sys_file`;
CREATE TABLE `sys_file`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '文件ID',
`original_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '原始文件名',
`file_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '存储文件名',
`file_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '文件路径',
`url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '文件访问URL',
`file_size` bigint NULL DEFAULT 0 COMMENT '文件大小（字节）',
`file_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '文件类型（MIME类型）',
`file_suffix` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '文件后缀',
`storage_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '存储类型',
`bucket_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '存储桶名称',
`group_id` bigint NULL DEFAULT NULL COMMENT '分组ID',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '备注',
`create_by` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '创建者',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_file_path`(`file_path`(191) ASC) USING BTREE,
  INDEX `idx_storage_type`(`storage_type` ASC) USING BTREE,
  INDEX `idx_create_time`(`create_time` ASC) USING BTREE,
  INDEX `idx_group_id`(`group_id` ASC) USING BTREE,
  INDEX `idx_file_type`(`file_type` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 83 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文件记录表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_file
-- ----------------------------
INSERT INTO `sys_file` VALUES (10, 'FPj0uHDhtvlIgwhfEk0-Lu-bp4Duopj5_GorB8Sxbqe4pKUR4-7HxwbA7VFa8fTK.jpg', '97c4a311e92b409db8eeaa919c2014e6.jpg', '2026/02/02/97c4a311e92b409db8eeaa919c2014e6.jpg', '/api/files/2026/02/02/97c4a311e92b409db8eeaa919c2014e6.jpg', 823196, 'image/jpeg', '.jpg', 'local', '', 1, '', '1', '2026-02-02 16:54:05');
INSERT INTO `sys_file` VALUES (45, 'img_v3_02ui_f0990cef-9f0d-4c6e-bba2-005ed10e088g.jpg', 'e321bfaf05754cb98700459c53fed98a.jpg', '2026/02/09/e321bfaf05754cb98700459c53fed98a.jpg', '/api/files/2026/02/09/e321bfaf05754cb98700459c53fed98a.jpg', 101083, 'image/jpeg', '.jpg', 'local', '', 1, '', '1', '2026-02-09 16:52:03');
INSERT INTO `sys_file` VALUES (48, 'img_v3_02t8_80c939c9-3e79-4c59-b10c-1716a88818ag.jpg', 'be55af87595046cdb2834cc611a81f30.jpg', '2026/02/09/be55af87595046cdb2834cc611a81f30.jpg', '/api/files/2026/02/09/be55af87595046cdb2834cc611a81f30.jpg', 108824, 'image/jpeg', '.jpg', 'local', '', 1, '', '1', '2026-02-09 16:54:07');
INSERT INTO `sys_file` VALUES (74, 'FPj0uHDhtvlIgwhfEk0-Lu-bp4Duopj5_GorB8Sxbqe4pKUR4-7HxwbA7VFa8fTK.jpg', '09f3e8016cf94b3ab30bb9457d6a1e9a.jpg', '2026/02/24/09f3e8016cf94b3ab30bb9457d6a1e9a.jpg', '/api/files/2026/02/24/09f3e8016cf94b3ab30bb9457d6a1e9a.jpg', 823196, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-02-24 14:18:04');
INSERT INTO `sys_file` VALUES (75, 'caa41ac5c974e4fa96b1df176aeba849.png', 'cea0ee440cbd4b22a9385e58c8f0993c.png', '2026/02/24/cea0ee440cbd4b22a9385e58c8f0993c.png', '/api/files/2026/02/24/cea0ee440cbd4b22a9385e58c8f0993c.png', 16286, 'image/png', '.png', 'local', '', NULL, '', '1', '2026-02-24 14:18:21');
INSERT INTO `sys_file` VALUES (76, 'FPj0uHDhtvlIgwhfEk0-Lu-bp4Duopj5_GorB8Sxbqe4pKUR4-7HxwbA7VFa8fTK.jpg', '4b7ec7ab82f64706a2fe36d913d303ac.jpg', '2026/02/24/4b7ec7ab82f64706a2fe36d913d303ac.jpg', '/api/files/2026/02/24/4b7ec7ab82f64706a2fe36d913d303ac.jpg', 823196, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-02-24 21:52:41');
INSERT INTO `sys_file` VALUES (79, 'default-avatar.jpg', '2a43fbbb30774548a73df204819fdf43.jpg', '2026/02/25/2a43fbbb30774548a73df204819fdf43.jpg', '/api/files/2026/02/25/2a43fbbb30774548a73df204819fdf43.jpg', 22859, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-02-25 16:32:19');
INSERT INTO `sys_file` VALUES (80, 'default-avatar.jpg', '455f90b28929422db2b6beac0174be00.jpg', 'images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg', '/api/files/images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg', 22859, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-03-01 11:29:29');
INSERT INTO `sys_file` VALUES (81, 'default-avatar.jpg', '25d29e831ee3432ebd87a59c7b53fade.jpg', 'images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg', '/api/files/images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg', 22859, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-03-01 12:08:27');
INSERT INTO `sys_file` VALUES (82, 'default-avatar.jpg', '0f6511a67ffb431abf18fa218066d992.jpg', 'images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg', '/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg', 22859, 'image/jpeg', '.jpg', 'local', '', NULL, '', '1', '2026-03-01 12:16:11');

-- ----------------------------
-- Table structure for `sys_file_config`
-- ----------------------------
DROP TABLE IF EXISTS `sys_file_config`;
CREATE TABLE `sys_file_config`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '配置ID',
`name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '配置名称',
`storage_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '存储类型(local/minio/aliyun)',
`master` tinyint NULL DEFAULT 0 COMMENT '是否为主配置(0否 1是)',
`domain` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '访问域名',
`base_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '基础路径(本地存储)',
`bucket_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '存储桶名称',
`access_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '访问密钥',
`secret_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '秘密密钥',
`endpoint` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '端点地址',
`region` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '地域',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0禁用 1启用)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '创建者',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '更新者',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_storage_type`(`storage_type` ASC) USING BTREE,
  INDEX `idx_master`(`master` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文件存储配置表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_file_config
-- ----------------------------
INSERT INTO `sys_file_config` VALUES (1, '本地存储', 'local', 1, 'http://localhost:8080', 'D:/uploads', NULL, NULL, NULL, NULL, NULL, 1, '默认本地存储配置', NULL, '2026-01-30 23:35:08', NULL, '2026-01-30 23:35:08');

-- ----------------------------
-- Table structure for `sys_file_group`
-- ----------------------------
DROP TABLE IF EXISTS `sys_file_group`;
CREATE TABLE `sys_file_group`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '分组ID',
`name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '分组名称',
`sort` int NULL DEFAULT 0 COMMENT '排序',
`create_by` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '创建者',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文件分组表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_file_group
-- ----------------------------
INSERT INTO `sys_file_group` VALUES (1, '测试分组', 0, NULL, '2026-02-02 16:50:50', NULL);

-- ----------------------------
-- Table structure for `sys_job`
-- ----------------------------
DROP TABLE IF EXISTS `sys_job`;
CREATE TABLE `sys_job`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`job_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务名称',
`job_group` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'DEFAULT' COMMENT '任务组名',
`invoke_target` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '调用目标字符串',
`cron_expression` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'cron执行表达式',
`misfire_policy` tinyint NULL DEFAULT 3 COMMENT '计划执行错误策略(1-立即执行 2-执行一次 3-放弃执行)',
`concurrent` tinyint NULL DEFAULT 1 COMMENT '是否并发执行(0-允许 1-禁止)',
`status` tinyint NULL DEFAULT 0 COMMENT '状态(0-暂停 1-正常)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '定时任务表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_job
-- ----------------------------
INSERT INTO `sys_job` VALUES (1, '系统默认（无参）', 'DEFAULT', 'sampleTask.noParams', '0/10 * * * * ?', 3, 1, 0, '无参数的示例任务', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_job` VALUES (2, '系统默认（有参）', 'DEFAULT', 'sampleTask.withParams(\'hello\')', '0/15 * * * * ?', 3, 1, 0, '有参数的示例任务', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_job` VALUES (3, '测试任务', 'DEFAULT', 'sampleTask.noParams', '0/5 * * * * ?', 3, 1, 0, '111', '2026-01-29 22:59:47', '2026-01-29 22:59:47', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_job_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_job_log`;
CREATE TABLE `sys_job_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`job_name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '任务名称',
`job_group` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '任务组名',
`invoke_target` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '调用目标字符串',
`job_message` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '日志信息',
`status` tinyint NULL DEFAULT 0 COMMENT '执行状态(0-正常 1-失败)',
`exception_info` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '异常信息',
`start_time` datetime NULL DEFAULT NULL COMMENT '开始时间',
`stop_time` datetime NULL DEFAULT NULL COMMENT '停止时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 32 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '定时任务日志表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_job_log
-- ----------------------------
INSERT INTO `sys_job_log` VALUES (1, '1', 'DEFAULT', '1', '执行失败', 1, 'java.lang.StringIndexOutOfBoundsException: begin 0, end -1, length 1\r\n	at java.base/java.lang.String.checkBoundsBeginEnd(String.java:4602)\r\n	at java.base/java.lang.String.substring(String.java:2705)\r\n	at com.mars.job.util.JobInvokeUtil.getBeanName(JobInvokeUtil.java:45)\r\n	at com.mars.job.util.JobInvokeUtil.invokeMethod(JobInvokeUtil.java:20)\r\n	at com.mars.job.util.QuartzDisallowConcurrentExecution.doExecute(QuartzDisallowConcurrentExecution.java:15)\r\n	at com.mars.job.util.AbstractQuartzJob.execute(AbstractQuartzJob.java:40)\r\n	at org.quartz.core.JobRunShell.run(JobRunShell.java:202)\r\n	at org.quartz.simpl.SimpleThreadPool$WorkerThread.run(SimpleThreadPool.java:573)\r\n', '2026-01-29 22:59:50', '2026-01-29 22:59:50');
INSERT INTO `sys_job_log` VALUES (2, '1', 'DEFAULT', '1', '执行失败', 1, 'java.lang.StringIndexOutOfBoundsException: begin 0, end -1, length 1\r\n	at java.base/java.lang.String.checkBoundsBeginEnd(String.java:4602)\r\n	at java.base/java.lang.String.substring(String.java:2705)\r\n	at com.mars.job.util.JobInvokeUtil.getBeanName(JobInvokeUtil.java:45)\r\n	at com.mars.job.util.JobInvokeUtil.invokeMethod(JobInvokeUtil.java:20)\r\n	at com.mars.job.util.QuartzDisallowConcurrentExecution.doExecute(QuartzDisallowConcurrentExecution.java:15)\r\n	at com.mars.job.util.AbstractQuartzJob.execute(AbstractQuartzJob.java:40)\r\n	at org.quartz.core.JobRunShell.run(JobRunShell.java:202)\r\n	at org.quartz.simpl.SimpleThreadPool$WorkerThread.run(SimpleThreadPool.java:573)\r\n', '2026-01-29 22:59:55', '2026-01-29 22:59:55');
INSERT INTO `sys_job_log` VALUES (3, '1', 'DEFAULT', '1', '执行失败', 1, 'java.lang.StringIndexOutOfBoundsException: begin 0, end -1, length 1\r\n	at java.base/java.lang.String.checkBoundsBeginEnd(String.java:4602)\r\n	at java.base/java.lang.String.substring(String.java:2705)\r\n	at com.mars.job.util.JobInvokeUtil.getBeanName(JobInvokeUtil.java:45)\r\n	at com.mars.job.util.JobInvokeUtil.invokeMethod(JobInvokeUtil.java:20)\r\n	at com.mars.job.util.QuartzDisallowConcurrentExecution.doExecute(QuartzDisallowConcurrentExecution.java:15)\r\n	at com.mars.job.util.AbstractQuartzJob.execute(AbstractQuartzJob.java:40)\r\n	at org.quartz.core.JobRunShell.run(JobRunShell.java:202)\r\n	at org.quartz.simpl.SimpleThreadPool$WorkerThread.run(SimpleThreadPool.java:573)\r\n', '2026-01-29 23:01:29', '2026-01-29 23:01:29');
INSERT INTO `sys_job_log` VALUES (4, '1', 'DEFAULT', '1', '执行失败', 1, 'java.lang.StringIndexOutOfBoundsException: begin 0, end -1, length 1\r\n	at java.base/java.lang.String.checkBoundsBeginEnd(String.java:4602)\r\n	at java.base/java.lang.String.substring(String.java:2705)\r\n	at com.mars.job.util.JobInvokeUtil.getBeanName(JobInvokeUtil.java:45)\r\n	at com.mars.job.util.JobInvokeUtil.invokeMethod(JobInvokeUtil.java:20)\r\n	at com.mars.job.util.QuartzDisallowConcurrentExecution.doExecute(QuartzDisallowConcurrentExecution.java:15)\r\n	at com.mars.job.util.AbstractQuartzJob.execute(AbstractQuartzJob.java:40)\r\n	at org.quartz.core.JobRunShell.run(JobRunShell.java:202)\r\n	at org.quartz.simpl.SimpleThreadPool$WorkerThread.run(SimpleThreadPool.java:573)\r\n', '2026-01-29 23:01:54', '2026-01-29 23:01:54');
INSERT INTO `sys_job_log` VALUES (5, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-01-29 23:02:57', '2026-01-29 23:02:57');
INSERT INTO `sys_job_log` VALUES (6, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-01-29 23:03:02', '2026-01-29 23:03:02');
INSERT INTO `sys_job_log` VALUES (7, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-01-31 12:33:00', '2026-01-31 12:33:00');
INSERT INTO `sys_job_log` VALUES (8, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-01-31 22:36:20', '2026-01-31 22:36:20');
INSERT INTO `sys_job_log` VALUES (9, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-01-31 22:36:30', '2026-01-31 22:36:30');
INSERT INTO `sys_job_log` VALUES (10, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-07 09:51:50', '2026-02-07 09:51:50');
INSERT INTO `sys_job_log` VALUES (11, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-07 23:54:56', '2026-02-07 23:54:56');
INSERT INTO `sys_job_log` VALUES (12, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-07 23:55:04', '2026-02-07 23:55:04');
INSERT INTO `sys_job_log` VALUES (13, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:25', '2026-02-09 17:04:25');
INSERT INTO `sys_job_log` VALUES (14, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:27', '2026-02-09 17:04:27');
INSERT INTO `sys_job_log` VALUES (15, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:27', '2026-02-09 17:04:27');
INSERT INTO `sys_job_log` VALUES (16, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:27', '2026-02-09 17:04:27');
INSERT INTO `sys_job_log` VALUES (17, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:27', '2026-02-09 17:04:27');
INSERT INTO `sys_job_log` VALUES (18, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:34', '2026-02-09 17:04:34');
INSERT INTO `sys_job_log` VALUES (19, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:35', '2026-02-09 17:04:35');
INSERT INTO `sys_job_log` VALUES (20, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:35', '2026-02-09 17:04:35');
INSERT INTO `sys_job_log` VALUES (21, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:35', '2026-02-09 17:04:35');
INSERT INTO `sys_job_log` VALUES (22, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:35', '2026-02-09 17:04:35');
INSERT INTO `sys_job_log` VALUES (23, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-09 17:04:35', '2026-02-09 17:04:35');
INSERT INTO `sys_job_log` VALUES (24, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-10 16:25:18', '2026-02-10 16:25:18');
INSERT INTO `sys_job_log` VALUES (25, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-13 16:44:42', '2026-02-13 16:44:42');
INSERT INTO `sys_job_log` VALUES (26, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 21:45:30', '2026-02-28 21:45:30');
INSERT INTO `sys_job_log` VALUES (27, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 21:45:35', '2026-02-28 21:45:35');
INSERT INTO `sys_job_log` VALUES (28, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 21:45:40', '2026-02-28 21:45:40');
INSERT INTO `sys_job_log` VALUES (29, '1', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 21:45:45', '2026-02-28 21:45:45');
INSERT INTO `sys_job_log` VALUES (30, '系统默认（无参）', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 21:48:03', '2026-02-28 21:48:03');
INSERT INTO `sys_job_log` VALUES (31, '测试任务', 'DEFAULT', 'sampleTask.noParams', '执行成功', 0, NULL, '2026-02-28 22:03:01', '2026-02-28 22:03:01');

-- ----------------------------
-- Table structure for `sys_login_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_login_log`;
CREATE TABLE `sys_login_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '用户账号',
`ipaddr` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '登录IP地址',
`login_location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '登录地点',
`browser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '浏览器类型',
`os` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '操作系统',
`status` tinyint NULL DEFAULT 0 COMMENT '登录状态(0-成功 1-失败)',
`msg` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '提示消息',
`login_time` datetime NULL DEFAULT NULL COMMENT '登录时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 286 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '登录日志表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_login_log
-- ----------------------------
INSERT INTO `sys_login_log` VALUES (265, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-25 13:48:47');
INSERT INTO `sys_login_log` VALUES (266, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-25 14:32:32');
INSERT INTO `sys_login_log` VALUES (267, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-25 15:32:57');
INSERT INTO `sys_login_log` VALUES (268, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-25 16:09:25');
INSERT INTO `sys_login_log` VALUES (269, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-25 17:04:11');
INSERT INTO `sys_login_log` VALUES (270, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 09:00:42');
INSERT INTO `sys_login_log` VALUES (271, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 09:07:19');
INSERT INTO `sys_login_log` VALUES (272, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 09:07:24');
INSERT INTO `sys_login_log` VALUES (273, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 09:07:37');
INSERT INTO `sys_login_log` VALUES (274, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 09:07:44');
INSERT INTO `sys_login_log` VALUES (275, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 09:07:50');
INSERT INTO `sys_login_log` VALUES (276, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '账号已锁定', '2026-02-28 09:07:57');
INSERT INTO `sys_login_log` VALUES (277, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 09:09:18');
INSERT INTO `sys_login_log` VALUES (278, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 1, '密码错误', '2026-02-28 12:28:37');
INSERT INTO `sys_login_log` VALUES (279, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 12:28:45');
INSERT INTO `sys_login_log` VALUES (280, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 17:09:20');
INSERT INTO `sys_login_log` VALUES (281, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 21:35:19');
INSERT INTO `sys_login_log` VALUES (282, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 22:36:40');
INSERT INTO `sys_login_log` VALUES (283, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-02-28 23:37:44');
INSERT INTO `sys_login_log` VALUES (284, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-03-01 10:44:17');
INSERT INTO `sys_login_log` VALUES (285, 'admin', '127.0.0.1', '内网IP', 'Chrome', 'Windows 10 or Windows Server 2016', 0, '登录成功', '2026-03-01 11:44:58');

-- ----------------------------
-- Table structure for `sys_menu`
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`parent_id` bigint NULL DEFAULT 0 COMMENT '父级ID',
`name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '菜单名称',
`type` tinyint NOT NULL COMMENT '菜单类型(1-目录 2-菜单 3-按钮)',
`path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '路由地址',
`component` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '组件路径',
`permission` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '权限标识',
`icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图标',
`sort` int NULL DEFAULT 0 COMMENT '排序',
`visible` tinyint NULL DEFAULT 1 COMMENT '是否可见(0-隐藏 1-显示)',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-禁用 1-启用)',
`is_frame` tinyint NULL DEFAULT 0 COMMENT '是否外链(0-否 1-是)',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 333 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '菜单表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_menu
-- ----------------------------
INSERT INTO `sys_menu` VALUES (1, 0, '系统管理', 1, '/system', NULL, NULL, 'SettingsOutline', 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (2, 1, '用户管理', 2, '/system/user', '/system/user/index', 'sys:user:list', 'PersonOutline', 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (3, 2, '新增用户', 3, NULL, NULL, 'sys:user:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (4, 2, '编辑用户', 3, NULL, NULL, 'sys:user:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (5, 2, '删除用户', 3, NULL, NULL, 'sys:user:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (6, 1, '角色管理', 2, '/system/role', '/system/role/index', 'sys:role:list', 'PeopleOutline', 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (7, 6, '新增角色', 3, NULL, NULL, 'sys:role:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (8, 6, '编辑角色', 3, NULL, NULL, 'sys:role:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (9, 6, '删除角色', 3, NULL, NULL, 'sys:role:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (10, 1, '菜单管理', 2, '/system/menu', '/system/menu/index', 'sys:menu:list', 'MenuOutline', 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (11, 10, '新增菜单', 3, NULL, NULL, 'sys:menu:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (12, 10, '编辑菜单', 3, NULL, NULL, 'sys:menu:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (13, 10, '删除菜单', 3, NULL, NULL, 'sys:menu:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (14, 1, '字典管理', 2, '/system/dict', '/system/dict/index', 'sys:dict:list', 'BookOutline', 4, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (15, 14, '新增字典', 3, NULL, NULL, 'sys:dict:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (16, 14, '编辑字典', 3, NULL, NULL, 'sys:dict:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (17, 14, '删除字典', 3, NULL, NULL, 'sys:dict:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (18, 1, '系统配置', 2, '/system/config', '/system/config/index', 'sys:config:list', 'SettingsSharp', 5, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (19, 18, '新增配置', 3, NULL, NULL, 'sys:config:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (20, 18, '编辑配置', 3, NULL, NULL, 'sys:config:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (21, 18, '删除配置', 3, NULL, NULL, 'sys:config:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (22, 0, '组织管理', 1, '/org', NULL, NULL, 'BusinessOutline', 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (23, 22, '部门管理', 2, '/org/dept', '/org/dept/index', 'sys:dept:list', 'GitNetworkOutline', 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (24, 23, '新增部门', 3, NULL, NULL, 'sys:dept:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (25, 23, '编辑部门', 3, NULL, NULL, 'sys:dept:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (26, 23, '删除部门', 3, NULL, NULL, 'sys:dept:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (27, 22, '岗位管理', 2, '/org/post', '/org/post/index', 'sys:post:list', 'IdCardOutline', 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (28, 27, '新增岗位', 3, NULL, NULL, 'sys:post:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (29, 27, '编辑岗位', 3, NULL, NULL, 'sys:post:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (30, 27, '删除岗位', 3, NULL, NULL, 'sys:post:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (31, 0, '系统日志', 1, '/log', NULL, NULL, 'DocumentTextOutline', 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (32, 31, '操作日志', 2, '/log/operlog', '/log/operlog/index', 'monitor:operlog:list', 'ListOutline', 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (33, 32, '删除日志', 3, NULL, NULL, 'monitor:operlog:delete', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (34, 31, '登录日志', 2, '/log/loginlog', '/log/loginlog/index', 'monitor:loginlog:list', 'LogInOutline', 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (35, 34, '删除日志', 3, NULL, NULL, 'monitor:loginlog:delete', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (36, 0, '系统监控', 1, '/monitor', NULL, NULL, 'PulseOutline', 4, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (37, 36, '在线用户', 2, '/monitor/online', '/monitor/online/index', 'monitor:online:list', 'PeopleCircleOutline', 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (38, 37, '强退用户', 3, NULL, NULL, 'monitor:online:forceLogout', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (39, 36, '定时任务', 2, '/monitor/job', '/monitor/job/index', 'monitor:job:list', 'TimerOutline', 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (40, 39, '新增任务', 3, NULL, NULL, 'monitor:job:add', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (41, 39, '编辑任务', 3, NULL, NULL, 'monitor:job:edit', NULL, 2, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (42, 39, '删除任务', 3, NULL, NULL, 'monitor:job:delete', NULL, 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (43, 36, '缓存监控', 2, '/monitor/cache', '/monitor/cache/index', 'monitor:cache:list', 'ServerOutline', 3, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (44, 43, '删除缓存', 3, NULL, NULL, 'monitor:cache:delete', NULL, 1, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (45, 36, '服务监控', 2, '/monitor/server', '/monitor/server/index', 'monitor:server:list', 'DesktopOutline', 4, 1, 1, 0, '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (126, 0, '文件管理', 1, '/file', NULL, NULL, 'FolderOpenOutline', 5, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-30 23:40:01', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (127, 126, '文件列表', 2, '/system/file', '/system/file/index', 'sys:file:list', 'DocumentOutline', 1, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-30 23:40:01', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (128, 127, '上传文件', 3, NULL, NULL, 'sys:file:upload', NULL, 1, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-30 23:40:01', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (129, 127, '删除文件', 3, NULL, NULL, 'sys:file:delete', NULL, 2, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-30 23:40:01', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (130, 126, '文件配置', 2, '/system/file-config', '/system/file-config/index', 'sys:fileConfig:list', 'CloudOutline', 2, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-31 14:43:52', NULL, 1, 1);
INSERT INTO `sys_menu` VALUES (131, 130, '新增配置', 3, NULL, NULL, 'sys:fileConfig:add', NULL, 1, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-31 14:43:45', NULL, 1, 1);
INSERT INTO `sys_menu` VALUES (132, 130, '编辑配置', 3, NULL, NULL, 'sys:fileConfig:edit', NULL, 2, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-31 14:43:47', NULL, 1, 1);
INSERT INTO `sys_menu` VALUES (133, 130, '删除配置', 3, NULL, NULL, 'sys:fileConfig:delete', NULL, 3, 1, 1, 0, '2026-01-30 23:40:01', '2026-01-31 14:43:50', NULL, 1, 1);
INSERT INTO `sys_menu` VALUES (134, 0, '消息中心', 1, '/message', NULL, NULL, 'NotificationsOutline', 6, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (135, 134, '系统通知', 2, '/message/notice', '/message/notice/index', 'sys:notice:list', 'NotificationsOutline', 1, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (136, 135, '新增通知', 3, NULL, NULL, 'sys:notice:add', NULL, 1, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (137, 135, '编辑通知', 3, NULL, NULL, 'sys:notice:edit', NULL, 2, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (138, 135, '删除通知', 3, NULL, NULL, 'sys:notice:delete', NULL, 3, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (139, 134, '即时聊天', 2, '/message/chat', '/message/chat/index', 'sys:chat:list', 'ChatbubbleOutline', 2, 1, 1, 0, '2026-01-30 23:53:55', '2026-01-30 23:53:55', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (140, 0, '测试菜单', 1, '/test', '', '', 'StarOutline', 7, 0, 0, 0, '2026-01-31 20:17:37', '2026-01-31 20:17:37', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (141, 140, '测试菜单', 2, '/test/test', '/test/test/index', '', 'SearchOutline', 0, 1, 1, 0, '2026-01-31 20:23:37', '2026-01-31 20:23:37', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (142, 2, '用户列表', 3, '', '', 'sys:user:list', '', 0, 1, 1, 0, '2026-01-31 20:51:50', '2026-01-31 20:51:50', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (143, 6, '角色列表', 3, '', '', 'sys:role:list', '', 0, 1, 1, 0, '2026-01-31 20:52:13', '2026-01-31 20:52:13', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (144, 10, '菜单列表', 3, '', '', 'sys:menu:list', '', 0, 1, 1, 0, '2026-01-31 20:52:32', '2026-01-31 20:52:32', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (145, 14, '字典列表', 3, '', '', 'sys:dict:list', '', 0, 1, 1, 0, '2026-01-31 20:52:52', '2026-01-31 20:52:52', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (146, 23, '部门列表', 3, '', '', 'sys:dept:list', '', 0, 1, 1, 0, '2026-01-31 20:54:26', '2026-01-31 20:54:26', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (147, 27, '岗位列表', 3, '', '', 'sys:post:list', '', 0, 1, 1, 0, '2026-01-31 20:54:45', '2026-01-31 20:54:45', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (148, 32, '查询日志', 3, '', '', 'monitor:operlog:list', '', 0, 1, 1, 0, '2026-01-31 20:55:14', '2026-01-31 20:55:14', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (149, 34, '日志列表', 3, '', '', 'monitor:loginlog:list', '', 0, 1, 1, 0, '2026-01-31 20:55:32', '2026-01-31 20:55:32', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (150, 37, '在线用户列表', 3, '', '', 'monitor:online:list', '', 0, 1, 1, 0, '2026-01-31 20:56:04', '2026-01-31 20:56:04', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (151, 39, '任务列表', 3, '', '', 'monitor:job:list', '', 0, 1, 1, 0, '2026-01-31 20:56:20', '2026-01-31 20:56:20', 4, 4, 0);
INSERT INTO `sys_menu` VALUES (152, 127, '文件列表', 3, '', '', 'sys:file:list', '', 0, 1, 1, 0, '2026-01-31 20:57:18', '2026-01-31 20:57:18', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (153, 135, '系统通知', 3, '', '', 'sys:notice:list', '', 0, 1, 1, 0, '2026-01-31 20:57:55', '2026-01-31 20:57:55', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (154, 36, '服务器管理', 2, '/monitor/server-manager', '/monitor/server-manager/index', NULL, 'ServerOutline', 5, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, 1, 0);
INSERT INTO `sys_menu` VALUES (155, 154, '服务器列表', 3, NULL, NULL, 'monitor:server:list', NULL, 1, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (156, 154, '服务器详情', 3, NULL, NULL, 'monitor:server:query', NULL, 2, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (157, 154, '新增服务器', 3, NULL, NULL, 'monitor:server:add', NULL, 3, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (158, 154, '编辑服务器', 3, NULL, NULL, 'monitor:server:edit', NULL, 4, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (159, 154, '删除服务器', 3, NULL, NULL, 'monitor:server:remove', NULL, 5, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (160, 154, '测试连接', 3, NULL, NULL, 'monitor:server:test', NULL, 6, 1, 1, 0, '2026-01-31 23:37:21', '2026-01-31 23:37:21', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (161, 0, '开发工具', 1, '', '', '', 'HammerOutline', 99, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:36', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (162, 161, '代码生成', 2, '/tool/gen', '/tool/gen/index', '', 'CodeSlashOutline', 1, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:53:12', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (163, 162, '查询', 3, '', '', 'tool:gen:list', '', 1, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (164, 162, '详情', 3, '', '', 'tool:gen:query', '', 2, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (165, 162, '导入', 3, '', '', 'tool:gen:import', '', 3, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (166, 162, '编辑', 3, '', '', 'tool:gen:edit', '', 4, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (167, 162, '删除', 3, '', '', 'tool:gen:remove', '', 5, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (168, 162, '预览', 3, '', '', 'tool:gen:preview', '', 6, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (169, 162, '生成代码', 3, '', '', 'tool:gen:code', '', 7, 1, 1, 0, '2026-02-02 19:50:38', '2026-02-02 19:52:40', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (170, 1, '客户表', 2, '/system/customer', '/system/customer/index', '', 'ListOutline', 1, 0, 0, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, 1, 0);
INSERT INTO `sys_menu` VALUES (171, 170, '客户表查询', 3, '', '', 'system:customer:list', '', 1, 1, 1, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (172, 170, '客户表详情', 3, '', '', 'system:customer:query', '', 2, 1, 1, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (173, 170, '客户表新增', 3, '', '', 'system:customer:add', '', 3, 1, 1, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (174, 170, '客户表修改', 3, '', '', 'system:customer:edit', '', 4, 1, 1, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (175, 170, '客户表删除', 3, '', '', 'system:customer:remove', '', 5, 1, 1, 0, '2026-02-02 19:57:54', '2026-02-02 19:57:54', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (272, 161, '学生管理', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (273, 272, '学生管理查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (274, 272, '学生管理详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (275, 272, '学生管理新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (276, 272, '学生管理修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (277, 272, '学生管理删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-02-03 08:58:09', '2026-02-09 12:55:57', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (278, 161, '接口文档', 2, '/tool/api-doc', 'https://s.apifox.cn/73166c1b-50fb-47b6-a015-50111f2fbf9e/417351170e0', '', 'DocumentOutline', 0, 1, 1, 1, '2026-02-13 15:18:16', '2026-02-13 15:18:16', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (279, 0, '系统官网', 1, '', 'https://mars-coder.cn', '', 'PlanetOutline', 100, 1, 1, 1, '2026-02-13 15:52:55', '2026-02-13 15:52:55', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (280, 2, '用户导入', 3, '', '', 'sys:user:import', '', 0, 1, 1, 0, '2026-02-25 15:56:46', '2026-02-25 15:56:46', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (281, 2, '用户导出', 3, '', '', 'sys:user:export', '', 0, 1, 1, 0, '2026-02-25 15:57:01', '2026-02-25 15:57:01', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (282, 36, 'SQL监控', 2, '/monitor/druid', '/monitor/druid/index', 'monitor:druid:list', 'PieChartOutline', 4, 1, 1, 0, '2026-02-28 22:30:41', '2026-02-28 22:30:41', NULL, 1, 0);
INSERT INTO `sys_menu` VALUES (283, 36, 'API访问统计', 2, '/monitor/api-access', '/monitor/api-access/index', 'monitor:apiAccess:list', 'StatsChartOutline', 7, 1, 1, 0, '2026-02-28 22:56:30', '2026-02-28 22:56:30', NULL, NULL, 0);
INSERT INTO `sys_menu` VALUES (284, 283, '访问统计列表', 3, '', '', 'monitor:apiAccess:list', '', 0, 1, 1, 0, '2026-02-28 22:58:30', '2026-02-28 22:58:30', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (285, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (286, 285, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (287, 285, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (288, 285, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (289, 285, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (290, 285, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 11:14:06', '2026-03-01 11:16:47', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (291, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (292, 291, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (293, 291, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (294, 291, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (295, 291, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (296, 291, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 11:24:24', '2026-03-01 11:27:48', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (297, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (298, 297, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (299, 297, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (300, 297, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (301, 297, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (302, 297, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 11:27:57', '2026-03-01 11:46:03', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (303, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (304, 303, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (305, 303, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (306, 303, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (307, 303, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (308, 303, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 12:04:47', '2026-03-01 12:06:19', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (309, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (310, 309, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (311, 309, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (312, 309, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (313, 309, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (314, 309, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 12:07:02', '2026-03-01 12:09:32', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (315, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (316, 315, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (317, 315, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (318, 315, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (319, 315, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (320, 315, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 12:09:45', '2026-03-01 12:14:37', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (321, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (322, 321, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (323, 321, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (324, 321, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (325, 321, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (326, 321, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 12:15:15', '2026-03-01 12:20:10', 1, 1, 1);
INSERT INTO `sys_menu` VALUES (327, 161, '学生表', 2, 'system/student', 'system/student/index', 'system:student:list', 'ListOutline', 1, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (328, 327, '学生表查询', 3, NULL, NULL, 'system:student:list', NULL, 1, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (329, 327, '学生表详情', 3, NULL, NULL, 'system:student:query', NULL, 2, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (330, 327, '学生表新增', 3, NULL, NULL, 'system:student:add', NULL, 3, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (331, 327, '学生表修改', 3, NULL, NULL, 'system:student:edit', NULL, 4, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);
INSERT INTO `sys_menu` VALUES (332, 327, '学生表删除', 3, NULL, NULL, 'system:student:remove', NULL, 5, 1, 1, 0, '2026-03-01 12:20:17', '2026-03-01 12:20:17', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_notice`
-- ----------------------------
DROP TABLE IF EXISTS `sys_notice`;
CREATE TABLE `sys_notice`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '通知ID',
`title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '通知标题',
`content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '通知内容',
`notice_type` tinyint NULL DEFAULT 1 COMMENT '通知类型(1通知 2公告)',
`channels` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '[\"station\"]' COMMENT '推送渠道(JSON): station站内信,email邮件,sms短信,webhook飞书/钉钉/企业微信',
`target_type` tinyint NULL DEFAULT 3 COMMENT '推送对象类型(1指定用户 2按部门 3全部)',
`target_ids` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '推送对象ID(JSON): 用户ID或部门ID数组',
`status` tinyint NULL DEFAULT 0 COMMENT '状态(0草稿 1发布)',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建者ID',
`create_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '创建者名称',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_notice_type`(`notice_type` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_create_time`(`create_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 18 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '系统通知表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_notice
-- ----------------------------
INSERT INTO `sys_notice` VALUES (1, '欢迎使用Mars系统', '欢迎使用Mars后台管理系统！这是一条测试通知。', 1, '[\"station\"]', 3, NULL, 1, 1, '超级管理员', '2026-01-30 23:53:55', '2026-01-30 23:53:55', 0);
INSERT INTO `sys_notice` VALUES (2, '12', '11', 1, '[\"station\"]', 3, NULL, 0, 1, '超级管理员', '2026-02-28 21:38:37', '2026-02-28 21:38:40', 1);
INSERT INTO `sys_notice` VALUES (3, '22', '1212', 2, '[\"station\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 21:38:47', '2026-02-28 21:38:57', 1);
INSERT INTO `sys_notice` VALUES (4, '11', '11', 1, '[\"station\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:25:28', '2026-02-28 23:44:14', 1);
INSERT INTO `sys_notice` VALUES (5, '111', '111', 1, '[\"station\",\"webhook\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:26:38', '2026-02-28 23:27:29', 1);
INSERT INTO `sys_notice` VALUES (6, '1111', '222', 1, '[\"station\",\"webhook\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:27:43', '2026-02-28 23:32:02', 1);
INSERT INTO `sys_notice` VALUES (7, '11', '222', 1, '[\"station\",\"webhook\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:28:41', '2026-02-28 23:32:00', 1);
INSERT INTO `sys_notice` VALUES (8, '1212', '22211', 1, '[\"webhook\",\"station\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:32:12', '2026-02-28 23:44:12', 1);
INSERT INTO `sys_notice` VALUES (9, '111', '222', 1, '[\"station\",\"feishu\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:38:00', '2026-02-28 23:44:10', 1);
INSERT INTO `sys_notice` VALUES (10, '1212', '1212', 1, '[\"dingtalk\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:46:38', '2026-03-01 00:12:05', 1);
INSERT INTO `sys_notice` VALUES (11, '1212', '111', 1, '[\"dingtalk\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:47:42', '2026-03-01 00:04:41', 1);
INSERT INTO `sys_notice` VALUES (12, '1212', '22212', 1, '[\"station\",\"dingtalk\",\"feishu\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:57:08', '2026-03-01 00:04:39', 1);
INSERT INTO `sys_notice` VALUES (13, '31212', '1212', 1, '[\"station\",\"email\",\"feishu\",\"dingtalk\"]', 3, NULL, 1, 1, '超级管理员', '2026-02-28 23:57:36', '2026-03-01 00:04:37', 1);
INSERT INTO `sys_notice` VALUES (14, '12', '222', 1, '[\"station\",\"email\",\"dingtalk\",\"feishu\"]', 3, NULL, 1, 1, '超级管理员', '2026-03-01 00:05:01', '2026-03-01 00:12:03', 1);
INSERT INTO `sys_notice` VALUES (15, '12', '1212', 1, '[\"station\",\"email\",\"dingtalk\",\"feishu\"]', 3, NULL, 1, 1, '超级管理员', '2026-03-01 00:10:48', '2026-03-01 00:12:01', 1);
INSERT INTO `sys_notice` VALUES (16, '212', '1111', 1, '[\"station\",\"email\",\"dingtalk\",\"feishu\"]', 1, '[1]', 1, 1, '超级管理员', '2026-03-01 00:11:29', '2026-03-01 00:11:46', 1);
INSERT INTO `sys_notice` VALUES (17, '12', '2222', 1, '[\"station\",\"email\",\"dingtalk\",\"feishu\"]', 1, '[1]', 1, 1, '超级管理员', '2026-03-01 00:12:13', '2026-03-01 00:12:13', 0);

-- ----------------------------
-- Table structure for `sys_notice_send_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_notice_send_log`;
CREATE TABLE `sys_notice_send_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
`notice_id` bigint NOT NULL COMMENT '通知ID',
`channel` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '推送渠道: station站内信,email邮件,dingtalk钉钉,feishu飞书,wechat_work企业微信',
`status` tinyint NOT NULL DEFAULT 1 COMMENT '状态: 1成功 2失败',
`target_count` int NULL DEFAULT 0 COMMENT '推送目标数量',
`success_count` int NULL DEFAULT 0 COMMENT '成功数量(邮件/站内信)',
`error_msg` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '失败原因',
`send_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '推送时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_notice_id`(`notice_id` ASC) USING BTREE,
  INDEX `idx_send_time`(`send_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 19 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '通知推送记录表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_notice_send_log
-- ----------------------------
INSERT INTO `sys_notice_send_log` VALUES (1, 14, 'station', 1, 4, 4, NULL, '2026-03-01 00:05:04');
INSERT INTO `sys_notice_send_log` VALUES (2, 14, 'email', 2, 2, 1, '邮件发送失败: Failed messages: org.eclipse.angus.mail.smtp.SMTPSendFailedException: 550 The recipient may contain a non-existent account, please check the recipient address.\n', '2026-03-01 00:05:06');
INSERT INTO `sys_notice_send_log` VALUES (3, 14, 'dingtalk', 1, 1, 1, NULL, '2026-03-01 00:05:06');
INSERT INTO `sys_notice_send_log` VALUES (4, 14, 'feishu', 1, 1, 1, NULL, '2026-03-01 00:05:07');
INSERT INTO `sys_notice_send_log` VALUES (5, 14, 'email', 2, 2, 1, '邮件发送失败: Failed messages: org.eclipse.angus.mail.smtp.SMTPSendFailedException: 550 The recipient may contain a non-existent account, please check the recipient address.\n', '2026-03-01 00:09:16');
INSERT INTO `sys_notice_send_log` VALUES (6, 14, 'email', 1, 2, 2, NULL, '2026-03-01 00:10:37');
INSERT INTO `sys_notice_send_log` VALUES (7, 15, 'station', 1, 4, 4, NULL, '2026-03-01 00:10:51');
INSERT INTO `sys_notice_send_log` VALUES (8, 15, 'email', 1, 2, 2, NULL, '2026-03-01 00:10:53');
INSERT INTO `sys_notice_send_log` VALUES (9, 15, 'dingtalk', 1, 1, 1, NULL, '2026-03-01 00:10:53');
INSERT INTO `sys_notice_send_log` VALUES (10, 15, 'feishu', 1, 1, 1, NULL, '2026-03-01 00:10:53');
INSERT INTO `sys_notice_send_log` VALUES (11, 16, 'station', 1, 1, 1, NULL, '2026-03-01 00:11:33');
INSERT INTO `sys_notice_send_log` VALUES (12, 16, 'email', 1, 1, 1, NULL, '2026-03-01 00:11:34');
INSERT INTO `sys_notice_send_log` VALUES (13, 16, 'dingtalk', 1, 1, 1, NULL, '2026-03-01 00:11:34');
INSERT INTO `sys_notice_send_log` VALUES (14, 16, 'feishu', 1, 1, 1, NULL, '2026-03-01 00:11:34');
INSERT INTO `sys_notice_send_log` VALUES (15, 17, 'station', 1, 1, 1, NULL, '2026-03-01 00:12:16');
INSERT INTO `sys_notice_send_log` VALUES (16, 17, 'email', 1, 1, 1, NULL, '2026-03-01 00:12:17');
INSERT INTO `sys_notice_send_log` VALUES (17, 17, 'dingtalk', 1, 1, 1, NULL, '2026-03-01 00:12:17');
INSERT INTO `sys_notice_send_log` VALUES (18, 17, 'feishu', 1, 1, 1, NULL, '2026-03-01 00:12:17');

-- ----------------------------
-- Table structure for `sys_oper_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_oper_log`;
CREATE TABLE `sys_oper_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '模块标题',
`business_type` int NULL DEFAULT 0 COMMENT '业务类型(0-其它 1-新增 2-修改 3-删除)',
`method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '方法名称',
`request_method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '请求方式',
`oper_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '操作人员',
`oper_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '请求URL',
`oper_ip` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '主机地址',
`oper_param` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '请求参数',
`json_result` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '返回参数',
`status` int NULL DEFAULT 0 COMMENT '操作状态(0-正常 1-异常)',
`error_msg` varchar(2000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '错误消息',
`oper_time` datetime NULL DEFAULT NULL COMMENT '操作时间',
`cost_time` bigint NULL DEFAULT 0 COMMENT '消耗时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 726 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '操作日志表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_oper_log
-- ----------------------------
INSERT INTO `sys_oper_log` VALUES (611, '菜单管理', 1, 'com.mars.admin.controller.system.SysMenuController.create()', 'POST', 'admin', '/api/sys/menu', '127.0.0.1', '{\"id\":280,\"createTime\":\"2026-02-25 15:56:46\",\"updateTime\":\"2026-02-25 15:56:46\",\"createBy\":1,\"updateBy\":1,\"deleted\":null,\"parentId\":2,\"name\":\"用户导入\",\"type\":3,\"path\":\"\",\"component\":\"\",\"permission\":\"sys:user:import\",\"icon\":\"\",\"sort\":0,\"visible\":1,\"status\":1,\"isFrame\":0,\"children\":null}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 15:56:46', 38);
INSERT INTO `sys_oper_log` VALUES (612, '菜单管理', 1, 'com.mars.admin.controller.system.SysMenuController.create()', 'POST', 'admin', '/api/sys/menu', '127.0.0.1', '{\"id\":281,\"createTime\":\"2026-02-25 15:57:01\",\"updateTime\":\"2026-02-25 15:57:01\",\"createBy\":1,\"updateBy\":1,\"deleted\":null,\"parentId\":2,\"name\":\"用户导出\",\"type\":3,\"path\":\"\",\"component\":\"\",\"permission\":\"sys:user:export\",\"icon\":\"\",\"sort\":0,\"visible\":1,\"status\":1,\"isFrame\":0,\"children\":null}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 15:57:01', 13);
INSERT INTO `sys_oper_log` VALUES (613, '角色管理', 2, 'com.mars.admin.controller.system.SysRoleController.update()', 'PUT', 'admin', '/api/sys/role', '127.0.0.1', '{\"role\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"name\":\"超级管理员\",\"code\":\"admin\",\"sort\":1,\"status\":1,\"dataScope\":1,\"remark\":\"拥有所有权限\"},\"menuIds\":[7,8,9,143,142,3,4,5,144,11,12,13,145,15,16,17,19,20,21,146,24,25,26,147,28,29,30,148,33,149,35,150,38,151,40,41,42,44,45,153,136,137,138,139,141,155,156,157,158,159,160,171,172,173,174,175,152,128,129,278,163,164,165,166,167,168,169,279,170,6,10,14,18,23,27,32,34,37,39,43,154,127,135,162,22,31,36,126,134,140,161,2,280,281,1],\"deptIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 15:57:29', 167);
INSERT INTO `sys_oper_log` VALUES (614, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":0,\"successCount\":1,\"errors\":[]}}', 0, NULL, '2026-02-25 15:57:37', 272);
INSERT INTO `sys_oper_log` VALUES (615, '用户管理', 2, 'com.mars.admin.controller.system.SysUserController.update()', 'PUT', 'admin', '/api/sys/user', '127.0.0.1', '{\"user\":{\"id\":18,\"createTime\":\"2026-02-25 15:57:37\",\"updateTime\":\"2026-02-25 15:57:37\",\"createBy\":1,\"updateBy\":1,\"deleted\":0,\"deptId\":2,\"deptName\":null,\"postNames\":null,\"username\":\"11\",\"password\":null,\"nickname\":\"11\",\"avatar\":null,\"email\":\"111@qq.com\",\"phone\":\"18483689569\",\"gender\":1,\"status\":1,\"remark\":null,\"userType\":\"admin\",\"openId\":null,\"isQuit\":0},\"roleIds\":[2],\"postIds\":[2]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 15:58:01', 22);
INSERT INTO `sys_oper_log` VALUES (616, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":0,\"successCount\":1,\"errors\":[]}}', 0, NULL, '2026-02-25 16:00:18', 118);
INSERT INTO `sys_oper_log` VALUES (617, '用户管理', 3, 'com.mars.admin.controller.system.SysUserController.delete()', 'DELETE', 'admin', '/api/sys/user/19', '127.0.0.1', '19', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 16:13:45', 33);
INSERT INTO `sys_oper_log` VALUES (618, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":1,\"successCount\":0,\"errors\":[\"用户[222]导入失败: \\r\\n### Error updating database.  Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\r\\n### The error may exist in com/mars/system/mapper/SysUserMapper.java (best guess)\\r\\n### The error may involve com.mars.system.mapper.SysUserMapper.insert-Inline\\r\\n### The error occurred while setting parameters\\r\\n### SQL: INSERT INTO sys_user  ( dept_id, username, password, nickname,  email, phone, gender, status,  user_type,  is_quit, create_time, update_time, create_by, update_by, deleted )  VALUES (  ?, ?, ?, ?,  ?, ?, ?, ?,  ?,  ?, ?, ?, ?, ?, ?  )\\r\\n### Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\n; Duplicate entry \'222\' for key \'sys_user.uk_username\'\"]}}', 0, NULL, '2026-02-25 16:13:53', 388);
INSERT INTO `sys_oper_log` VALUES (619, '用户管理', 3, 'com.mars.admin.controller.system.SysUserController.delete()', 'DELETE', 'admin', '/api/sys/user/18', '127.0.0.1', '18', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 16:14:10', 11);
INSERT INTO `sys_oper_log` VALUES (620, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":1,\"successCount\":0,\"errors\":[\"用户[222]导入失败: \\r\\n### Error updating database.  Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\r\\n### The error may exist in com/mars/system/mapper/SysUserMapper.java (best guess)\\r\\n### The error may involve com.mars.system.mapper.SysUserMapper.insert-Inline\\r\\n### The error occurred while setting parameters\\r\\n### SQL: INSERT INTO sys_user  ( dept_id, username, password, nickname,  email, phone, gender, status,  user_type,  is_quit, create_time, update_time, create_by, update_by, deleted )  VALUES (  ?, ?, ?, ?,  ?, ?, ?, ?,  ?,  ?, ?, ?, ?, ?, ?  )\\r\\n### Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\n; Duplicate entry \'222\' for key \'sys_user.uk_username\'\"]}}', 0, NULL, '2026-02-25 16:14:15', 105);
INSERT INTO `sys_oper_log` VALUES (621, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":1,\"successCount\":0,\"errors\":[\"用户[222]导入失败: \\r\\n### Error updating database.  Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\r\\n### The error may exist in com/mars/system/mapper/SysUserMapper.java (best guess)\\r\\n### The error may involve com.mars.system.mapper.SysUserMapper.insert-Inline\\r\\n### The error occurred while setting parameters\\r\\n### SQL: INSERT INTO sys_user  ( dept_id, username, password, nickname,  email, phone, gender, status,  user_type,  is_quit, create_time, update_time, create_by, update_by, deleted )  VALUES (  ?, ?, ?, ?,  ?, ?, ?, ?,  ?,  ?, ?, ?, ?, ?, ?  )\\r\\n### Cause: java.sql.SQLIntegrityConstraintViolationException: Duplicate entry \'222\' for key \'sys_user.uk_username\'\\n; Duplicate entry \'222\' for key \'sys_user.uk_username\'\"]}}', 0, NULL, '2026-02-25 16:14:22', 104);
INSERT INTO `sys_oper_log` VALUES (622, '用户管理', 6, 'com.mars.admin.controller.system.SysUserController.importData()', 'POST', 'admin', '/api/sys/user/import', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"failCount\":0,\"successCount\":1,\"errors\":[]}}', 0, NULL, '2026-02-25 16:16:18', 113);
INSERT INTO `sys_oper_log` VALUES (623, '用户管理', 5, 'com.mars.admin.controller.system.SysUserController.export()', 'GET', 'admin', '/api/sys/user/export', '127.0.0.1', '', NULL, 0, NULL, '2026-02-25 16:16:31', 61);
INSERT INTO `sys_oper_log` VALUES (624, '用户管理', 5, 'com.mars.admin.controller.system.SysUserController.export()', 'GET', 'admin', '/api/sys/user/export', '127.0.0.1', '\"23\"', NULL, 0, NULL, '2026-02-25 16:19:07', 681);
INSERT INTO `sys_oper_log` VALUES (625, '用户管理', 5, 'com.mars.admin.controller.system.SysUserController.export()', 'GET', 'admin', '/api/sys/user/export', '127.0.0.1', '\"23,11,10,13,14,15,16,17,5,4,2,3,1\"', NULL, 0, NULL, '2026-02-25 16:26:42', 710);
INSERT INTO `sys_oper_log` VALUES (626, '用户管理', 5, 'com.mars.admin.controller.system.SysUserController.export()', 'GET', 'admin', '/api/sys/user/export', '127.0.0.1', '', NULL, 0, NULL, '2026-02-25 16:27:06', 89);
INSERT INTO `sys_oper_log` VALUES (627, '用户管理', 3, 'com.mars.admin.controller.system.SysUserController.deleteBatch()', 'DELETE', 'admin', '/api/sys/user/batch', '127.0.0.1', '[23]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 16:28:46', 27);
INSERT INTO `sys_oper_log` VALUES (628, '上传文件', 1, 'com.mars.admin.controller.file.SysFileController.upload()', 'POST', 'admin', '/api/sys/file/upload', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"id\":79,\"originalName\":\"default-avatar.jpg\",\"fileName\":\"2a43fbbb30774548a73df204819fdf43.jpg\",\"filePath\":\"2026/02/25/2a43fbbb30774548a73df204819fdf43.jpg\",\"url\":\"/api/files/2026/02/25/2a43fbbb30774548a73df204819fdf43.jpg\",\"fileSize\":22859,\"fileType\":\"image/jpeg\",\"fileSuffix\":\".jpg\",\"storageType\":\"local\",\"bucketName\":null,\"groupId\":null,\"createBy\":\"1\",\"createTime\":\"2026-02-25 16:32:19\",\"remark\":null}}', 0, NULL, '2026-02-25 16:32:19', 11);
INSERT INTO `sys_oper_log` VALUES (629, '用户管理', 3, 'com.mars.admin.controller.system.SysUserController.deleteBatch()', 'DELETE', 'admin', '/api/sys/user/batch', '127.0.0.1', '[11,13,15,16,17,5,14]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 16:55:31', 61);
INSERT INTO `sys_oper_log` VALUES (630, '用户管理', 2, 'com.mars.admin.controller.system.SysUserController.update()', 'PUT', 'admin', '/api/sys/user', '127.0.0.1', '{\"user\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-02-24 22:02:00\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"deptId\":1,\"deptName\":\"火星网络科技\",\"postNames\":\"董事长\",\"username\":\"admin\",\"password\":null,\"nickname\":\"超级管理员\",\"avatar\":\"\",\"email\":\"111@qq.com\",\"phone\":\"18888888888\",\"gender\":0,\"status\":1,\"remark\":\"111\",\"userType\":\"admin\",\"openId\":null,\"isQuit\":0},\"roleIds\":[1],\"postIds\":[1]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 17:16:41', 31);
INSERT INTO `sys_oper_log` VALUES (631, '用户管理', 2, 'com.mars.admin.controller.system.SysUserController.update()', 'PUT', 'admin', '/api/sys/user', '127.0.0.1', '{\"user\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-02-24 22:02:00\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"deptId\":1,\"deptName\":\"火星网络科技\",\"postNames\":\"董事长\",\"username\":\"admin\",\"password\":null,\"nickname\":\"超级管理员\",\"avatar\":\"\",\"email\":\"111@qq.com\",\"phone\":\"18888888888\",\"gender\":1,\"status\":1,\"remark\":\"111\",\"userType\":\"admin\",\"openId\":null,\"isQuit\":0},\"roleIds\":[1],\"postIds\":[1,2]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-25 17:17:10', 13);
INSERT INTO `sys_oper_log` VALUES (632, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":2,\"title\":\"12\",\"content\":\"11\",\"noticeType\":1,\"status\":0,\"createBy\":1,\"createName\":\"超级管理员\",\"createTime\":\"2026-02-28 21:38:36\",\"updateTime\":null,\"deleted\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 21:38:37', 44);
INSERT INTO `sys_oper_log` VALUES (633, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/2', '127.0.0.1', '2', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 21:38:40', 18);
INSERT INTO `sys_oper_log` VALUES (634, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":3,\"title\":\"22\",\"content\":\"1212\",\"noticeType\":2,\"status\":0,\"createBy\":1,\"createName\":\"超级管理员\",\"createTime\":\"2026-02-28 21:38:46\",\"updateTime\":null,\"deleted\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 21:38:47', 11);
INSERT INTO `sys_oper_log` VALUES (635, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/3/publish', '127.0.0.1', '3', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 21:38:49', 22);
INSERT INTO `sys_oper_log` VALUES (636, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/3', '127.0.0.1', '3', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 21:38:58', 8);
INSERT INTO `sys_oper_log` VALUES (637, '菜单管理', 2, 'com.mars.admin.controller.system.SysMenuController.update()', 'PUT', 'admin', '/api/sys/menu', '127.0.0.1', '{\"id\":282,\"createTime\":\"2026-02-28 22:30:41\",\"updateTime\":\"2026-02-28 22:30:41\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"parentId\":36,\"name\":\"SQL监控\",\"type\":2,\"path\":\"/monitor/druid\",\"component\":\"/monitor/druid/index\",\"permission\":\"monitor:druid:list\",\"icon\":\"PieChartOutline\",\"sort\":4,\"visible\":1,\"status\":1,\"isFrame\":0,\"children\":null}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 22:32:24', 27);
INSERT INTO `sys_oper_log` VALUES (638, '菜单管理', 1, 'com.mars.admin.controller.system.SysMenuController.create()', 'POST', 'admin', '/api/sys/menu', '127.0.0.1', '{\"id\":284,\"createTime\":\"2026-02-28 22:58:29\",\"updateTime\":\"2026-02-28 22:58:29\",\"createBy\":1,\"updateBy\":1,\"deleted\":null,\"parentId\":283,\"name\":\"访问统计列表\",\"type\":3,\"path\":\"\",\"component\":\"\",\"permission\":\"monitor:apiAccess:list\",\"icon\":\"\",\"sort\":0,\"visible\":1,\"status\":1,\"isFrame\":0,\"children\":null}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 22:58:30', 30);
INSERT INTO `sys_oper_log` VALUES (639, '角色管理', 2, 'com.mars.admin.controller.system.SysRoleController.update()', 'PUT', 'admin', '/api/sys/role', '127.0.0.1', '{\"role\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"name\":\"超级管理员\",\"code\":\"admin\",\"sort\":1,\"status\":1,\"dataScope\":1,\"remark\":\"拥有所有权限\"},\"menuIds\":[7,8,9,143,142,3,4,5,144,11,12,13,145,15,16,17,19,20,21,146,24,25,26,147,28,29,30,148,33,149,35,150,38,151,40,41,42,44,45,153,136,137,138,139,141,155,156,157,158,159,160,171,172,173,174,175,152,128,129,278,163,164,165,166,167,168,169,279,280,281,282,2,170,6,10,14,18,23,27,32,34,37,39,43,154,127,135,162,1,22,31,126,134,140,161,36,283,284],\"deptIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 22:58:38', 175);
INSERT INTO `sys_oper_log` VALUES (640, '用户管理', 3, 'com.mars.admin.controller.system.SysUserController.delete()', 'DELETE', 'admin', '/api/sys/user/2', '127.0.0.1', '2', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:02:26', 16);
INSERT INTO `sys_oper_log` VALUES (641, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"11\",\"content\":\"11\",\"noticeType\":1,\"channels\":[\"station\"],\"targetType\":3,\"targetIds\":[],\"status\":1}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:25:28', 40);
INSERT INTO `sys_oper_log` VALUES (642, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"111\",\"content\":\"111\",\"noticeType\":1,\"channels\":[\"station\",\"webhook\"],\"targetType\":3,\"targetIds\":[],\"status\":1}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:26:38', 13);
INSERT INTO `sys_oper_log` VALUES (643, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/5', '127.0.0.1', '5', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:27:29', 72);
INSERT INTO `sys_oper_log` VALUES (644, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"1111\",\"content\":\"222\",\"noticeType\":1,\"channels\":[\"station\",\"webhook\"],\"targetType\":3,\"targetIds\":[],\"status\":1}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:27:43', 30);
INSERT INTO `sys_oper_log` VALUES (645, '修改通知', 2, 'com.mars.admin.controller.message.SysNoticeController.update()', 'PUT', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":6,\"title\":\"1111\",\"content\":\"222\",\"noticeType\":1,\"channels\":[\"station\",\"webhook\"],\"targetType\":3,\"targetIds\":[],\"status\":1}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:28:16', 19);
INSERT INTO `sys_oper_log` VALUES (646, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"11\",\"content\":\"222\",\"noticeType\":1,\"channels\":[\"station\",\"webhook\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:28:41', 21);
INSERT INTO `sys_oper_log` VALUES (647, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/7/publish', '127.0.0.1', '7', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:31:46', 173827);
INSERT INTO `sys_oper_log` VALUES (648, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/7', '127.0.0.1', '7', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:32:00', 9);
INSERT INTO `sys_oper_log` VALUES (649, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/6', '127.0.0.1', '6', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:32:02', 7);
INSERT INTO `sys_oper_log` VALUES (650, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"1212\",\"content\":\"22211\",\"noticeType\":1,\"channels\":[\"webhook\",\"station\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:32:12', 15);
INSERT INTO `sys_oper_log` VALUES (651, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/8/publish', '127.0.0.1', '8', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:32:20', 5142);
INSERT INTO `sys_oper_log` VALUES (652, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"111\",\"content\":\"222\",\"noticeType\":1,\"channels\":[\"station\",\"feishu\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:38:00', 41);
INSERT INTO `sys_oper_log` VALUES (653, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/9/publish', '127.0.0.1', '9', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:38:03', 520);
INSERT INTO `sys_oper_log` VALUES (654, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/9', '127.0.0.1', '9', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:44:10', 57);
INSERT INTO `sys_oper_log` VALUES (655, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/8', '127.0.0.1', '8', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:44:12', 10);
INSERT INTO `sys_oper_log` VALUES (656, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:44:14', 10);
INSERT INTO `sys_oper_log` VALUES (657, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"1212\",\"content\":\"1212\",\"noticeType\":1,\"channels\":[\"dingtalk\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:46:38', 13);
INSERT INTO `sys_oper_log` VALUES (658, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/10/publish', '127.0.0.1', '10', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:46:43', 240);
INSERT INTO `sys_oper_log` VALUES (659, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"1212\",\"content\":\"111\",\"noticeType\":1,\"channels\":[\"dingtalk\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:47:42', 145);
INSERT INTO `sys_oper_log` VALUES (660, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/11/publish', '127.0.0.1', '11', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:47:45', 339);
INSERT INTO `sys_oper_log` VALUES (661, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"1212\",\"content\":\"22212\",\"noticeType\":1,\"channels\":[\"station\",\"dingtalk\",\"feishu\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:57:08', 190);
INSERT INTO `sys_oper_log` VALUES (662, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/12/publish', '127.0.0.1', '12', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:57:18', 713);
INSERT INTO `sys_oper_log` VALUES (663, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"31212\",\"content\":\"1212\",\"noticeType\":1,\"channels\":[\"station\",\"email\",\"feishu\",\"dingtalk\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:57:36', 22);
INSERT INTO `sys_oper_log` VALUES (664, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/13/publish', '127.0.0.1', '13', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:57:42', 3213);
INSERT INTO `sys_oper_log` VALUES (665, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/13/publish', '127.0.0.1', '13', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-02-28 23:57:44', 3066);
INSERT INTO `sys_oper_log` VALUES (666, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/13', '127.0.0.1', '13', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:04:37', 37);
INSERT INTO `sys_oper_log` VALUES (667, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/12', '127.0.0.1', '12', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:04:40', 10);
INSERT INTO `sys_oper_log` VALUES (668, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/11', '127.0.0.1', '11', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:04:41', 12);
INSERT INTO `sys_oper_log` VALUES (669, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"12\",\"content\":\"222\",\"noticeType\":1,\"channels\":[\"station\",\"email\",\"dingtalk\",\"feishu\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:05:01', 32);
INSERT INTO `sys_oper_log` VALUES (670, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/14/publish', '127.0.0.1', '14', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:05:07', 2963);
INSERT INTO `sys_oper_log` VALUES (671, '重试通知推送', 2, 'com.mars.admin.controller.message.SysNoticeController.retry()', 'POST', 'admin', '/api/sys/notice/14/retry', '127.0.0.1', '14 \"email\"', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:09:17', 2346);
INSERT INTO `sys_oper_log` VALUES (672, '用户管理', 2, 'com.mars.admin.controller.system.SysUserController.update()', 'PUT', 'admin', '/api/sys/user', '127.0.0.1', '{\"user\":{\"id\":3,\"createTime\":\"2026-01-29 23:21:12\",\"updateTime\":\"2026-02-08 16:44:59\",\"createBy\":1,\"updateBy\":1,\"deleted\":0,\"deptId\":2,\"deptName\":\"技术部\",\"postNames\":null,\"username\":\"mars11\",\"password\":null,\"nickname\":\"mars11\",\"avatar\":null,\"email\":\"wqexpore@163.com\",\"phone\":\"18888888881\",\"gender\":1,\"status\":1,\"remark\":\"\",\"userType\":\"admin\",\"openId\":null,\"isQuit\":0},\"roleIds\":[2],\"postIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:10:28', 45);
INSERT INTO `sys_oper_log` VALUES (673, '重试通知推送', 2, 'com.mars.admin.controller.message.SysNoticeController.retry()', 'POST', 'admin', '/api/sys/notice/14/retry', '127.0.0.1', '14 \"email\"', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:10:37', 2090);
INSERT INTO `sys_oper_log` VALUES (674, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"12\",\"content\":\"1212\",\"noticeType\":1,\"channels\":[\"station\",\"email\",\"dingtalk\",\"feishu\"],\"targetType\":3,\"targetIds\":[],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:10:48', 23);
INSERT INTO `sys_oper_log` VALUES (675, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/15/publish', '127.0.0.1', '15', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:10:53', 2795);
INSERT INTO `sys_oper_log` VALUES (676, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"212\",\"content\":\"1111\",\"noticeType\":1,\"channels\":[\"station\",\"email\",\"dingtalk\",\"feishu\"],\"targetType\":1,\"targetIds\":[1],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:11:29', 20);
INSERT INTO `sys_oper_log` VALUES (677, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/16/publish', '127.0.0.1', '16', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:11:34', 1707);
INSERT INTO `sys_oper_log` VALUES (678, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/16', '127.0.0.1', '16', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:11:47', 13);
INSERT INTO `sys_oper_log` VALUES (679, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/15', '127.0.0.1', '15', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:12:02', 8);
INSERT INTO `sys_oper_log` VALUES (680, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/14', '127.0.0.1', '14', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:12:03', 6);
INSERT INTO `sys_oper_log` VALUES (681, '删除通知', 3, 'com.mars.admin.controller.message.SysNoticeController.delete()', 'DELETE', 'admin', '/api/sys/notice/10', '127.0.0.1', '10', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:12:05', 7);
INSERT INTO `sys_oper_log` VALUES (682, '新增通知', 1, 'com.mars.admin.controller.message.SysNoticeController.create()', 'POST', 'admin', '/api/sys/notice', '127.0.0.1', '{\"id\":null,\"title\":\"12\",\"content\":\"2222\",\"noticeType\":1,\"channels\":[\"station\",\"email\",\"dingtalk\",\"feishu\"],\"targetType\":1,\"targetIds\":[1],\"status\":0}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:12:13', 12);
INSERT INTO `sys_oper_log` VALUES (683, '发布通知', 2, 'com.mars.admin.controller.message.SysNoticeController.publish()', 'POST', 'admin', '/api/sys/notice/17/publish', '127.0.0.1', '17', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 00:12:18', 1625);
INSERT INTO `sys_oper_log` VALUES (684, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 11:14:06', 227);
INSERT INTO `sys_oper_log` VALUES (685, '角色管理', 2, 'com.mars.admin.controller.system.SysRoleController.update()', 'PUT', 'admin', '/api/sys/role', '127.0.0.1', '{\"role\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"name\":\"超级管理员\",\"code\":\"admin\",\"sort\":1,\"status\":1,\"dataScope\":1,\"remark\":\"拥有所有权限\"},\"menuIds\":[7,8,9,143,142,3,4,5,144,11,12,13,145,15,16,17,19,20,21,146,24,25,26,147,28,29,30,148,33,149,35,150,38,151,40,41,42,44,45,153,136,137,138,139,141,155,156,157,158,159,160,171,172,173,174,175,152,128,129,278,163,164,165,166,167,168,169,279,280,281,282,284,286,287,288,289,290],\"deptIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:15:48', 161);
INSERT INTO `sys_oper_log` VALUES (686, '角色管理', 2, 'com.mars.admin.controller.system.SysRoleController.update()', 'PUT', 'admin', '/api/sys/role', '127.0.0.1', '{\"role\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"name\":\"超级管理员\",\"code\":\"admin\",\"sort\":1,\"status\":1,\"dataScope\":1,\"remark\":\"拥有所有权限\"},\"menuIds\":[7,8,9,143,142,3,4,5,144,11,12,13,145,15,16,17,19,20,21,146,24,25,26,147,28,29,30,148,33,149,35,150,38,151,40,41,42,44,45,153,136,137,138,139,141,155,156,157,158,159,160,171,172,173,174,175,152,128,129,278,163,164,165,166,167,168,169,279,280,281,282,284,2,170,6,10,14,18,23,27,32,34,37,39,43,154,283,127,135,162,1,22,31,36,126,134,140,161],\"deptIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:15:54', 120);
INSERT INTO `sys_oper_log` VALUES (687, '角色管理', 2, 'com.mars.admin.controller.system.SysRoleController.update()', 'PUT', 'admin', '/api/sys/role', '127.0.0.1', '{\"role\":{\"id\":1,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":null,\"updateBy\":1,\"deleted\":0,\"name\":\"超级管理员\",\"code\":\"admin\",\"sort\":1,\"status\":1,\"dataScope\":1,\"remark\":\"拥有所有权限\"},\"menuIds\":[7,8,9,143,142,3,4,5,144,11,12,13,145,15,16,17,19,20,21,146,24,25,26,147,28,29,30,148,33,149,35,150,38,151,40,41,42,44,45,153,136,137,138,139,141,155,156,157,158,159,160,171,172,173,174,175,152,128,129,278,163,164,165,166,167,168,169,279,280,281,282,284,2,170,6,10,14,18,23,27,32,34,37,39,43,154,283,127,135,162,1,22,31,36,126,134,140,285,286,287,288,289,290,161],\"deptIds\":[]}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:15:59', 134);
INSERT INTO `sys_oper_log` VALUES (688, '学生表', 1, 'com.mars.system.controller.StudentController.add()', 'POST', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":5,\"studentNo\":\"12\",\"name\":\"12\",\"gender\":null,\"birthday\":null,\"phone\":\"1\",\"email\":\"1\",\"address\":\"1\",\"classId\":1,\"status\":null,\"deleted\":null,\"createTime\":\"2026-03-01 11:16:14\",\"updateTime\":\"2026-03-01 11:16:14\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:16:15', 13);
INSERT INTO `sys_oper_log` VALUES (689, '学生表', 3, 'com.mars.system.controller.StudentController.remove()', 'DELETE', 'admin', '/api/system/student/5', '127.0.0.1', '[5]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:16:34', 17);
INSERT INTO `sys_oper_log` VALUES (690, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 11:16:48', 21);
INSERT INTO `sys_oper_log` VALUES (691, '字典类型', 3, 'com.mars.admin.controller.system.SysDictTypeController.delete()', 'DELETE', 'admin', '/api/sys/dict/type/1', '127.0.0.1', '1', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:18:09', 6);
INSERT INTO `sys_oper_log` VALUES (692, '字典类型', 1, 'com.mars.admin.controller.system.SysDictTypeController.create()', 'POST', 'admin', '/api/sys/dict/type', '127.0.0.1', '{\"id\":7,\"createTime\":\"2026-01-29 22:42:08\",\"updateTime\":\"2026-01-29 22:42:08\",\"createBy\":1,\"updateBy\":1,\"deleted\":0,\"dictName\":\"用户性别\",\"dictType\":\"gender\",\"status\":1,\"remark\":\"\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:18:21', 18);
INSERT INTO `sys_oper_log` VALUES (693, '字典数据', 1, 'com.mars.admin.controller.system.SysDictDataController.create()', 'POST', 'admin', '/api/sys/dict/data', '127.0.0.1', '{\"id\":10,\"createTime\":\"2026-03-01 11:18:32\",\"updateTime\":\"2026-03-01 11:18:32\",\"createBy\":1,\"updateBy\":1,\"deleted\":null,\"sort\":0,\"dictLabel\":\"男\",\"dictValue\":\"1\",\"dictType\":\"gender\",\"cssClass\":null,\"listClass\":\"default\",\"isDefault\":0,\"status\":1,\"remark\":\"\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:18:33', 12);
INSERT INTO `sys_oper_log` VALUES (694, '字典数据', 1, 'com.mars.admin.controller.system.SysDictDataController.create()', 'POST', 'admin', '/api/sys/dict/data', '127.0.0.1', '{\"id\":11,\"createTime\":\"2026-03-01 11:18:38\",\"updateTime\":\"2026-03-01 11:18:38\",\"createBy\":1,\"updateBy\":1,\"deleted\":null,\"sort\":0,\"dictLabel\":\"女\",\"dictValue\":\"2\",\"dictType\":\"gender\",\"cssClass\":null,\"listClass\":\"default\",\"isDefault\":0,\"status\":1,\"remark\":\"\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:18:39', 7);
INSERT INTO `sys_oper_log` VALUES (695, '修改代码生成配置', 2, 'com.mars.admin.controller.gen.GenController.update()', 'PUT', 'admin', '/api/tool/gen', '127.0.0.1', '{\"id\":4,\"tableName\":\"student\",\"tableComment\":\"学生表\",\"className\":\"Student\",\"packageName\":\"com.mars.system\",\"moduleName\":\"system\",\"businessName\":\"student\",\"functionName\":\"学生表\",\"author\":\"Mars\",\"genType\":\"crud\",\"genPath\":\"/\",\"frontType\":\"naive-ui\",\"parentMenuId\":null,\"remark\":null,\"createTime\":\"2026-02-09 12:44:26\",\"updateTime\":\"2026-02-09 12:44:26\",\"columns\":[{\"id\":34,\"tableId\":4,\"columnName\":\"id\",\"columnComment\":\"id\",\"columnType\":\"bigint\",\"javaType\":\"Long\",\"javaField\":\"id\",\"isPk\":1,\"isIncrement\":1,\"isRequired\":1,\"isInsert\":0,\"isEdit\":0,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":1,\"stringType\":false,\"numberType\":true,\"timeType\":false},{\"id\":35,\"tableId\":4,\"columnName\":\"student_no\",\"columnComment\":\"学号\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"studentNo\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":2,\"stringType\":true,\"numberType\":false,\"timeType\":false},{\"id\":36,\"tableId\":4,\"columnName\":\"name\",\"columnComment\":\"姓名\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"name\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":3,\"stringType\":true,\"numberType\":false,\"timeType\":false},{\"id\":37,\"tableId\":4,\"columnName\":\"gender\",\"columnComment\":\"性别 1男 2女\",\"columnType\":\"tinyint\",\"javaType\":\"Integer\",\"javaField\":\"gender\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"select\",\"dictType\":\"gender\",\"sort\":4,\"stringType\":false,\"numberType\":true,\"timeType\":false},{\"id\":38,\"tableId\":4,\"columnName\":\"birthday\",\"columnComment\":\"出生日期\",\"columnType\":\"date\",\"javaType\":\"LocalDate\",\"javaField\":\"birthday\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"datetime\",\"dictType\":\"\",\"sort\":5,\"stringType\":false,\"numberTyp', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:24:19', 69);
INSERT INTO `sys_oper_log` VALUES (696, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 11:24:24', 203);
INSERT INTO `sys_oper_log` VALUES (697, '学生表', 1, 'com.mars.system.controller.StudentController.add()', 'POST', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":6,\"studentNo\":\"1\",\"name\":\"1\",\"gender\":1,\"birthday\":null,\"phone\":\"11\",\"email\":\"1\",\"address\":\"1\",\"classId\":1,\"status\":1,\"deleted\":null,\"createTime\":\"2026-03-01 11:26:55\",\"updateTime\":\"2026-03-01 11:26:55\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:26:55', 28);
INSERT INTO `sys_oper_log` VALUES (698, '学生表', 3, 'com.mars.system.controller.StudentController.remove()', 'DELETE', 'admin', '/api/system/student/6', '127.0.0.1', '[6]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:27:08', 15);
INSERT INTO `sys_oper_log` VALUES (699, '修改代码生成配置', 2, 'com.mars.admin.controller.gen.GenController.update()', 'PUT', 'admin', '/api/tool/gen', '127.0.0.1', '{\"id\":4,\"tableName\":\"student\",\"tableComment\":\"学生表\",\"className\":\"Student\",\"packageName\":\"com.mars.system\",\"moduleName\":\"system\",\"businessName\":\"student\",\"functionName\":\"学生表\",\"author\":\"Mars\",\"genType\":\"crud\",\"genPath\":\"/\",\"frontType\":\"naive-ui\",\"parentMenuId\":null,\"remark\":null,\"createTime\":\"2026-02-09 12:44:26\",\"updateTime\":\"2026-02-09 12:44:26\",\"columns\":[{\"id\":34,\"tableId\":4,\"columnName\":\"id\",\"columnComment\":\"id\",\"columnType\":\"bigint\",\"javaType\":\"Long\",\"javaField\":\"id\",\"isPk\":1,\"isIncrement\":1,\"isRequired\":1,\"isInsert\":0,\"isEdit\":0,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":1,\"stringType\":false,\"timeType\":false,\"numberType\":true},{\"id\":35,\"tableId\":4,\"columnName\":\"student_no\",\"columnComment\":\"学号\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"studentNo\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":2,\"stringType\":true,\"timeType\":false,\"numberType\":false},{\"id\":36,\"tableId\":4,\"columnName\":\"name\",\"columnComment\":\"姓名\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"name\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":3,\"stringType\":true,\"timeType\":false,\"numberType\":false},{\"id\":37,\"tableId\":4,\"columnName\":\"gender\",\"columnComment\":\"性别 1男 2女\",\"columnType\":\"tinyint\",\"javaType\":\"Integer\",\"javaField\":\"gender\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"select\",\"dictType\":\"gender\",\"sort\":4,\"stringType\":false,\"timeType\":false,\"numberType\":true},{\"id\":38,\"tableId\":4,\"columnName\":\"birthday\",\"columnComment\":\"出生日期\",\"columnType\":\"date\",\"javaType\":\"LocalDate\",\"javaField\":\"birthday\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"datetime\",\"dictType\":\"\",\"sort\":5,\"stringType\":false,\"timeType\"', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:27:45', 41);
INSERT INTO `sys_oper_log` VALUES (700, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 11:27:49', 22);
INSERT INTO `sys_oper_log` VALUES (701, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 11:27:57', 145);
INSERT INTO `sys_oper_log` VALUES (702, '上传图片', 1, 'com.mars.admin.controller.file.SysFileController.uploadImage()', 'POST', 'admin', '/api/sys/file/upload/image', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"id\":80,\"originalName\":\"default-avatar.jpg\",\"fileName\":\"455f90b28929422db2b6beac0174be00.jpg\",\"filePath\":\"images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg\",\"url\":\"/api/files/images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg\",\"fileSize\":22859,\"fileType\":\"image/jpeg\",\"fileSuffix\":\".jpg\",\"storageType\":\"local\",\"bucketName\":null,\"groupId\":null,\"createBy\":\"1\",\"createTime\":\"2026-03-01 11:29:28\",\"remark\":null}}', 0, NULL, '2026-03-01 11:29:29', 39);
INSERT INTO `sys_oper_log` VALUES (703, '学生表', 1, 'com.mars.system.controller.StudentController.add()', 'POST', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":7,\"studentNo\":\"12\",\"name\":\"12\",\"gender\":1,\"birthday\":null,\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/455f90b28929422db2b6beac0174be00.jpg\",\"classId\":2,\"status\":1,\"deleted\":null,\"createTime\":\"2026-03-01 11:29:31\",\"updateTime\":\"2026-03-01 11:29:31\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 11:29:32', 33);
INSERT INTO `sys_oper_log` VALUES (704, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 11:46:03', 44);
INSERT INTO `sys_oper_log` VALUES (705, '修改代码生成配置', 2, 'com.mars.admin.controller.gen.GenController.update()', 'PUT', 'admin', '/api/tool/gen', '127.0.0.1', '{\"id\":4,\"tableName\":\"student\",\"tableComment\":\"学生表\",\"className\":\"Student\",\"packageName\":\"com.mars.system\",\"moduleName\":\"system\",\"businessName\":\"student\",\"functionName\":\"学生表\",\"author\":\"Mars\",\"genType\":\"crud\",\"genPath\":\"/\",\"frontType\":\"naive-ui\",\"formLayout\":\"grid\",\"parentMenuId\":null,\"remark\":null,\"createTime\":\"2026-02-09 12:44:26\",\"updateTime\":\"2026-02-09 12:44:26\",\"columns\":[{\"id\":34,\"tableId\":4,\"columnName\":\"id\",\"columnComment\":\"id\",\"columnType\":\"bigint\",\"javaType\":\"Long\",\"javaField\":\"id\",\"isPk\":1,\"isIncrement\":1,\"isRequired\":1,\"isInsert\":0,\"isEdit\":0,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":1,\"timeType\":false,\"numberType\":true,\"stringType\":false},{\"id\":35,\"tableId\":4,\"columnName\":\"student_no\",\"columnComment\":\"学号\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"studentNo\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":2,\"timeType\":false,\"numberType\":false,\"stringType\":true},{\"id\":36,\"tableId\":4,\"columnName\":\"name\",\"columnComment\":\"姓名\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"name\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":3,\"timeType\":false,\"numberType\":false,\"stringType\":true},{\"id\":37,\"tableId\":4,\"columnName\":\"gender\",\"columnComment\":\"性别 1男 2女\",\"columnType\":\"tinyint\",\"javaType\":\"Integer\",\"javaField\":\"gender\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"select\",\"dictType\":\"gender\",\"sort\":4,\"timeType\":false,\"numberType\":true,\"stringType\":false},{\"id\":38,\"tableId\":4,\"columnName\":\"birthday\",\"columnComment\":\"出生日期\",\"columnType\":\"date\",\"javaType\":\"LocalDate\",\"javaField\":\"birthday\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"datetime\",\"dictType\":\"\",\"sort\":5,\"timeType', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:04:41', 66);
INSERT INTO `sys_oper_log` VALUES (706, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 12:04:48', 158);
INSERT INTO `sys_oper_log` VALUES (707, '学生表', 3, 'com.mars.system.controller.StudentController.remove()', 'DELETE', 'admin', '/api/system/student/7', '127.0.0.1', '[7]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:06:11', 37);
INSERT INTO `sys_oper_log` VALUES (708, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 12:06:19', 34);
INSERT INTO `sys_oper_log` VALUES (709, '修改代码生成配置', 2, 'com.mars.admin.controller.gen.GenController.update()', 'PUT', 'admin', '/api/tool/gen', '127.0.0.1', '{\"id\":4,\"tableName\":\"student\",\"tableComment\":\"学生表\",\"className\":\"Student\",\"packageName\":\"com.mars.system\",\"moduleName\":\"system\",\"businessName\":\"student\",\"functionName\":\"学生表\",\"author\":\"Mars\",\"genType\":\"crud\",\"genPath\":\"/\",\"frontType\":\"naive-ui\",\"formLayout\":\"grid\",\"parentMenuId\":null,\"remark\":null,\"createTime\":\"2026-02-09 12:44:26\",\"updateTime\":\"2026-02-09 12:44:26\",\"columns\":[{\"id\":34,\"tableId\":4,\"columnName\":\"id\",\"columnComment\":\"id\",\"columnType\":\"bigint\",\"javaType\":\"Long\",\"javaField\":\"id\",\"isPk\":1,\"isIncrement\":1,\"isRequired\":1,\"isInsert\":0,\"isEdit\":0,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":1,\"stringType\":false,\"timeType\":false,\"numberType\":true},{\"id\":35,\"tableId\":4,\"columnName\":\"student_no\",\"columnComment\":\"学号\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"studentNo\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":2,\"stringType\":true,\"timeType\":false,\"numberType\":false},{\"id\":36,\"tableId\":4,\"columnName\":\"name\",\"columnComment\":\"姓名\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"name\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":3,\"stringType\":true,\"timeType\":false,\"numberType\":false},{\"id\":37,\"tableId\":4,\"columnName\":\"gender\",\"columnComment\":\"性别\",\"columnType\":\"tinyint\",\"javaType\":\"Integer\",\"javaField\":\"gender\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"select\",\"dictType\":\"gender\",\"sort\":4,\"stringType\":false,\"timeType\":false,\"numberType\":true},{\"id\":38,\"tableId\":4,\"columnName\":\"birthday\",\"columnComment\":\"出生日期\",\"columnType\":\"date\",\"javaType\":\"LocalDate\",\"javaField\":\"birthday\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"datetime\",\"dictType\":\"\",\"sort\":5,\"stringType\":fa', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:06:54', 46);
INSERT INTO `sys_oper_log` VALUES (710, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 12:07:02', 209);
INSERT INTO `sys_oper_log` VALUES (711, '上传图片', 1, 'com.mars.admin.controller.file.SysFileController.uploadImage()', 'POST', 'admin', '/api/sys/file/upload/image', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"id\":81,\"originalName\":\"default-avatar.jpg\",\"fileName\":\"25d29e831ee3432ebd87a59c7b53fade.jpg\",\"filePath\":\"images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg\",\"url\":\"/api/files/images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg\",\"fileSize\":22859,\"fileType\":\"image/jpeg\",\"fileSuffix\":\".jpg\",\"storageType\":\"local\",\"bucketName\":null,\"groupId\":null,\"createBy\":\"1\",\"createTime\":\"2026-03-01 12:08:27\",\"remark\":null}}', 0, NULL, '2026-03-01 12:08:27', 41);
INSERT INTO `sys_oper_log` VALUES (712, '学生表', 1, 'com.mars.system.controller.StudentController.add()', 'POST', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":8,\"studentNo\":\"11\",\"name\":\"1\",\"gender\":1,\"birthday\":null,\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/25d29e831ee3432ebd87a59c7b53fade.jpg\",\"classId\":1,\"status\":1,\"deleted\":null,\"createTime\":\"2026-03-01 12:08:31\",\"updateTime\":\"2026-03-01 12:08:31\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:08:31', 22);
INSERT INTO `sys_oper_log` VALUES (713, '修改代码生成配置', 2, 'com.mars.admin.controller.gen.GenController.update()', 'PUT', 'admin', '/api/tool/gen', '127.0.0.1', '{\"id\":4,\"tableName\":\"student\",\"tableComment\":\"学生表\",\"className\":\"Student\",\"packageName\":\"com.mars.system\",\"moduleName\":\"system\",\"businessName\":\"student\",\"functionName\":\"学生表\",\"author\":\"Mars\",\"genType\":\"crud\",\"genPath\":\"/\",\"frontType\":\"naive-ui\",\"formLayout\":\"grid\",\"parentMenuId\":null,\"remark\":null,\"createTime\":\"2026-02-09 12:44:26\",\"updateTime\":\"2026-02-09 12:44:26\",\"columns\":[{\"id\":34,\"tableId\":4,\"columnName\":\"id\",\"columnComment\":\"id\",\"columnType\":\"bigint\",\"javaType\":\"Long\",\"javaField\":\"id\",\"isPk\":1,\"isIncrement\":1,\"isRequired\":1,\"isInsert\":0,\"isEdit\":0,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":1,\"numberType\":true,\"stringType\":false,\"timeType\":false},{\"id\":35,\"tableId\":4,\"columnName\":\"student_no\",\"columnComment\":\"学号\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"studentNo\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":2,\"numberType\":false,\"stringType\":true,\"timeType\":false},{\"id\":36,\"tableId\":4,\"columnName\":\"name\",\"columnComment\":\"姓名\",\"columnType\":\"varchar(50)\",\"javaType\":\"String\",\"javaField\":\"name\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":1,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":1,\"queryType\":\"EQ\",\"htmlType\":\"input\",\"dictType\":\"\",\"sort\":3,\"numberType\":false,\"stringType\":true,\"timeType\":false},{\"id\":37,\"tableId\":4,\"columnName\":\"gender\",\"columnComment\":\"性别\",\"columnType\":\"tinyint\",\"javaType\":\"Integer\",\"javaField\":\"gender\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"select\",\"dictType\":\"gender\",\"sort\":4,\"numberType\":true,\"stringType\":false,\"timeType\":false},{\"id\":38,\"tableId\":4,\"columnName\":\"birthday\",\"columnComment\":\"出生日期\",\"columnType\":\"date\",\"javaType\":\"LocalDate\",\"javaField\":\"birthday\",\"isPk\":0,\"isIncrement\":0,\"isRequired\":0,\"isInsert\":1,\"isEdit\":1,\"isList\":1,\"isQuery\":0,\"queryType\":\"EQ\",\"htmlType\":\"datetime\",\"dictType\":\"\",\"sort\":5,\"numberType\":fa', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:09:27', 41);
INSERT INTO `sys_oper_log` VALUES (714, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 12:09:32', 28);
INSERT INTO `sys_oper_log` VALUES (715, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 12:09:45', 206);
INSERT INTO `sys_oper_log` VALUES (716, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 12:14:37', 44);
INSERT INTO `sys_oper_log` VALUES (717, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 12:15:15', 266);
INSERT INTO `sys_oper_log` VALUES (718, '学生表', 3, 'com.mars.system.controller.StudentController.remove()', 'DELETE', 'admin', '/api/system/student/8', '127.0.0.1', '[8]', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:15:55', 54);
INSERT INTO `sys_oper_log` VALUES (719, '上传图片', 1, 'com.mars.admin.controller.file.SysFileController.uploadImage()', 'POST', 'admin', '/api/sys/file/upload/image', '127.0.0.1', '', '{\"code\":200,\"message\":\"操作成功\",\"data\":{\"id\":82,\"originalName\":\"default-avatar.jpg\",\"fileName\":\"0f6511a67ffb431abf18fa218066d992.jpg\",\"filePath\":\"images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"url\":\"/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"fileSize\":22859,\"fileType\":\"image/jpeg\",\"fileSuffix\":\".jpg\",\"storageType\":\"local\",\"bucketName\":null,\"groupId\":null,\"createBy\":\"1\",\"createTime\":\"2026-03-01 12:16:10\",\"remark\":null}}', 0, NULL, '2026-03-01 12:16:11', 23);
INSERT INTO `sys_oper_log` VALUES (720, '学生表', 1, 'com.mars.system.controller.StudentController.add()', 'POST', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":9,\"studentNo\":\"1\",\"name\":\"1\",\"gender\":1,\"birthday\":\"2026-03-02\",\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"classId\":1,\"status\":1,\"deleted\":null,\"createTime\":\"2026-03-01 12:16:12\",\"updateTime\":\"2026-03-01 12:16:12\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:16:13', 15);
INSERT INTO `sys_oper_log` VALUES (721, '移除已生成代码', 3, 'com.mars.admin.controller.gen.GenController.removeGeneratedCode()', 'DELETE', 'admin', '/api/tool/gen/remove-code/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已删除\"]}', 0, NULL, '2026-03-01 12:20:10', 46);
INSERT INTO `sys_oper_log` VALUES (722, '生成代码到项目', 1, 'com.mars.admin.controller.gen.GenController.generateToProject()', 'POST', 'admin', '/api/tool/gen/generate/4', '127.0.0.1', '4', '{\"code\":200,\"message\":\"操作成功\",\"data\":[\"/mars-core/mars-biz/src/main/java/com/mars/biz/entity/Student.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/mapper/StudentMapper.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/StudentService.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/service/impl/StudentServiceImpl.java\",\"/mars-core/mars-biz/src/main/java/com/mars/biz/controller/StudentController.java\",\"/mars-ui/src/api/student.ts\",\"/mars-ui/src/views/system/student/index.vue\",\"[数据库] 菜单数据已自动创建\"]}', 0, NULL, '2026-03-01 12:20:17', 226);
INSERT INTO `sys_oper_log` VALUES (723, '学生表', 2, 'com.mars.system.controller.StudentController.edit()', 'PUT', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":9,\"studentNo\":\"1\",\"name\":\"1\",\"gender\":1,\"birthday\":\"2026-03-01\",\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"classId\":1,\"status\":1,\"deleted\":0,\"createTime\":\"2026-03-01 04:16:13\",\"updateTime\":\"2026-03-01 04:16:13\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:21:39', 28);
INSERT INTO `sys_oper_log` VALUES (724, '学生表', 2, 'com.mars.system.controller.StudentController.edit()', 'PUT', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":9,\"studentNo\":\"1\",\"name\":\"1\",\"gender\":1,\"birthday\":\"2026-03-02\",\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"classId\":1,\"status\":1,\"deleted\":0,\"createTime\":\"2026-02-28 20:16:13\",\"updateTime\":\"2026-02-28 20:16:13\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:21:45', 10);
INSERT INTO `sys_oper_log` VALUES (725, '学生表', 2, 'com.mars.system.controller.StudentController.edit()', 'PUT', 'admin', '/api/system/student', '127.0.0.1', '{\"id\":9,\"studentNo\":\"1\",\"name\":\"1\",\"gender\":1,\"birthday\":\"2026-03-03\",\"phone\":\"1\",\"email\":\"1\",\"address\":\"/api/files/images/2026/03/01/0f6511a67ffb431abf18fa218066d992.jpg\",\"classId\":1,\"status\":1,\"deleted\":0,\"createTime\":\"2026-02-28 12:16:13\",\"updateTime\":\"2026-02-28 12:16:13\"}', '{\"code\":200,\"message\":\"操作成功\",\"data\":null}', 0, NULL, '2026-03-01 12:21:51', 12);

-- ----------------------------
-- Table structure for `sys_post`
-- ----------------------------
DROP TABLE IF EXISTS `sys_post`;
CREATE TABLE `sys_post`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`parent_id` bigint NULL DEFAULT 0 COMMENT '父岗位ID',
`post_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '岗位编码',
`post_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '岗位名称',
`sort` int NULL DEFAULT 0 COMMENT '显示顺序',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-停用 1-正常)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_post_code`(`post_code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '岗位表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_post
-- ----------------------------
INSERT INTO `sys_post` VALUES (1, 0, 'ceo', '董事长', 1, 1, '公司董事长', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, NULL, 0);
INSERT INTO `sys_post` VALUES (2, 6, 'cto', '技术总监', 2, 1, '技术总监', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_post` VALUES (3, 2, 'pm', '产品经理', 3, 1, '产品经理', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_post` VALUES (4, 6, 'dev', '开发工程师', 4, 1, '开发工程师', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0);
INSERT INTO `sys_post` VALUES (6, 1, 'manager', '总经理', 2, 1, '', '2026-01-29 22:42:08', '2026-01-29 22:42:08', 1, 1, 0);
INSERT INTO `sys_post` VALUES (7, 2, 'test_coder', '测试工程师', 0, 1, '', '2026-02-09 15:47:35', '2026-02-09 17:03:40', 1, 1, 1);
INSERT INTO `sys_post` VALUES (8, 2, 'test001', '测试', 0, 1, '', '2026-02-10 16:42:47', '2026-02-10 16:42:47', 1, 1, 0);

-- ----------------------------
-- Table structure for `sys_role`
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色名称',
`code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '角色编码',
`sort` int NULL DEFAULT 0 COMMENT '排序',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-禁用 1-启用)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
`data_scope` tinyint NOT NULL DEFAULT 1 COMMENT '数据范围(1全部 2自定义 3本部门 4本部门及以下 5仅本人)',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_code`(`code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_role
-- ----------------------------
INSERT INTO `sys_role` VALUES (1, '超级管理员', 'admin', 1, 1, '拥有所有权限', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0, 1);
INSERT INTO `sys_role` VALUES (2, '普通用户', 'user', 2, 1, '普通用户角色', '2026-01-29 22:42:08', '2026-01-29 22:42:08', NULL, 1, 0, 3);

-- ----------------------------
-- Table structure for `sys_role_dept`
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_dept`;
CREATE TABLE `sys_role_dept`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`role_id` bigint NOT NULL COMMENT '角色ID',
`dept_id` bigint NOT NULL COMMENT '部门ID',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_role_dept`(`role_id` ASC, `dept_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色-部门 数据权限关联' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_role_dept
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `sys_role_menu`
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`role_id` bigint NOT NULL COMMENT '角色ID',
`menu_id` bigint NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_role_id`(`role_id` ASC) USING BTREE,
  INDEX `idx_menu_id`(`menu_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8844 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '角色菜单关联表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_role_menu
-- ----------------------------
INSERT INTO `sys_role_menu` VALUES (7457, 2, 139);
INSERT INTO `sys_role_menu` VALUES (7458, 2, 153);
INSERT INTO `sys_role_menu` VALUES (7459, 2, 136);
INSERT INTO `sys_role_menu` VALUES (7460, 2, 137);
INSERT INTO `sys_role_menu` VALUES (7461, 2, 138);
INSERT INTO `sys_role_menu` VALUES (7462, 2, 150);
INSERT INTO `sys_role_menu` VALUES (7463, 2, 38);
INSERT INTO `sys_role_menu` VALUES (7464, 2, 151);
INSERT INTO `sys_role_menu` VALUES (7465, 2, 40);
INSERT INTO `sys_role_menu` VALUES (7466, 2, 41);
INSERT INTO `sys_role_menu` VALUES (7467, 2, 42);
INSERT INTO `sys_role_menu` VALUES (7468, 2, 44);
INSERT INTO `sys_role_menu` VALUES (7469, 2, 45);
INSERT INTO `sys_role_menu` VALUES (7470, 2, 155);
INSERT INTO `sys_role_menu` VALUES (7471, 2, 156);
INSERT INTO `sys_role_menu` VALUES (7472, 2, 157);
INSERT INTO `sys_role_menu` VALUES (7473, 2, 158);
INSERT INTO `sys_role_menu` VALUES (7474, 2, 159);
INSERT INTO `sys_role_menu` VALUES (7475, 2, 160);
INSERT INTO `sys_role_menu` VALUES (7476, 2, 148);
INSERT INTO `sys_role_menu` VALUES (7477, 2, 33);
INSERT INTO `sys_role_menu` VALUES (7478, 2, 149);
INSERT INTO `sys_role_menu` VALUES (7479, 2, 35);
INSERT INTO `sys_role_menu` VALUES (7480, 2, 142);
INSERT INTO `sys_role_menu` VALUES (7481, 2, 3);
INSERT INTO `sys_role_menu` VALUES (7482, 2, 4);
INSERT INTO `sys_role_menu` VALUES (7483, 2, 5);
INSERT INTO `sys_role_menu` VALUES (7484, 2, 171);
INSERT INTO `sys_role_menu` VALUES (7485, 2, 172);
INSERT INTO `sys_role_menu` VALUES (7486, 2, 173);
INSERT INTO `sys_role_menu` VALUES (7487, 2, 174);
INSERT INTO `sys_role_menu` VALUES (7488, 2, 175);
INSERT INTO `sys_role_menu` VALUES (7489, 2, 143);
INSERT INTO `sys_role_menu` VALUES (7490, 2, 7);
INSERT INTO `sys_role_menu` VALUES (7491, 2, 8);
INSERT INTO `sys_role_menu` VALUES (7492, 2, 9);
INSERT INTO `sys_role_menu` VALUES (7493, 2, 144);
INSERT INTO `sys_role_menu` VALUES (7494, 2, 11);
INSERT INTO `sys_role_menu` VALUES (7495, 2, 12);
INSERT INTO `sys_role_menu` VALUES (7496, 2, 13);
INSERT INTO `sys_role_menu` VALUES (7497, 2, 145);
INSERT INTO `sys_role_menu` VALUES (7498, 2, 15);
INSERT INTO `sys_role_menu` VALUES (7499, 2, 16);
INSERT INTO `sys_role_menu` VALUES (7500, 2, 17);
INSERT INTO `sys_role_menu` VALUES (7501, 2, 19);
INSERT INTO `sys_role_menu` VALUES (7502, 2, 20);
INSERT INTO `sys_role_menu` VALUES (7503, 2, 21);
INSERT INTO `sys_role_menu` VALUES (7504, 2, 146);
INSERT INTO `sys_role_menu` VALUES (7505, 2, 24);
INSERT INTO `sys_role_menu` VALUES (7506, 2, 25);
INSERT INTO `sys_role_menu` VALUES (7507, 2, 26);
INSERT INTO `sys_role_menu` VALUES (7508, 2, 147);
INSERT INTO `sys_role_menu` VALUES (7509, 2, 28);
INSERT INTO `sys_role_menu` VALUES (7510, 2, 29);
INSERT INTO `sys_role_menu` VALUES (7511, 2, 30);
INSERT INTO `sys_role_menu` VALUES (7512, 2, 152);
INSERT INTO `sys_role_menu` VALUES (7513, 2, 128);
INSERT INTO `sys_role_menu` VALUES (7514, 2, 129);
INSERT INTO `sys_role_menu` VALUES (7515, 2, 141);
INSERT INTO `sys_role_menu` VALUES (7516, 2, 163);
INSERT INTO `sys_role_menu` VALUES (7517, 2, 164);
INSERT INTO `sys_role_menu` VALUES (7518, 2, 165);
INSERT INTO `sys_role_menu` VALUES (7519, 2, 166);
INSERT INTO `sys_role_menu` VALUES (7520, 2, 167);
INSERT INTO `sys_role_menu` VALUES (7521, 2, 168);
INSERT INTO `sys_role_menu` VALUES (7522, 2, 169);
INSERT INTO `sys_role_menu` VALUES (8416, 2, 282);
INSERT INTO `sys_role_menu` VALUES (8418, 2, 283);
INSERT INTO `sys_role_menu` VALUES (8698, 1, 7);
INSERT INTO `sys_role_menu` VALUES (8699, 1, 8);
INSERT INTO `sys_role_menu` VALUES (8700, 1, 9);
INSERT INTO `sys_role_menu` VALUES (8701, 1, 143);
INSERT INTO `sys_role_menu` VALUES (8702, 1, 142);
INSERT INTO `sys_role_menu` VALUES (8703, 1, 3);
INSERT INTO `sys_role_menu` VALUES (8704, 1, 4);
INSERT INTO `sys_role_menu` VALUES (8705, 1, 5);
INSERT INTO `sys_role_menu` VALUES (8706, 1, 144);
INSERT INTO `sys_role_menu` VALUES (8707, 1, 11);
INSERT INTO `sys_role_menu` VALUES (8708, 1, 12);
INSERT INTO `sys_role_menu` VALUES (8709, 1, 13);
INSERT INTO `sys_role_menu` VALUES (8710, 1, 145);
INSERT INTO `sys_role_menu` VALUES (8711, 1, 15);
INSERT INTO `sys_role_menu` VALUES (8712, 1, 16);
INSERT INTO `sys_role_menu` VALUES (8713, 1, 17);
INSERT INTO `sys_role_menu` VALUES (8714, 1, 19);
INSERT INTO `sys_role_menu` VALUES (8715, 1, 20);
INSERT INTO `sys_role_menu` VALUES (8716, 1, 21);
INSERT INTO `sys_role_menu` VALUES (8717, 1, 146);
INSERT INTO `sys_role_menu` VALUES (8718, 1, 24);
INSERT INTO `sys_role_menu` VALUES (8719, 1, 25);
INSERT INTO `sys_role_menu` VALUES (8720, 1, 26);
INSERT INTO `sys_role_menu` VALUES (8721, 1, 147);
INSERT INTO `sys_role_menu` VALUES (8722, 1, 28);
INSERT INTO `sys_role_menu` VALUES (8723, 1, 29);
INSERT INTO `sys_role_menu` VALUES (8724, 1, 30);
INSERT INTO `sys_role_menu` VALUES (8725, 1, 148);
INSERT INTO `sys_role_menu` VALUES (8726, 1, 33);
INSERT INTO `sys_role_menu` VALUES (8727, 1, 149);
INSERT INTO `sys_role_menu` VALUES (8728, 1, 35);
INSERT INTO `sys_role_menu` VALUES (8729, 1, 150);
INSERT INTO `sys_role_menu` VALUES (8730, 1, 38);
INSERT INTO `sys_role_menu` VALUES (8731, 1, 151);
INSERT INTO `sys_role_menu` VALUES (8732, 1, 40);
INSERT INTO `sys_role_menu` VALUES (8733, 1, 41);
INSERT INTO `sys_role_menu` VALUES (8734, 1, 42);
INSERT INTO `sys_role_menu` VALUES (8735, 1, 44);
INSERT INTO `sys_role_menu` VALUES (8736, 1, 45);
INSERT INTO `sys_role_menu` VALUES (8737, 1, 153);
INSERT INTO `sys_role_menu` VALUES (8738, 1, 136);
INSERT INTO `sys_role_menu` VALUES (8739, 1, 137);
INSERT INTO `sys_role_menu` VALUES (8740, 1, 138);
INSERT INTO `sys_role_menu` VALUES (8741, 1, 139);
INSERT INTO `sys_role_menu` VALUES (8742, 1, 141);
INSERT INTO `sys_role_menu` VALUES (8743, 1, 155);
INSERT INTO `sys_role_menu` VALUES (8744, 1, 156);
INSERT INTO `sys_role_menu` VALUES (8745, 1, 157);
INSERT INTO `sys_role_menu` VALUES (8746, 1, 158);
INSERT INTO `sys_role_menu` VALUES (8747, 1, 159);
INSERT INTO `sys_role_menu` VALUES (8748, 1, 160);
INSERT INTO `sys_role_menu` VALUES (8749, 1, 171);
INSERT INTO `sys_role_menu` VALUES (8750, 1, 172);
INSERT INTO `sys_role_menu` VALUES (8751, 1, 173);
INSERT INTO `sys_role_menu` VALUES (8752, 1, 174);
INSERT INTO `sys_role_menu` VALUES (8753, 1, 175);
INSERT INTO `sys_role_menu` VALUES (8754, 1, 152);
INSERT INTO `sys_role_menu` VALUES (8755, 1, 128);
INSERT INTO `sys_role_menu` VALUES (8756, 1, 129);
INSERT INTO `sys_role_menu` VALUES (8757, 1, 278);
INSERT INTO `sys_role_menu` VALUES (8758, 1, 163);
INSERT INTO `sys_role_menu` VALUES (8759, 1, 164);
INSERT INTO `sys_role_menu` VALUES (8760, 1, 165);
INSERT INTO `sys_role_menu` VALUES (8761, 1, 166);
INSERT INTO `sys_role_menu` VALUES (8762, 1, 167);
INSERT INTO `sys_role_menu` VALUES (8763, 1, 168);
INSERT INTO `sys_role_menu` VALUES (8764, 1, 169);
INSERT INTO `sys_role_menu` VALUES (8765, 1, 279);
INSERT INTO `sys_role_menu` VALUES (8766, 1, 280);
INSERT INTO `sys_role_menu` VALUES (8767, 1, 281);
INSERT INTO `sys_role_menu` VALUES (8768, 1, 282);
INSERT INTO `sys_role_menu` VALUES (8769, 1, 284);
INSERT INTO `sys_role_menu` VALUES (8770, 1, 2);
INSERT INTO `sys_role_menu` VALUES (8771, 1, 170);
INSERT INTO `sys_role_menu` VALUES (8772, 1, 6);
INSERT INTO `sys_role_menu` VALUES (8773, 1, 10);
INSERT INTO `sys_role_menu` VALUES (8774, 1, 14);
INSERT INTO `sys_role_menu` VALUES (8775, 1, 18);
INSERT INTO `sys_role_menu` VALUES (8776, 1, 23);
INSERT INTO `sys_role_menu` VALUES (8777, 1, 27);
INSERT INTO `sys_role_menu` VALUES (8778, 1, 32);
INSERT INTO `sys_role_menu` VALUES (8779, 1, 34);
INSERT INTO `sys_role_menu` VALUES (8780, 1, 37);
INSERT INTO `sys_role_menu` VALUES (8781, 1, 39);
INSERT INTO `sys_role_menu` VALUES (8782, 1, 43);
INSERT INTO `sys_role_menu` VALUES (8783, 1, 154);
INSERT INTO `sys_role_menu` VALUES (8784, 1, 283);
INSERT INTO `sys_role_menu` VALUES (8785, 1, 127);
INSERT INTO `sys_role_menu` VALUES (8786, 1, 135);
INSERT INTO `sys_role_menu` VALUES (8787, 1, 162);
INSERT INTO `sys_role_menu` VALUES (8788, 1, 1);
INSERT INTO `sys_role_menu` VALUES (8789, 1, 22);
INSERT INTO `sys_role_menu` VALUES (8790, 1, 31);
INSERT INTO `sys_role_menu` VALUES (8791, 1, 36);
INSERT INTO `sys_role_menu` VALUES (8792, 1, 126);
INSERT INTO `sys_role_menu` VALUES (8793, 1, 134);
INSERT INTO `sys_role_menu` VALUES (8794, 1, 140);
INSERT INTO `sys_role_menu` VALUES (8795, 1, 285);
INSERT INTO `sys_role_menu` VALUES (8796, 1, 286);
INSERT INTO `sys_role_menu` VALUES (8797, 1, 287);
INSERT INTO `sys_role_menu` VALUES (8798, 1, 288);
INSERT INTO `sys_role_menu` VALUES (8799, 1, 289);
INSERT INTO `sys_role_menu` VALUES (8800, 1, 290);
INSERT INTO `sys_role_menu` VALUES (8801, 1, 161);
INSERT INTO `sys_role_menu` VALUES (8802, 1, 291);
INSERT INTO `sys_role_menu` VALUES (8803, 1, 292);
INSERT INTO `sys_role_menu` VALUES (8804, 1, 293);
INSERT INTO `sys_role_menu` VALUES (8805, 1, 294);
INSERT INTO `sys_role_menu` VALUES (8806, 1, 295);
INSERT INTO `sys_role_menu` VALUES (8807, 1, 296);
INSERT INTO `sys_role_menu` VALUES (8808, 1, 297);
INSERT INTO `sys_role_menu` VALUES (8809, 1, 298);
INSERT INTO `sys_role_menu` VALUES (8810, 1, 299);
INSERT INTO `sys_role_menu` VALUES (8811, 1, 300);
INSERT INTO `sys_role_menu` VALUES (8812, 1, 301);
INSERT INTO `sys_role_menu` VALUES (8813, 1, 302);
INSERT INTO `sys_role_menu` VALUES (8814, 1, 303);
INSERT INTO `sys_role_menu` VALUES (8815, 1, 304);
INSERT INTO `sys_role_menu` VALUES (8816, 1, 305);
INSERT INTO `sys_role_menu` VALUES (8817, 1, 306);
INSERT INTO `sys_role_menu` VALUES (8818, 1, 307);
INSERT INTO `sys_role_menu` VALUES (8819, 1, 308);
INSERT INTO `sys_role_menu` VALUES (8820, 1, 309);
INSERT INTO `sys_role_menu` VALUES (8821, 1, 310);
INSERT INTO `sys_role_menu` VALUES (8822, 1, 311);
INSERT INTO `sys_role_menu` VALUES (8823, 1, 312);
INSERT INTO `sys_role_menu` VALUES (8824, 1, 313);
INSERT INTO `sys_role_menu` VALUES (8825, 1, 314);
INSERT INTO `sys_role_menu` VALUES (8826, 1, 315);
INSERT INTO `sys_role_menu` VALUES (8827, 1, 316);
INSERT INTO `sys_role_menu` VALUES (8828, 1, 317);
INSERT INTO `sys_role_menu` VALUES (8829, 1, 318);
INSERT INTO `sys_role_menu` VALUES (8830, 1, 319);
INSERT INTO `sys_role_menu` VALUES (8831, 1, 320);
INSERT INTO `sys_role_menu` VALUES (8832, 1, 321);
INSERT INTO `sys_role_menu` VALUES (8833, 1, 322);
INSERT INTO `sys_role_menu` VALUES (8834, 1, 323);
INSERT INTO `sys_role_menu` VALUES (8835, 1, 324);
INSERT INTO `sys_role_menu` VALUES (8836, 1, 325);
INSERT INTO `sys_role_menu` VALUES (8837, 1, 326);
INSERT INTO `sys_role_menu` VALUES (8838, 1, 327);
INSERT INTO `sys_role_menu` VALUES (8839, 1, 328);
INSERT INTO `sys_role_menu` VALUES (8840, 1, 329);
INSERT INTO `sys_role_menu` VALUES (8841, 1, 330);
INSERT INTO `sys_role_menu` VALUES (8842, 1, 331);
INSERT INTO `sys_role_menu` VALUES (8843, 1, 332);

-- ----------------------------
-- Table structure for `sys_server`
-- ----------------------------
DROP TABLE IF EXISTS `sys_server`;
CREATE TABLE `sys_server`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '服务器名称',
`host` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '服务器地址',
`port` int NOT NULL DEFAULT 22 COMMENT 'SSH端口',
`username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户名',
`auth_type` tinyint NOT NULL DEFAULT 1 COMMENT '认证方式：1-密码 2-密钥',
`password` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '密码（加密存储）',
`private_key` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '私钥内容',
`passphrase` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '私钥密码（加密存储）',
`description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '描述',
`status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
`sort` int NOT NULL DEFAULT 0 COMMENT '排序',
`last_connect_time` datetime NULL DEFAULT NULL COMMENT '最后连接时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建者',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新者',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`deleted` tinyint NOT NULL DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE,
  INDEX `idx_deleted`(`deleted` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '服务器管理表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_server
-- ----------------------------
INSERT INTO `sys_server` VALUES (1, '测试服务器', '47.108.187.25', 22, 'root', 1, '__REDACTED__', '', '', '', 1, 0, '2026-02-07 09:52:27', 1, '2026-01-31 23:46:31', 1, '2026-02-07 09:52:27', 0);

-- ----------------------------
-- Table structure for `sys_sms_log`
-- ----------------------------
DROP TABLE IF EXISTS `sys_sms_log`;
CREATE TABLE `sys_sms_log`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '手机号',
`content` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '短信内容/验证码',
`sms_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'verify_code' COMMENT '短信类型：verify_code-验证码 notice-通知 marketing-营销',
`template_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '模板ID',
`template_params` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '模板参数（JSON格式）',
`provider` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '服务商：aliyun-阿里云 tencent-腾讯云 console-控制台',
`status` tinyint NULL DEFAULT 0 COMMENT '发送状态：0-发送中 1-成功 2-失败',
`result_msg` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '发送结果消息',
`biz_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '服务商返回的消息ID',
`send_time` datetime NULL DEFAULT NULL COMMENT '发送时间',
`user_id` bigint NULL DEFAULT NULL COMMENT '用户ID',
`biz_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '业务类型：login-登录 register-注册 reset_password-重置密码 bind_phone-绑定手机',
`ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT 'IP地址',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_phone`(`phone` ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_send_time`(`send_time` ASC) USING BTREE,
  INDEX `idx_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '短信发送记录表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_sms_log
-- ----------------------------
INSERT INTO `sys_sms_log` VALUES (1, '18483678377', '473578', 'verify_code', NULL, NULL, 'aliyun', 1, 'OK', '140425370962994532^0', '2026-02-13 14:09:54', NULL, 'login', NULL, '2026-02-13 14:09:54');
INSERT INTO `sys_sms_log` VALUES (2, '18483678377', '358716', 'verify_code', NULL, NULL, 'aliyun', 2, '该账号下找不到对应签名', NULL, '2026-02-13 15:51:43', NULL, 'login', '127.0.0.1', '2026-02-13 15:51:43');

-- ----------------------------
-- Table structure for `sys_user`
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`dept_id` bigint NULL DEFAULT NULL COMMENT '部门id',
`username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户名',
`password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '密码',
`nickname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '昵称',
`avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '头像',
`email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '邮箱',
`phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '手机号',
`gender` tinyint NULL DEFAULT 0 COMMENT '性别(0-未知 1-男 2-女)',
`status` tinyint NULL DEFAULT 1 COMMENT '状态(0-禁用 1-启用)',
`is_quit` tinyint NULL DEFAULT 0 COMMENT '是否离职(0-否 1-是)',
`remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '备注',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`update_time` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
`update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
`user_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'admin' COMMENT '用户类型(admin-后台管理员 pc-PC前台用户 app-App/小程序用户)',
`open_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '微信openId(微信扫码登录时使用)',
`deleted` tinyint NULL DEFAULT 0 COMMENT '删除标识(0-未删除 1-已删除)',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_username`(`username` ASC) USING BTREE,
  INDEX `idx_open_id`(`open_id` ASC) USING BTREE,
  INDEX `idx_user_type`(`user_type` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 24 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_user
-- ----------------------------
INSERT INTO `sys_user` VALUES (1, 1, 'admin', '$2a$10$zqQcoU.zIWJQy42DAzxj5usRR9RLNx.HZ729ocAzSgnB90/sI3s5u', '超级管理员', '', '850994281@qq.com', '18888888888', 1, 1, 0, '111', '2026-01-29 22:42:08', '2026-02-24 22:02:00', NULL, 1, 'admin', NULL, 0);
INSERT INTO `sys_user` VALUES (2, 4, 'test', '$2a$10$kTn0Z9BPDnOAU1qB.sJrF.unLh4bbj9FQ7tVsG4AtSBQXFs1V/ewq', 'test', NULL, '111@qq.com', '1888888881', 1, 1, 1, '', '2026-01-29 23:21:12', '2026-02-28 23:02:26', 1, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (3, 2, 'mars11', '$2a$10$goR4f6wAzry8a6jTrWHDGeI7Fiq2SovcXYrVprcoRgC6mCnK1fM4G', 'mars11', NULL, 'wqexpore@163.com', '18888888881', 1, 1, 0, '', '2026-01-29 23:21:12', '2026-02-08 16:44:59', 1, 1, 'admin', NULL, 0);
INSERT INTO `sys_user` VALUES (4, 3, 'lisi', '$2a$10$4pFtybVAOwePb9T9LsnYU.OJzo7PIOf3ZxU4MOylb03D6MUK/bSb6', 'lisi', NULL, NULL, NULL, 0, 1, 0, NULL, '2026-01-31 20:49:34', '2026-01-31 20:49:34', NULL, 1, 'admin', NULL, 0);
INSERT INTO `sys_user` VALUES (5, 2, 'mars666', '$2a$10$i3ztgmo5kmPow2ro8Kuxouq0yLnv/JM4huDoZdVIeDp3ErKtBSxiS', 'mars666', NULL, 'wqexpore@163.com', '18888888882', 1, 1, 0, NULL, '2026-01-31 22:30:46', '2026-02-25 16:55:31', 5, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (6, 2, 'test01', '$2a$10$ML3nX/GYeLWlCMroXCmSv.i61Rnu9/UEKpWE8uXRi6ly86stXYZqu', 'test01', NULL, NULL, NULL, 0, 1, 0, NULL, '2026-02-07 16:01:02', '2026-02-24 13:38:01', NULL, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (10, 2, 'Mars', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 1, 0, NULL, '2026-02-08 16:46:40', '2026-02-08 16:46:40', NULL, 10, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 0);
INSERT INTO `sys_user` VALUES (11, 8, 'mars02', '$2a$10$c/D7zIqiJQ.f9k/in6NGe.j7hRBdRChNKu4OGjSGee4ZN0f6MwW4O', 'mars02', NULL, '111@qq.com', '18888888888', 1, 1, 0, '', '2026-02-09 14:31:09', '2026-02-25 16:55:30', 5, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (13, 2, 'Mars111', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 0, 1, NULL, '2026-02-08 16:46:40', '2026-02-25 16:55:30', NULL, 1, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 1);
INSERT INTO `sys_user` VALUES (14, 2, 'Mars222', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 1, 0, NULL, '2026-02-08 16:46:40', '2026-02-25 16:55:31', NULL, 1, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 1);
INSERT INTO `sys_user` VALUES (15, 2, 'Mars333', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 1, 0, NULL, '2026-02-08 16:46:40', '2026-02-25 16:55:31', NULL, 1, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 1);
INSERT INTO `sys_user` VALUES (16, 2, 'Mars444', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 1, 0, NULL, '2026-02-08 16:46:40', '2026-02-25 16:55:31', NULL, 1, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 1);
INSERT INTO `sys_user` VALUES (17, 2, 'Mars555', '$2a$10$zr4zrzbZasuckIfyahZiL.LUgzgoCARw9ocLTXV.HsV7fU9PxgMa.', 'Mars', 'http://m8e8f9e2.natappfree.cc/api/files/images/2026/02/08/3008954e93634f0ebbf0d78f2fe26fc0.jpg', NULL, NULL, 0, 1, 0, NULL, '2026-02-08 16:46:40', '2026-02-25 16:55:31', NULL, 1, 'app', 'opzUF43XlvnVUw5S9qS2cI6L7p9M', 1);
INSERT INTO `sys_user` VALUES (18, 2, '11', '$2a$10$WF34d4VPwUbL4zWfJKmE5OgbIbjgKtaFjy6zUBulu3ZSSQDEk2A6u', '11', NULL, '111@qq.com', '18483689569', 1, 1, 0, NULL, '2026-02-25 15:57:37', '2026-02-25 16:14:10', 1, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (19, 2, '222', '$2a$10$vIsmaa111WDaZGNmM2cc6unBgXEADOGEsKCy4BBOMbae56nq.KrHC', '222', NULL, '111@qq.com', '18483689511', 1, 1, 0, NULL, '2026-02-25 16:00:18', '2026-02-25 16:13:45', 1, 1, 'admin', NULL, 1);
INSERT INTO `sys_user` VALUES (23, 2, '121', '$2a$10$3yZ0uuskfjBSyJHokoXCG.AbQtXq6n2Z3ZSxF5lWtQ8HxmbnwSDeq', '1212', NULL, '11112@qq.com', '18483686589', 1, 1, 0, NULL, '2026-02-25 16:16:18', '2026-02-25 16:28:46', 1, 1, 'admin', NULL, 1);

-- ----------------------------
-- Table structure for `sys_user_blacklist`
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_blacklist`;
CREATE TABLE `sys_user_blacklist`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`user_id` bigint NOT NULL COMMENT '用户ID',
`blocked_user_id` bigint NOT NULL COMMENT '被拉黑的用户ID',
`create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '拉黑时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_blocked`(`user_id` ASC, `blocked_user_id` ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_blocked_user_id`(`blocked_user_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户黑名单表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_user_blacklist
-- ----------------------------
-- （该表无种子数据）

-- ----------------------------
-- Table structure for `sys_user_notice`
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_notice`;
CREATE TABLE `sys_user_notice`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`user_id` bigint NOT NULL COMMENT '用户ID',
`notice_id` bigint NOT NULL COMMENT '通知ID',
`is_read` tinyint NULL DEFAULT 0 COMMENT '是否已读(0未读 1已读)',
`read_time` datetime NULL DEFAULT NULL COMMENT '阅读时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_notice`(`user_id` ASC, `notice_id` ASC) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_notice_id`(`notice_id` ASC) USING BTREE,
  INDEX `idx_is_read`(`is_read` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 37 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户通知关联表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_user_notice
-- ----------------------------
INSERT INTO `sys_user_notice` VALUES (36, 1, 17, 0, NULL);

-- ----------------------------
-- Table structure for `sys_user_post`
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_post`;
CREATE TABLE `sys_user_post`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`user_id` bigint NOT NULL COMMENT '用户ID',
`post_id` bigint NOT NULL COMMENT '岗位ID',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_post_id`(`post_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 17 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户岗位关联表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_user_post
-- ----------------------------
INSERT INTO `sys_user_post` VALUES (5, 10, 4);
INSERT INTO `sys_user_post` VALUES (15, 1, 1);
INSERT INTO `sys_user_post` VALUES (16, 1, 2);

-- ----------------------------
-- Table structure for `sys_user_role`
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role`  (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`user_id` bigint NOT NULL COMMENT '用户ID',
`role_id` bigint NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_user_id`(`user_id` ASC) USING BTREE,
  INDEX `idx_role_id`(`role_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 47 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户角色关联表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of sys_user_role
-- ----------------------------
INSERT INTO `sys_user_role` VALUES (9, 4, 2);
INSERT INTO `sys_user_role` VALUES (25, 7, 2);
INSERT INTO `sys_user_role` VALUES (37, 10, 2);
INSERT INTO `sys_user_role` VALUES (45, 1, 1);
INSERT INTO `sys_user_role` VALUES (46, 3, 2);

SET FOREIGN_KEY_CHECKS = 1;

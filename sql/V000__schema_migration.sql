-- V000：迁移版本追踪表（必须最先执行）
CREATE TABLE IF NOT EXISTS `schema_migration` (
  `version` varchar(32) NOT NULL COMMENT '迁移版本',
  `checksum` varchar(64) NOT NULL COMMENT '脚本校验和',
  `status` varchar(16) NOT NULL COMMENT '执行状态',
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
  PRIMARY KEY (`version`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '数据库版本迁移记录';

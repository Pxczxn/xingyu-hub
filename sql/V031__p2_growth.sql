-- V031：P2 增长与生态（运营精选、开放 API Token）
-- 可重复执行：表/索引已存在时自动跳过
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `featured_content` (
  `id` varchar(36) NOT NULL COMMENT '精选标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/SERIES',
  `object_id` varchar(36) NOT NULL COMMENT '对象标识',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序（越小越靠前）',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/ARCHIVED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_featured_content_object` (`object_type`,`object_id`),
  KEY `idx_featured_content_status` (`status`,`sort_order`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='运营精选内容';

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'featured_content'
     AND INDEX_NAME = 'uk_featured_content_object') = 0,
  'ALTER TABLE `featured_content` ADD UNIQUE KEY `uk_featured_content_object` (`object_type`,`object_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'featured_content'
     AND INDEX_NAME = 'idx_featured_content_status') = 0,
  'ALTER TABLE `featured_content` ADD KEY `idx_featured_content_status` (`status`,`sort_order`,`created_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `community_api_token` (
  `id` varchar(36) NOT NULL COMMENT 'Token 记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '所属用户',
  `name` varchar(128) NOT NULL COMMENT 'Token 名称',
  `token_prefix` varchar(16) NOT NULL COMMENT 'Token 前缀（展示用）',
  `token_hash` varchar(64) NOT NULL COMMENT 'Token SHA-256 哈希',
  `scopes` varchar(256) NOT NULL COMMENT '权限域，逗号分隔',
  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/REVOKED',
  `last_used_at` timestamp NULL COMMENT '最近使用时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `revoked_at` timestamp NULL COMMENT '撤销时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_api_token_hash` (`token_hash`),
  KEY `idx_community_api_token_user` (`user_id`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区开放 API Token';

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'community_api_token'
     AND INDEX_NAME = 'uk_community_api_token_hash') = 0,
  'ALTER TABLE `community_api_token` ADD UNIQUE KEY `uk_community_api_token_hash` (`token_hash`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'community_api_token'
     AND INDEX_NAME = 'idx_community_api_token_user') = 0,
  'ALTER TABLE `community_api_token` ADD KEY `idx_community_api_token_user` (`user_id`,`status`,`created_at`)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

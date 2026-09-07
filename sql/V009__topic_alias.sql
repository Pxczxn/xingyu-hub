-- V009：话题别名（M2 文章话题路由）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `topic_alias` (
  `id` varchar(36) NOT NULL COMMENT '别名记录标识',
  `topic_id` varchar(36) NOT NULL COMMENT '所属话题标识',
  `alias_slug` varchar(64) NOT NULL COMMENT '历史或别名 Slug',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_topic_alias_slug` (`alias_slug`),
  KEY `idx_topic_alias_topic` (`topic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='话题别名映射';

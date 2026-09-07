-- V018：SEO 元数据（M7）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `seo_metadata` (
  `id` varchar(36) NOT NULL COMMENT '元数据标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/SERIES 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `title` varchar(256) DEFAULT NULL COMMENT 'SEO 标题',
  `description` varchar(1024) DEFAULT NULL COMMENT 'SEO 描述',
  `canonical_url` varchar(512) DEFAULT NULL COMMENT '规范链接',
  `og_image_url` varchar(512) DEFAULT NULL COMMENT 'Open Graph 图片',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_seo_metadata_object` (`object_type`,`object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='SEO 元数据';

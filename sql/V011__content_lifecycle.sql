-- V011：内容生命周期回收站（M3）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `content_trash` (
  `id` varchar(36) NOT NULL COMMENT '回收记录标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `owner_id` varchar(36) NOT NULL COMMENT '所有者用户标识',
  `trashed_at` timestamp NOT NULL COMMENT '移入回收站时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_content_trash_object` (`object_type`,`object_id`),
  KEY `idx_content_trash_owner` (`owner_id`,`trashed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='内容回收站';

-- V013：社交互动（M3）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `content_like` (
  `id` varchar(36) NOT NULL COMMENT '喜欢记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/MOMENT 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_content_like` (`user_id`,`object_type`,`object_id`),
  KEY `idx_content_like_object` (`object_type`,`object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='内容喜欢';

CREATE TABLE IF NOT EXISTS `collection` (
  `id` varchar(36) NOT NULL COMMENT '收藏夹标识',
  `owner_id` varchar(36) NOT NULL COMMENT '所有者用户标识',
  `name` varchar(128) NOT NULL COMMENT '收藏夹名称',
  `visibility` varchar(32) NOT NULL DEFAULT 'PRIVATE' COMMENT '可见性：PUBLIC/PRIVATE',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_collection_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户收藏夹';

CREATE TABLE IF NOT EXISTS `collection_entry` (
  `id` varchar(36) NOT NULL COMMENT '收藏条目标识',
  `collection_id` varchar(36) NOT NULL COMMENT '收藏夹标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_collection_entry` (`collection_id`,`object_type`,`object_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收藏夹条目';

CREATE TABLE IF NOT EXISTS `creator_follow` (
  `id` varchar(36) NOT NULL COMMENT '关注记录标识',
  `follower_id` varchar(36) NOT NULL COMMENT '关注者用户标识',
  `creator_id` varchar(36) NOT NULL COMMENT '被关注创作者标识',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_creator_follow` (`follower_id`,`creator_id`),
  KEY `idx_creator_follow_creator` (`creator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作者关注';

CREATE TABLE IF NOT EXISTS `topic_follow` (
  `id` varchar(36) NOT NULL COMMENT '关注记录标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `topic_id` varchar(36) NOT NULL COMMENT '话题标识',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_topic_follow` (`user_id`,`topic_id`),
  KEY `idx_topic_follow_topic` (`topic_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='话题关注';

CREATE TABLE IF NOT EXISTS `comment` (
  `id` varchar(36) NOT NULL COMMENT '评论标识',
  `object_type` varchar(32) NOT NULL COMMENT '对象类型：ARTICLE/MOMENT 等',
  `object_id` varchar(36) NOT NULL COMMENT '对象稳定标识',
  `author_id` varchar(36) NOT NULL COMMENT '作者用户标识',
  `parent_id` varchar(36) DEFAULT NULL COMMENT '父评论标识',
  `body` text NOT NULL COMMENT '评论正文',
  `status` varchar(32) NOT NULL DEFAULT 'VISIBLE' COMMENT '状态：VISIBLE/HIDDEN/DELETED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_comment_object` (`object_type`,`object_id`,`created_at`),
  KEY `idx_comment_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='评论';

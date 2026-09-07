-- V033：用户屏蔽、系列订阅、举报补充、星系入群申请
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `user_block` (
  `id` varchar(36) NOT NULL COMMENT '屏蔽记录标识',
  `blocker_id` varchar(36) NOT NULL COMMENT '屏蔽发起用户',
  `blocked_id` varchar(36) NOT NULL COMMENT '被屏蔽用户',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_block` (`blocker_id`,`blocked_id`),
  KEY `idx_user_block_blocked` (`blocked_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区用户屏蔽';

CREATE TABLE IF NOT EXISTS `series_subscription` (
  `id` varchar(36) NOT NULL COMMENT '订阅标识',
  `user_id` varchar(36) NOT NULL COMMENT '用户标识',
  `series_id` varchar(36) NOT NULL COMMENT '系列标识',
  `created_at` timestamp NOT NULL COMMENT '订阅时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_series_subscription` (`user_id`,`series_id`),
  KEY `idx_series_subscription_series` (`series_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系列追更订阅';

CREATE TABLE IF NOT EXISTS `report_supplement` (
  `id` varchar(36) NOT NULL COMMENT '补充材料标识',
  `report_id` varchar(36) NOT NULL COMMENT '举报标识',
  `author_id` varchar(36) NOT NULL COMMENT '提交用户',
  `body` text NOT NULL COMMENT '补充说明',
  `created_at` timestamp NOT NULL COMMENT '提交时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_report_supplement_report` (`report_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='举报补充材料';

CREATE TABLE IF NOT EXISTS `galaxy_join_request` (
  `id` varchar(36) NOT NULL COMMENT '申请标识',
  `galaxy_id` varchar(36) NOT NULL COMMENT '星系标识',
  `user_id` varchar(36) NOT NULL COMMENT '申请用户',
  `message` varchar(512) DEFAULT NULL COMMENT '申请说明',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/APPROVED/REJECTED',
  `created_at` timestamp NOT NULL COMMENT '申请时间（UTC）',
  `resolved_at` timestamp NULL COMMENT '处理时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_galaxy_join_request_pending` (`galaxy_id`,`user_id`,`status`),
  KEY `idx_galaxy_join_request_galaxy` (`galaxy_id`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星系入群申请';

ALTER TABLE `galaxy`
  ADD COLUMN `join_mode` varchar(32) NOT NULL DEFAULT 'OPEN' COMMENT '入群模式：OPEN/APPROVAL' AFTER `official`;

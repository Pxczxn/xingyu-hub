-- V017：治理与申诉（M6）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `report` (
  `id` varchar(36) NOT NULL COMMENT '举报标识',
  `reporter_id` varchar(36) NOT NULL COMMENT '举报人用户标识',
  `object_type` varchar(32) NOT NULL COMMENT '举报对象类型',
  `object_id` varchar(36) NOT NULL COMMENT '举报对象标识',
  `reason` varchar(64) NOT NULL COMMENT '举报原因代码',
  `detail` varchar(1024) DEFAULT NULL COMMENT '补充说明',
  `status` varchar(32) NOT NULL DEFAULT 'SUBMITTED' COMMENT '状态：SUBMITTED/ACCEPTED/REJECTED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_report_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户举报';

CREATE TABLE IF NOT EXISTS `moderation_case` (
  `id` varchar(36) NOT NULL COMMENT '治理案件标识',
  `report_id` varchar(36) NOT NULL COMMENT '关联举报标识',
  `status` varchar(32) NOT NULL DEFAULT 'OPEN' COMMENT '状态：OPEN/DECIDED/CLOSED',
  `assigned_to` varchar(36) DEFAULT NULL COMMENT '指派审核员标识',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moderation_case_report` (`report_id`),
  KEY `idx_moderation_case_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='治理案件';

CREATE TABLE IF NOT EXISTS `moderation_decision` (
  `id` varchar(36) NOT NULL COMMENT '治理决定标识',
  `case_id` varchar(36) NOT NULL COMMENT '案件标识',
  `decision` varchar(32) NOT NULL COMMENT '决定：UPHELD/DISMISSED',
  `decided_by` varchar(36) NOT NULL COMMENT '决定人标识',
  `comment` varchar(1024) DEFAULT NULL COMMENT '决定说明',
  `decided_at` timestamp NOT NULL COMMENT '决定时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moderation_decision_case` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='治理决定';

CREATE TABLE IF NOT EXISTS `moderation_measure` (
  `id` varchar(36) NOT NULL COMMENT '治理措施标识',
  `decision_id` varchar(36) NOT NULL COMMENT '决定标识',
  `measure_type` varchar(32) NOT NULL COMMENT '措施类型',
  `target_type` varchar(32) NOT NULL COMMENT '目标类型',
  `target_id` varchar(36) NOT NULL COMMENT '目标标识',
  `expires_at` timestamp DEFAULT NULL COMMENT '过期时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_moderation_measure_decision` (`decision_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='治理措施';

CREATE TABLE IF NOT EXISTS `appeal` (
  `id` varchar(36) NOT NULL COMMENT '申诉标识',
  `case_id` varchar(36) NOT NULL COMMENT '案件标识',
  `appellant_id` varchar(36) NOT NULL COMMENT '申诉人用户标识',
  `body` text NOT NULL COMMENT '申诉正文',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '状态：PENDING/REVIEWED',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  KEY `idx_appeal_case` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='治理申诉';

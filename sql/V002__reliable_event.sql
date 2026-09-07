-- V002：可靠事件表（M00-S002）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `reliable_event` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `event_id` varchar(64) NOT NULL COMMENT '事件唯一标识（幂等键）',
  `event_type` varchar(128) NOT NULL COMMENT '事件类型',
  `aggregate_type` varchar(64) NOT NULL COMMENT '聚合根类型',
  `aggregate_id` varchar(64) NOT NULL COMMENT '聚合根标识',
  `payload` text NOT NULL COMMENT '事件载荷 JSON',
  `status` varchar(32) NOT NULL COMMENT '处理状态：PENDING/PROCESSING/SUCCESS/FAILED/ISOLATED',
  `attempt_count` int NOT NULL COMMENT '已尝试次数',
  `max_attempts` int NOT NULL COMMENT '最大尝试次数',
  `next_attempt_at` timestamp NULL DEFAULT NULL COMMENT '下次重试时间',
  `lease_until` timestamp NULL DEFAULT NULL COMMENT '消费租约截止时间',
  `last_error` varchar(2000) DEFAULT NULL COMMENT '最近一次错误信息',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  `updated_at` timestamp NOT NULL COMMENT '更新时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reliable_event_id` (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='可靠事件表';

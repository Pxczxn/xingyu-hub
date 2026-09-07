-- V004：社区运营种子数据（Topic/Galaxy/保留词/系统参数，M00-F003）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `topic` (
  `id` varchar(36) NOT NULL COMMENT '话题稳定标识',
  `seed_key` varchar(64) NOT NULL COMMENT '种子键（幂等）',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `name` varchar(128) NOT NULL COMMENT '显示名称',
  `status` varchar(32) NOT NULL COMMENT '状态：ENABLED/DISABLED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_topic_seed` (`seed_key`),
  UNIQUE KEY `uk_topic_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='公共话题';

CREATE TABLE IF NOT EXISTS `galaxy` (
  `id` varchar(36) NOT NULL COMMENT '星系稳定标识',
  `seed_key` varchar(64) NOT NULL COMMENT '种子键（幂等）',
  `slug` varchar(64) NOT NULL COMMENT 'URL 别名',
  `name` varchar(128) NOT NULL COMMENT '显示名称',
  `official` tinyint(1) NOT NULL COMMENT '是否官方星系',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_galaxy_seed` (`seed_key`),
  UNIQUE KEY `uk_galaxy_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='星系';

CREATE TABLE IF NOT EXISTS `reserved_word` (
  `word` varchar(64) NOT NULL COMMENT '保留词',
  `category` varchar(32) NOT NULL COMMENT '类别：username/slug',
  PRIMARY KEY (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保留词表';

CREATE TABLE IF NOT EXISTS `system_parameter` (
  `namespace` varchar(32) NOT NULL COMMENT '命名空间：SYSTEM/COMMUNITY',
  `param_key` varchar(128) NOT NULL COMMENT '参数键',
  `param_value` varchar(1024) NOT NULL COMMENT '参数值',
  PRIMARY KEY (`namespace`,`param_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统参数';

INSERT IGNORE INTO `topic` (`id`, `seed_key`, `slug`, `name`, `status`) VALUES
('01900000-0000-7000-8000-000000000001', 'general', 'general', '综合', 'ENABLED'),
('01900000-0000-7000-8000-000000000002', 'announcement', 'announcement', '公告', 'ENABLED');

INSERT IGNORE INTO `galaxy` (`id`, `seed_key`, `slug`, `name`, `official`) VALUES
('01900000-0000-7000-8000-000000000101', 'official-xingyu', 'xingyu-official', '星语', 1);

INSERT IGNORE INTO `reserved_word` (`word`, `category`) VALUES
('admin', 'username'),
('administrator', 'username'),
('api', 'slug'),
('galaxy', 'slug'),
('login', 'slug'),
('official', 'username'),
('root', 'username'),
('settings', 'slug'),
('support', 'username'),
('system', 'username'),
('xingyu', 'username');

INSERT IGNORE INTO `system_parameter` (`namespace`, `param_key`, `param_value`) VALUES
('COMMUNITY', 'registration.open', 'true'),
('COMMUNITY', 'review.required', 'true'),
('SYSTEM', 'mail.provider', 'unconfigured'),
('SYSTEM', 'oss.provider', 'unconfigured');

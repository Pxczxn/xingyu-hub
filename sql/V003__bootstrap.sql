-- V003：平台 Bootstrap 与管理员域表（M00-F003）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_account` (
  `id` varchar(36) NOT NULL COMMENT '管理员稳定标识',
  `username` varchar(64) NOT NULL COMMENT '登录用户名',
  `password_hash` varchar(100) NOT NULL COMMENT 'BCrypt 密码摘要',
  `kind` varchar(32) NOT NULL COMMENT '账号类型：PLATFORM/RECOVERY',
  `status` varchar(32) NOT NULL COMMENT '账号状态：ACTIVE/REVOKED',
  `must_change_password` tinyint(1) NOT NULL COMMENT '是否必须修改密码',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台管理员账号';

CREATE TABLE IF NOT EXISTS `admin_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `actor` varchar(64) NOT NULL COMMENT '操作者',
  `action` varchar(64) NOT NULL COMMENT '操作动作',
  `reason` varchar(500) DEFAULT NULL COMMENT '原因说明',
  `target_id` varchar(36) DEFAULT NULL COMMENT '目标对象标识',
  `result` varchar(32) NOT NULL COMMENT '操作结果',
  `created_at` timestamp NOT NULL COMMENT '记录时间（UTC）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='管理端审计';

CREATE TABLE IF NOT EXISTS `admin_capability` (
  `admin_id` varchar(36) NOT NULL COMMENT '管理员标识',
  `capability` varchar(64) NOT NULL COMMENT '能力编码',
  `allowed` tinyint(1) NOT NULL COMMENT '是否允许',
  PRIMARY KEY (`admin_id`,`capability`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='管理员能力矩阵';

CREATE TABLE IF NOT EXISTS `auth_security_event` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user_id` varchar(36) DEFAULT NULL COMMENT '关联用户标识（可空）',
  `event_type` varchar(64) NOT NULL COMMENT '事件类型：REGISTER_SUCCESS/LOGIN_FAILED 等',
  `detail` varchar(500) DEFAULT NULL COMMENT '事件详情',
  `ip_hash` varchar(64) DEFAULT NULL COMMENT '来源 IP 哈希',
  `created_at` timestamp NOT NULL COMMENT '记录时间（UTC）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='认证安全审计';

CREATE TABLE IF NOT EXISTS `bootstrap_state` (
  `id` tinyint NOT NULL COMMENT '固定主键，恒为 1',
  `closed` tinyint(1) NOT NULL COMMENT 'Bootstrap 是否已关闭',
  `closed_at` timestamp NULL DEFAULT NULL COMMENT '关闭时间（UTC）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台初始化状态';

CREATE TABLE IF NOT EXISTS `recovery_grant` (
  `id` varchar(36) NOT NULL COMMENT '授权记录标识',
  `admin_id` varchar(36) NOT NULL COMMENT '恢复管理员标识',
  `reason` varchar(500) NOT NULL COMMENT '授权原因',
  `expires_at` timestamp NOT NULL COMMENT '过期时间（UTC）',
  `revoked_at` timestamp NULL DEFAULT NULL COMMENT '撤销时间（UTC）',
  `created_at` timestamp NOT NULL COMMENT '创建时间（UTC）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='恢复管理员授权';

INSERT IGNORE INTO `bootstrap_state` (`id`, `closed`) VALUES (1, 0);

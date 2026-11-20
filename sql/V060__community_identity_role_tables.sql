-- V060：社区日常授权关系 + 风险交叉核验关联（仅结构，不切换认证）
--
-- community_user_role：community_user 与 sys_role 的日常授权。
--   本批不把 community_user.role 当授权依据，也不从 sys_user_role 猜测映射导入。
-- identity_verify_link：仅在风险规则触发时把社区身份与历史 sys_user 档案交叉核验。
--   不是日常登录关联；本批不写入任何关联行。
--
-- ACTIVE 唯一复用 V047 手法：MySQL 8 不支持部分索引，用 STORED 生成列 + UNIQUE。
--   ACTIVE 时生成列等于对应 ID，REVOKED 时为 NULL；唯一索引允许多个 NULL，故历史可保留。
--
-- 外键 ON DELETE RESTRICT / ON UPDATE RESTRICT：父行（用户或角色）在仍有子行时不能删改键，
--   避免误删带走授权或核验历史。社区表多数无外键（如 V056），此处按本批要求显式建立。
--
-- 可重复执行：CREATE TABLE IF NOT EXISTS。
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `community_user_role` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键（UUID）',
  `community_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '社区用户（community_user.id）',
  `role_id` bigint NOT NULL COMMENT '角色（sys_role.id）',
  `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '授予操作者（community_user.id）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '授予时间（UTC）',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_community_user_role` (`community_user_id`, `role_id`),
  CONSTRAINT `fk_community_user_role_user`
    FOREIGN KEY (`community_user_id`) REFERENCES `community_user` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_community_user_role_role`
    FOREIGN KEY (`role_id`) REFERENCES `sys_role` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区用户日常角色授权';

CREATE TABLE IF NOT EXISTS `identity_verify_link` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '主键（UUID）',
  `community_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '社区用户（community_user.id）',
  `sys_user_id` bigint NOT NULL COMMENT '历史档案（sys_user.id）',
  `status` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'ACTIVE/REVOKED',
  `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '建立操作者（community_user.id）',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '建立时间（UTC）',
  `revoked_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '撤销操作者（community_user.id）',
  `revoked_at` timestamp NULL DEFAULT NULL COMMENT '撤销时间（UTC）',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '备注',
  `active_community_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
    GENERATED ALWAYS AS (CASE WHEN `status` = 'ACTIVE' THEN `community_user_id` ELSE NULL END) STORED
    COMMENT '仅 ACTIVE 时等于 community_user_id，用于一侧有效唯一',
  `active_sys_user_id` bigint
    GENERATED ALWAYS AS (CASE WHEN `status` = 'ACTIVE' THEN `sys_user_id` ELSE NULL END) STORED
    COMMENT '仅 ACTIVE 时等于 sys_user_id，用于一侧有效唯一',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_identity_verify_link_active_community` (`active_community_user_id`),
  UNIQUE KEY `uk_identity_verify_link_active_sys_user` (`active_sys_user_id`),
  KEY `idx_identity_verify_link_community` (`community_user_id`),
  KEY `idx_identity_verify_link_sys_user` (`sys_user_id`),
  CONSTRAINT `chk_identity_verify_link_status`
    CHECK (`status` IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT `fk_identity_verify_link_community`
    FOREIGN KEY (`community_user_id`) REFERENCES `community_user` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_identity_verify_link_sys_user`
    FOREIGN KEY (`sys_user_id`) REFERENCES `sys_user` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='社区身份与历史档案的风险交叉核验关联';

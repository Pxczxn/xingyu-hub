package top.pxczxn.xingyu;

import org.springframework.jdbc.core.JdbcTemplate;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

/**
 * 集成测试辅助：确保社区注册开关处于开启状态。
 */
final class CommunityTestSupport {

    private CommunityTestSupport() {
    }

    static void ensureRegistrationOpen(SysConfigGroupService configGroupService) {
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.saveConfig(
                "login",
                "{\"captchaEnabled\":false,\"captchaType\":\"image\",\"maxRetryCount\":5,\"lockTime\":30,\"rememberMe\":true,\"singleLogin\":false}");
        configGroupService.refreshCache();
    }

    static void ensureGrowthSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `featured_content` (
                  `id` varchar(36) NOT NULL,
                  `object_type` varchar(32) NOT NULL,
                  `object_id` varchar(36) NOT NULL,
                  `sort_order` int NOT NULL DEFAULT 0,
                  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
                  `created_at` timestamp NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_featured_content_object` (`object_type`,`object_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `community_api_token` (
                  `id` varchar(36) NOT NULL,
                  `user_id` varchar(36) NOT NULL,
                  `name` varchar(128) NOT NULL,
                  `token_prefix` varchar(16) NOT NULL,
                  `token_hash` varchar(64) NOT NULL,
                  `scopes` varchar(256) NOT NULL,
                  `status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
                  `last_used_at` timestamp NULL,
                  `created_at` timestamp NOT NULL,
                  `revoked_at` timestamp NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_community_api_token_hash` (`token_hash`),
                  KEY `idx_community_api_token_user` (`user_id`,`status`,`created_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
    }

    static void ensureSocialGapSchema(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `user_block` (
                  `id` varchar(36) NOT NULL,
                  `blocker_id` varchar(36) NOT NULL,
                  `blocked_id` varchar(36) NOT NULL,
                  `created_at` timestamp NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_user_block` (`blocker_id`,`blocked_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `series_subscription` (
                  `id` varchar(36) NOT NULL,
                  `user_id` varchar(36) NOT NULL,
                  `series_id` varchar(36) NOT NULL,
                  `created_at` timestamp NOT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_series_subscription` (`user_id`,`series_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `report_supplement` (
                  `id` varchar(36) NOT NULL,
                  `report_id` varchar(36) NOT NULL,
                  `author_id` varchar(36) NOT NULL,
                  `body` text NOT NULL,
                  `created_at` timestamp NOT NULL,
                  PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `galaxy_join_request` (
                  `id` varchar(36) NOT NULL,
                  `galaxy_id` varchar(36) NOT NULL,
                  `user_id` varchar(36) NOT NULL,
                  `message` varchar(512) DEFAULT NULL,
                  `status` varchar(32) NOT NULL DEFAULT 'PENDING',
                  `created_at` timestamp NOT NULL,
                  `resolved_at` timestamp NULL,
                  PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS `event_registration` (
                  `id` varchar(36) NOT NULL,
                  `event_id` varchar(36) NOT NULL,
                  `user_id` varchar(36) NOT NULL,
                  `status` varchar(32) NOT NULL DEFAULT 'REGISTERED',
                  `created_at` timestamp NOT NULL,
                  `cancelled_at` timestamp NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `uk_event_registration` (`event_id`,`user_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        try {
            jdbcTemplate.execute("""
                    ALTER TABLE `galaxy`
                      ADD COLUMN `join_mode` varchar(32) NOT NULL DEFAULT 'OPEN' AFTER `official`
                    """);
        } catch (Exception ignored) {
            // column may already exist
        }
        try {
            jdbcTemplate.execute("""
                    ALTER TABLE `chat_message`
                      ADD COLUMN `recalled_at` timestamp NULL DEFAULT NULL AFTER `created_at`
                    """);
        } catch (Exception ignored) {
            // column may already exist
        }
    }
}

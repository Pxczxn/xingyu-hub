package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.config.StpInterfaceImpl;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 集成测试辅助：只负责"测试数据/配置 fixture"，<b>不负责 schema</b>。
 *
 * <p>本类曾经承担过 schema 自愈职责（{@code ensureGrowthSchema} / {@code ensureSocialGapSchema}
 * 用精简 DDL 建表、再用裸 {@code ALTER TABLE} 补列）。那段历史留下了一处真实事故：
 * 测试代码抢先落地的精简表让后续迁移的建表语句（{@code IF NOT EXISTS} 形式）全部退化成空操作，
 * 索引与注释永久缺失，而迁移台账仍显示"已应用"——即"测试全绿但结构已偏离 baseline"。
 *
 * <p>因此约定：<b>测试源码不得包含任何 schema 修改语句</b>。结构是否正确由
 * {@link TestSchemaAssertions} 以只读方式断言，结构不对就失败，绝不自动修表。
 * 该约定由 {@code TestSourceSchemaMutationGuardTest} 静态扫描强制保证，防止被重新写回。
 */
final class CommunityTestSupport {

    private CommunityTestSupport() {
    }

    /**
     * 确保社区注册/登录开关处于测试所需状态。
     *
     * <p>这是<b>测试配置 fixture</b>，操作的是 {@code sys_config_group} 的业务数据，
     * 不涉及 schema，因此继续保留。
     */
    static void ensureRegistrationOpen(SysConfigGroupService configGroupService) {
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.saveConfig(
                "login",
                "{\"captchaEnabled\":false,\"captchaType\":\"image\",\"maxRetryCount\":5,\"lockTime\":30,\"rememberMe\":true,\"singleLogin\":false}");
        configGroupService.refreshCache();
    }

    /**
     * 打开注册配置，并确认当前上下文连的是测试库 {@code xingyu_hub_test} 与 Redis DB 7。
     *
     * <p>与 {@link TestDatabaseGuard} 互补：守卫在上下文启动时拦截开发库；这里在每个用例前
     * 再核对 JDBC URL 不含 {@code /xingyu_hub?}，以及 Lettuce 使用隔离库号 7。
     */
    static void requireIsolatedTargets(
            SysConfigGroupService configGroupService,
            JdbcTemplate jdbcTemplate,
            DataSource dataSource,
            RedisConnectionFactory redisConnectionFactory) throws Exception {
        ensureRegistrationOpen(configGroupService);
        assertEquals("xingyu_hub_test", jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        try (Connection connection = dataSource.getConnection()) {
            assertEquals("xingyu_hub_test", connection.getCatalog());
            String url = connection.getMetaData().getURL();
            assertTrue(url.contains("/xingyu_hub_test"), url);
            assertFalse(url.contains("/xingyu_hub?"), url);
        }
        assertTrue(redisConnectionFactory instanceof LettuceConnectionFactory);
        assertEquals(7, ((LettuceConnectionFactory) redisConnectionFactory).getDatabase());
    }

    static final String CONSOLE_ADMIN_USERNAME = "admin";
    static final String CONSOLE_ADMIN_PASSWORD = "admin123";
    static final String CONSOLE_ADMIN_EMAIL = "admin-console@xingyu.test";
    static final String CONSOLE_ADMIN_USER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";

    /**
     * 保证测试库存在用户名为 admin、密码 admin123、持有 admin 角色的社区账号。
     * 只写数据，不改 schema。
     */
    static String ensureConsoleAdmin(JdbcTemplate jdbcTemplate) {
        Long adminRoleId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_role WHERE code = 'admin' LIMIT 1", Long.class);
        List<String> existing = jdbcTemplate.query(
                "SELECT user_id FROM community_profile WHERE username = ?",
                (rs, rowNum) -> rs.getString(1),
                CONSOLE_ADMIN_USERNAME);
        String userId = existing.isEmpty() ? null : existing.getFirst();
        if (userId == null) {
            userId = CONSOLE_ADMIN_USER_ID;
            Integer idTaken = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM community_user WHERE id = ?", Integer.class, userId);
            if (idTaken != null && idTaken == 0) {
                jdbcTemplate.update("""
                        INSERT INTO community_user
                            (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                        VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                        """, userId, CONSOLE_ADMIN_EMAIL, PasswordSupport.hash(CONSOLE_ADMIN_PASSWORD));
                jdbcTemplate.update("""
                        INSERT INTO community_profile
                            (id, user_id, username, display_name, visibility, lock_version, created_at)
                        VALUES (?, ?, ?, '管理员', 'PRIVATE', 0, NOW())
                        """, UUID.randomUUID().toString(), userId, CONSOLE_ADMIN_USERNAME);
            }
        }
        jdbcTemplate.update("""
                UPDATE community_user
                SET password_hash = ?, status = 'ACTIVE', email_verified_at = COALESCE(email_verified_at, NOW())
                WHERE id = ?
                """, PasswordSupport.hash(CONSOLE_ADMIN_PASSWORD), userId);
        Integer granted = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM community_user_role
                WHERE community_user_id = ? AND role_id = ?
                """, Integer.class, userId, adminRoleId);
        if (granted != null && granted == 0) {
            jdbcTemplate.update("""
                    INSERT INTO community_user_role (id, community_user_id, role_id, created_at)
                    VALUES (?, ?, ?, NOW())
                    """, UUID.randomUUID().toString(), userId, adminRoleId);
        }
        return userId;
    }

    static String insertActiveCommunityUser(JdbcTemplate jdbcTemplate, String username, String password) {
        String userId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, username + "@xingyu.test", PasswordSupport.hash(password));
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, display_name, visibility, lock_version, created_at)
                VALUES (?, ?, ?, ?, 'PRIVATE', 0, NOW())
                """, UUID.randomUUID().toString(), userId, username, username);
        return userId;
    }

    static void grantRole(JdbcTemplate jdbcTemplate, String communityUserId, String roleCode) {
        Long roleId = jdbcTemplate.queryForObject(
                "SELECT id FROM sys_role WHERE code = ? LIMIT 1", Long.class, roleCode);
        Integer granted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_user_role WHERE community_user_id = ? AND role_id = ?",
                Integer.class, communityUserId, roleId);
        if (granted != null && granted > 0) {
            return;
        }
        jdbcTemplate.update("""
                INSERT INTO community_user_role (id, community_user_id, role_id, created_at)
                VALUES (?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), communityUserId, roleId);
    }

    static String passwordLogin(MockMvc mockMvc, ObjectMapper objectMapper, String username, String password)
            throws Exception {
        MvcResult result = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password
                                + "\",\"clientType\":\"ADMIN\"}"))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    /**
     * 先授予 admin 以便走密码登录，签发 Token 后再撤掉 admin。用于细粒度权限矩阵。
     */
    static String loginThenRevokeAdmin(
            MockMvc mockMvc,
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate,
            String communityUserId,
            String username,
            String password) throws Exception {
        grantRole(jdbcTemplate, communityUserId, "admin");
        String token = passwordLogin(mockMvc, objectMapper, username, password);
        jdbcTemplate.update("""
                DELETE cur FROM community_user_role cur
                INNER JOIN sys_role r ON r.id = cur.role_id
                WHERE cur.community_user_id = ? AND r.code = 'admin'
                """, communityUserId);
        StpInterfaceImpl.clearPermissionCache(communityUserId);
        return token;
    }
}

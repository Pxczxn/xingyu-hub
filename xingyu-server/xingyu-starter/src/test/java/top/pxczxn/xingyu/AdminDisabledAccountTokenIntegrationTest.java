package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.config.AdminAccountStatusGate;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 禁用管理员后，旧 Sa-Token 的下一次管理请求必须被拒绝。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminDisabledAccountTokenIntegrationTest {

    private static final String PASSWORD = "admin123";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private DataSource dataSource;
    @Autowired
    private RedisConnectionFactory redisConnectionFactory;
    @Autowired
    private SysConfigGroupService configGroupService;
    @SpyBean
    private AdminAccountStatusGate accountStatusGate;

    private final List<String> createdUserIds = new ArrayList<>();

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
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

    @AfterEach
    void cleanup() {
        reset(accountStatusGate);
        for (String userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    @DisplayName("禁用后旧 Token 被拒绝，重新启用后同一 Token 仍可访问")
    void disabledAdminTokenIsRejectedUntilAccountIsEnabledAgain() throws Exception {
        String username = "p22adm" + (System.nanoTime() % 100_000_000L);
        String userId = createAdminUser(username);
        String token = login(username);

        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        int decisionsBefore = decisionCount();
        setStatus(userId, "SUSPENDED");
        assertEquals("SUSPENDED", statusOf(userId));
        assertEquals(1, adminRoleCount(userId), "禁用不得被做成撤销 admin 角色");

        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("用户已被禁用"));
        mockMvc.perform(post("/api/v1/admin/moderation/reports/missing-report/decide")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(403));
        assertEquals(decisionsBefore, decisionCount(), "被拒绝的决定请求不得写入治理决定");

        setStatus(userId, "ACTIVE");
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("未登录和无 admin 角色的账号仍按原契约拒绝")
    void anonymousAndNonAdminStayRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/moderation/reports"))
                .andExpect(jsonPath("$.code").value(401));

        String username = "p22usr" + (System.nanoTime() % 100_000_000L);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, PASSWORD);
        createdUserIds.add(userId);
        String token = CommunityTestSupport.loginThenRevokeAdmin(
                mockMvc, objectMapper, jdbcTemplate, userId, username, PASSWORD);
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("没有角色权限"));
    }

    @Test
    @DisplayName("账号状态查询失败时拒绝请求")
    void statusLookupFailureDeniesTheRequest() throws Exception {
        String username = "p22err" + (System.nanoTime() % 100_000_000L);
        createAdminUser(username);
        String token = login(username);
        int decisionsBefore = decisionCount();
        doThrow(new IllegalStateException("status lookup failed"))
                .when(accountStatusGate).requireActive(anyString());

        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("账号状态无法确认"));
        assertEquals(decisionsBefore, decisionCount());
    }

    private String createAdminUser(String username) {
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, PASSWORD);
        CommunityTestSupport.grantRole(jdbcTemplate, userId, "admin");
        createdUserIds.add(userId);
        return userId;
    }

    private void setStatus(String userId, String status) {
        jdbcTemplate.update("UPDATE community_user SET status = ? WHERE id = ?", status, userId);
    }

    private String login(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD
                                + "\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String statusOf(String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM community_user WHERE id = ?", String.class, userId);
    }

    private int adminRoleCount(String userId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM community_user_role cur
                INNER JOIN sys_role r ON r.id = cur.role_id
                WHERE cur.community_user_id = ? AND r.code = 'admin'
                """,
                Integer.class, userId);
        return count == null ? 0 : count;
    }

    private int decisionCount() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM moderation_decision", Integer.class);
        return count == null ? 0 : count;
    }
}

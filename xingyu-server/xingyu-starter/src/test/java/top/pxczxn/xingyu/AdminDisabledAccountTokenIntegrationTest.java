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
import top.pxczxn.xingyu.system.entity.SysUser;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;
import top.pxczxn.xingyu.system.service.SysUserService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 禁用管理员后，旧 Sa-Token 的下一次管理请求必须被拒绝。
 *
 * <p>禁用走 {@link SysUserService#update}，并保留 admin 角色，用来证明拒绝来自账号状态，
 * 而不是角色缓存被清掉之后碰巧没有角色。
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
    @Autowired
    private SysUserService userService;
    @SpyBean
    private AdminAccountStatusGate accountStatusGate;

    private final List<Long> createdUserIds = new ArrayList<>();

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
        for (Long userId : createdUserIds) {
            userService.delete(userId);
        }
        createdUserIds.clear();
    }

    @Test
    @DisplayName("禁用后旧 Token 被拒绝，重新启用后同一 Token 仍可访问")
    void disabledAdminTokenIsRejectedUntilAccountIsEnabledAgain() throws Exception {
        Long adminRoleId = adminRoleId();
        SysUser admin = createUser("p22adm", 1, adminRoleId);
        String token = login(admin.getUsername());

        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        int decisionsBefore = decisionCount();
        setStatus(admin, 0, adminRoleId);
        assertEquals(0, statusOf(admin.getId()));
        assertEquals(1, adminRoleCount(admin.getId()), "禁用不得被做成撤销 admin 角色");

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

        setStatus(admin, 1, adminRoleId);
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("未登录和无 admin 角色的账号仍按原契约拒绝")
    void anonymousAndNonAdminStayRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/moderation/reports"))
                .andExpect(jsonPath("$.code").value(401));

        SysUser plain = createUser("p22usr", 1, null);
        String token = login(plain.getUsername());
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("没有角色权限"));
    }

    @Test
    @DisplayName("账号状态查询失败时拒绝请求")
    void statusLookupFailureDeniesTheRequest() throws Exception {
        Long adminRoleId = adminRoleId();
        SysUser admin = createUser("p22err", 1, adminRoleId);
        String token = login(admin.getUsername());
        int decisionsBefore = decisionCount();
        doThrow(new IllegalStateException("status lookup failed"))
                .when(accountStatusGate).requireActive(anyLong());

        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("账号状态无法确认"));
        assertEquals(decisionsBefore, decisionCount());
    }

    private SysUser createUser(String prefix, int status, Long roleId) {
        SysUser user = new SysUser();
        user.setUsername(prefix + (System.nanoTime() % 100_000_000L));
        user.setPassword(PASSWORD);
        user.setNickname(user.getUsername());
        user.setUserType("admin");
        user.setStatus(status);
        user.setIsQuit(0);
        userService.create(user, roleId == null ? List.of() : List.of(roleId), List.of());
        createdUserIds.add(user.getId());
        return user;
    }

    private void setStatus(SysUser user, int status, Long roleId) {
        user.setStatus(status);
        user.setPassword(null);
        userService.update(user, List.of(roleId), List.of());
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

    private Long adminRoleId() {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM sys_role WHERE code = 'admin' AND status = 1 AND deleted = 0 LIMIT 1",
                Long.class);
    }

    private int statusOf(Long userId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM sys_user WHERE id = ?", Integer.class, userId);
    }

    private int adminRoleCount(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM sys_user_role ur
                INNER JOIN sys_role r ON r.id = ur.role_id
                WHERE ur.user_id = ? AND r.code = 'admin'
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

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminUuidAuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        CommunityTestSupport.ensureConsoleAdmin(jdbcTemplate);
    }

    @AfterEach
    void tearDown() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
    }

    @Test
    void ordinaryCommunityAccountCannotLoginAdmin() throws Exception {
        String username = "ord" + UUID.randomUUID().toString().substring(0, 8);
        userIds.add(CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, "admin123"));
        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value("您不是管理端用户，无法登录后台管理系统"));
    }

    @Test
    void adminCommunityAccountLogsInWithUuidAndCanLoadInfo() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        JsonNode data = objectMapper.readTree(login.getResponse().getContentAsString()).path("data");
        String token = data.path("token").asText();
        String userId = data.path("userId").asText();
        assertTrue(userId.contains("-"), userId);
        assertFalse(userId.matches("\\d+"), userId);

        mockMvc.perform(get("/api/v1/admin/auth/info").header("satoken", token))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.user.id").value(userId))
                .andExpect(jsonPath("$.data.roles[0]").value("admin"));

        mockMvc.perform(get("/api/v1/admin/auth/profile").header("satoken", token))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(userId));

        mockMvc.perform(put("/api/v1/admin/auth/profile").header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"控制台管理员\"}"))
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void founderBadgeDoesNotGrantAdminLogin() throws Exception {
        String username = "fnd" + UUID.randomUUID().toString().substring(0, 8);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, "admin123");
        userIds.add(userId);
        jdbcTemplate.update("UPDATE community_user SET role = 'FOUNDER' WHERE id = ?", userId);
        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.message").value("您不是管理端用户，无法登录后台管理系统"));
    }

    @Test
    void suspendedAdminCannotLogin() throws Exception {
        String username = "sus" + UUID.randomUUID().toString().substring(0, 8);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, "admin123");
        userIds.add(userId);
        CommunityTestSupport.grantRole(jdbcTemplate, userId, "admin");
        jdbcTemplate.update("UPDATE community_user SET status = 'SUSPENDED' WHERE id = ?", userId);
        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.message").value("用户已被禁用"));
    }

    @Test
    void unverifiedEmailRejectedWhenSwitchOn() throws Exception {
        String username = "eml" + UUID.randomUUID().toString().substring(0, 8);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, "admin123");
        userIds.add(userId);
        CommunityTestSupport.grantRole(jdbcTemplate, userId, "admin");
        jdbcTemplate.update("UPDATE community_user SET email_verified_at = NULL WHERE id = ?", userId);
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":true,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.refreshCache();
        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.message").value("请先完成邮箱验证后再登录"));
    }

    @Test
    void appLoginAndLegacyCompatAreDisabled() throws Exception {
        mockMvc.perform(post("/api/v1/app/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"13800000000\",\"smsCode\":\"123456\"}"))
                .andExpect(jsonPath("$.message").value("App 登录已停用，请使用社区账号登录"));
        MvcResult login = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String token = objectMapper.readTree(login.getResponse().getContentAsString())
                .path("data").path("token").asText();
        mockMvc.perform(get("/api/v1/auth/info").header("satoken", token))
                .andExpect(jsonPath("$.message").value("该登录入口已停用，请使用社区账号登录"));
    }
}

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 第 0 批：注册默认角色白名单。特权角色不得通过配置或请求体落到 community_user.role。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RegisterDefaultRoleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @AfterEach
    void restoreRegisterConfig() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void defaultConfigRegistersAsUser() throws Exception {
        assertEquals("user", registerAndReadRole("defuser"));
    }

    @ParameterizedTest
    @CsvSource({"member,member", "creator,creator", "USER,user"})
    void whitelistedConfigRolesAreGranted(String configured, String expected) throws Exception {
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\""
                        + configured + "\",\"needAudit\":false}");
        configGroupService.refreshCache();
        assertEquals(expected, registerAndReadRole("wl" + configured.toLowerCase()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"admin", "operator", "super_admin", "root"})
    void persistedPrivilegedOrUnknownRolesFallBackToUser(String configured) throws Exception {
        plantRegisterConfig(configured);
        assertEquals("user", registerAndReadRole("fb" + configured.replace('_', 'x')));
    }

    @Test
    void clientRoleFieldDoesNotOverrideServerConfig() throws Exception {
        long nonce = System.nanoTime();
        String email = "rolebody" + nonce + "@example.com";
        String username = "rb" + (nonce % 1_000_000_000L);
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0","role":"admin"}
                                """.formatted(email, username)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String userId = json.path("userId").asText();
        assertTrue(!userId.isBlank());
        String role = jdbcTemplate.queryForObject(
                "SELECT role FROM community_user WHERE id = ?", String.class, userId);
        assertEquals("user", role);
    }

    @Test
    void saveConfigRejectsPrivilegedDefaultRole() {
        String previous = jdbcTemplate.queryForObject(
                "SELECT config_value FROM sys_config_group WHERE group_code = 'register'", String.class);
        assertThrows(BusinessException.class, () -> configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\"admin\",\"needAudit\":false}"));
        assertThrows(BusinessException.class, () -> configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"defaultRole\":\"operator\"}"));
        assertThrows(BusinessException.class, () -> configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"defaultRole\":\"super_admin\"}"));
        String after = jdbcTemplate.queryForObject(
                "SELECT config_value FROM sys_config_group WHERE group_code = 'register'", String.class);
        assertEquals(previous, after);
    }

    @Test
    void registerStillCompletesEmailVerificationContractWhenRoleIsUser() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ev%s@example.com","username":"ev%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(System.nanoTime(), System.nanoTime() % 1_000_000_000L)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        assertEquals("NOT_REQUIRED", json.path("emailVerification").path("status").asText());
        assertTrue(json.has("userId"));
    }

    private void plantRegisterConfig(String defaultRole) {
        jdbcTemplate.update(
                "UPDATE sys_config_group SET config_value = ? WHERE group_code = 'register'",
                "{\"enabled\":true,\"verifyEmail\":false,\"verifyPhone\":false,\"defaultRole\":\""
                        + defaultRole + "\",\"needAudit\":false}");
        configGroupService.refreshCache();
    }

    private String registerAndReadRole(String prefix) throws Exception {
        long nonce = System.nanoTime();
        String email = prefix + nonce + "@example.com";
        String username = prefix + (nonce % 1_000_000L);
        if (username.length() > 32) {
            username = username.substring(0, 32);
        }
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String userId = json.path("userId").asText();
        return jdbcTemplate.queryForObject(
                "SELECT role FROM community_user WHERE id = ?", String.class, userId);
    }
}

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PRIVATE 资料可见性的真实 HTTP 契约。
 *
 * <p>2026-10-30 之前 {@code CommunityProfileService.getPublicProfile} 对 PRIVATE
 * 跳过 AccessPolicy，导致“仅自己可见”实际仍是“知道链接就能看”。本测试覆盖所有
 * 资料可见面：详情 / 作品 / 分类 / 动态 / 关注列表 / 空间页，避免只修了详情页而
 * 留下旁路。断言用 404 而不是 403：隐藏资料与不存在资料必须不可区分。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProfilePrivacyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    @DisplayName("PRIVATE 资料对陌生人 404，对本人可读：所有资料面")
    void privateProfileIsHiddenFromStrangerButVisibleToOwner() throws Exception {
        Account owner = registerAccount("privowner");
        Account stranger = registerAccount("privstranger");
        publishMoment(owner.token());
        setVisibility(owner.token(), "PRIVATE");

        for (String path : profileSurfacePaths(owner.username())) {
            mockMvc.perform(get(path).header("satoken", stranger.token()))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get(path))
                    .andExpect(status().isNotFound());
        }

        for (String path : profileSurfacePaths(owner.username())) {
            mockMvc.perform(get(path).header("satoken", owner.token()))
                    .andExpect(status().isOk());
        }

        // 详情接口也属于资料面，单独钉住 owner/stranger 的差异。
        mockMvc.perform(get("/api/v1/users/" + owner.username()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/users/" + owner.username()).header("satoken", owner.token()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("UNLISTED 仍可通过直达链接读取")
    void unlistedProfileRemainsDirectlyReadable() throws Exception {
        Account account = registerAccount("unlisted");
        setVisibility(account.token(), "UNLISTED");
        setFollowersVisibilityPublic(account.token());

        for (String path : profileSurfacePaths(account.username())) {
            mockMvc.perform(get(path))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("新注册默认 PRIVATE：游客打不开，本人能打开")
    void registrationDefaultsToPrivate() throws Exception {
        Account account = registerAccount("newprivate");

        mockMvc.perform(get("/api/v1/users/" + account.username()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/users/" + account.username()).header("satoken", account.token()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PRIVATE 不进入用户搜索；UNLISTED 仍可精确命中")
    void privateProfileIsNotSearchable() throws Exception {
        Account account = registerAccount("privsearch");
        setVisibility(account.token(), "PRIVATE");
        assertFalse(searchHasUser(account.username()));

        setVisibility(account.token(), "UNLISTED");
        assertTrue(searchHasUser(account.username()));
    }

    // ---------------------------------------------------------------- helpers

    private String[] profileSurfacePaths(String username) {
        return new String[] {
                "/api/v1/users/" + username,
                "/api/v1/u/" + username,
                "/api/v1/users/" + username + "/works",
                "/api/v1/users/" + username + "/works/categories",
                "/api/v1/users/" + username + "/moments",
                "/api/v1/users/" + username + "/followers",
                "/api/v1/users/" + username + "/following",
                "/api/v1/spaces/" + username,
                "/api/v1/spaces/" + username + "/works"
        };
    }

    private boolean searchHasUser(String username) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/search")
                        .param("q", username)
                        .param("type", "USER")
                        .param("sort", "latest")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode row : rows) {
            if (username.equals(row.path("objectId").asText())) {
                return true;
            }
        }
        return false;
    }

    private void setVisibility(String token, String visibility) throws Exception {
        MvcResult current = mockMvc.perform(get("/api/v1/me/profile").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        int lockVersion = objectMapper.readTree(current.getResponse().getContentAsString())
                .path("lockVersion").asInt(0);
        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visibility":"%s","lockVersion":%d}
                                """.formatted(visibility, lockVersion)))
                .andExpect(status().isOk());
    }

    private void setFollowersVisibilityPublic(String token) throws Exception {
        mockMvc.perform(patch("/api/v1/me/profile/privacy")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"followersVisibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
    }

    private void publishMoment(String token) throws Exception {
        mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"隐私测试动态\"}"))
                .andExpect(status().isOk());
    }

    private Account registerAccount(String prefix) throws Exception {
        String username = prefix + uniqueSuffix();
        String email = username + "@example.com";
        String password = "Test1234!@#ab";

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return new Account(username, login.getResponse().getHeader("satoken"));
    }

    private static String uniqueSuffix() {
        return Long.toString(System.nanoTime() % 1_000_000_000L);
    }

    private record Account(String username, String token) {
    }
}

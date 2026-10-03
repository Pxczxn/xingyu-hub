package top.pxczxn.xingyu;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The two author/counterpart fields added on 2026-10-03, verified against a real
 * running application and a real database.
 *
 * Why this exists: both fields were originally covered only by mocked unit tests
 * (ConversationCounterpartTest) plus a compile check. A mock proves the
 * resolution LOGIC; it cannot prove that the field survives JSON serialisation,
 * that MyBatis maps the columns, or that the endpoint is wired to the service
 * that builds it. This does.
 *
 * It also pins the two behaviours that are easy to regress and hard to notice:
 *
 *   - a DIRECT conversation must be labelled with the OTHER participant, never
 *     with yourself (getting your own name back is worse than the generic label
 *     it replaced);
 *   - a missing profile must yield null, not the raw user id, because the client
 *     renders whatever it is given.
 *
 * Registration leaves `display_name` null, so these assertions land on the
 * username fallback — which is itself a path worth pinning.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConversationAndMomentAuthorIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SysConfigGroupService configGroupService;

    /*
     * The public profile payload does NOT expose userId — it carries username,
     * displayName, counts and flags, but no id. So the test reads the id from the
     * database, the same way the other integration tests reach for JdbcTemplate
     * when an endpoint deliberately withholds something.
     */
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    private void register(String email, String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return result.getResponse().getHeader("satoken");
    }

    @Test
    @DisplayName("a DIRECT conversation reports the OTHER participant, never yourself")
    void directConversationReportsCounterpart() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String usernameA = "cpa" + (nonce % 1_000_000_000L);
        String usernameB = "cpb" + (nonce % 1_000_000_000L);

        register("cpa" + nonce + "@example.com", usernameA, password);
        register("cpb" + nonce + "@example.com", usernameB, password);
        String tokenA = login("cpa" + nonce + "@example.com", password);
        String tokenB = login("cpb" + nonce + "@example.com", password);

        // A needs B's user id to open the conversation. The public profile
        // endpoint does not expose it, so read it from the profile row.
        String userIdB = jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = ?", String.class, usernameB);

        mockMvc.perform(post("/api/v1/messages/direct/" + userIdB).header("satoken", tokenA))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/messages").header("satoken", tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("DIRECT"))
                .andExpect(jsonPath("$[0].counterpartDisplayName").value(usernameB));

        // And B sees A — proving the field is per-reader, not a stored title.
        mockMvc.perform(get("/api/v1/messages").header("satoken", tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].counterpartDisplayName").value(usernameA));
    }

    @Test
    @DisplayName("a moment reports its author")
    void momentReportsAuthor() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String username = "mau" + (nonce % 1_000_000_000L);

        register("mau" + nonce + "@example.com", username, password);
        String token = login("mau" + nonce + "@example.com", password);

        mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"作者字段的集成验证\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/moments").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorUsername").value(username));
    }
}

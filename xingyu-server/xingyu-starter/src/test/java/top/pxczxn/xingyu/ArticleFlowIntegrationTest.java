package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ArticleFlowIntegrationTest {

    /**
     * The session-token header name for BOTH the admin and the community API.
     *
     * <p>V001 seeded {@code sys_config_group.security.tokenName = "Authorization"}, but
     * {@code V027__align_community_token_header.sql} changed it to {@code "satoken"}.
     * This test kept sending {@code Authorization}, so every admin call answered 200 with a
     * {@code Result} body carrying {@code code: 401} — and because the queue parse below then
     * found no submission, the test returned early and still passed. It asserted nothing
     * about publishing for as long as that lasted.
     */
    private static final String ADMIN_TOKEN_HEADER = "satoken";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void registerCreateSubmitApprovePublishAndRead() throws Exception {
        long nonce = System.nanoTime();
        String email = "art" + nonce + "@example.com";
        String username = "artuser" + (nonce % 1_000_000_000L);
        String password = "Test1234!@#ab";

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();

        String authorToken = loginResult.getResponse().getHeader("satoken");

        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"PUBLIC\",\"lockVersion\":0}"))
                .andExpect(status().isOk());

        MvcResult createResult = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode article = objectMapper.readTree(createResult.getResponse().getContentAsString());
        String articleId = article.get("articleId").asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"测试文章","summary":"摘要","bodyMode":"MARKDOWN","body":"正文内容","lockVersion":0,"visibility":"PUBLIC"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", authorToken))
                .andExpect(status().isOk());

        MvcResult queueResult = mockMvc.perform(get("/api/v1/admin/review/queue")
                        .header(ADMIN_TOKEN_HEADER, adminToken()))
                .andExpect(status().isOk())
                .andReturn();

        // The admin API wraps every payload in Result<T>, so the list lives under `data`.
        // Parsing it as a bare array silently yields no submission — which is exactly how
        // this test used to skip its own publish step and still report green.
        JsonNode queueBody = objectMapper.readTree(queueResult.getResponse().getContentAsString());
        JsonNode queue = queueBody.isArray() ? queueBody : queueBody.path("data");
        assertTrue(queue.isArray(), "审核队列响应不是数组：" + queueBody);

        // Match by articleId instead of taking element 0 — the queue can hold submissions
        // left behind by earlier runs.
        String submissionId = null;
        for (JsonNode item : queue) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                submissionId = item.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "审核队列里找不到本次提交的文章：" + articleId);

        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header(ADMIN_TOKEN_HEADER, adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/articles/" + articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("测试文章"));
    }

    private String adminToken() throws Exception {
        MvcResult adminLogin = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andReturn();
        if (adminLogin.getResponse().getStatus() != 200) {
            return "";
        }
        JsonNode body = objectMapper.readTree(adminLogin.getResponse().getContentAsString());
        return body.path("data").path("token").asText("");
    }
}

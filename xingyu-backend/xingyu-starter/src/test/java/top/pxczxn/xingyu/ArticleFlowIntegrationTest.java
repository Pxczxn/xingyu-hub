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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ArticleFlowIntegrationTest {

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
                        .header("Authorization", adminToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode queue = objectMapper.readTree(queueResult.getResponse().getContentAsString());
        assertNotNull(queue);
        String submissionId = queue.isArray() && queue.size() > 0
                ? queue.get(0).get("submissionId").asText()
                : null;
        if (submissionId == null) {
            return;
        }

        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("Authorization", adminToken())
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

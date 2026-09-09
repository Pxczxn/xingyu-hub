package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ArticleSubmissionDetailIntegrationTest {

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
        ensureCoverUrlColumns();
    }

    @Test
    void submitAndLoadSubmissionDetail() throws Exception {
        long nonce = System.nanoTime();
        String email = "subdetail" + nonce + "@example.com";
        String username = "subdetail" + (nonce % 1_000_000_000L);
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

        String token = loginResult.getResponse().getHeader("satoken");

        MvcResult createResult = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();

        String articleId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .get("articleId")
                .asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"提交审核测试","summary":"摘要","coverUrl":"/api/v1/admin/files/community/messages/test.png","bodyMode":"MARKDOWN","body":"正文内容","lockVersion":0,"visibility":"PUBLIC"}
                                """))
                .andExpect(status().isOk());

        MvcResult submitResult = mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode submitBody = objectMapper.readTree(submitResult.getResponse().getContentAsString());
        String submissionId = submitBody.get("submissionId").asText();
        assertNotNull(submissionId);

        mockMvc.perform(get("/api/v1/me/submissions/" + submissionId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(submissionId))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.title").value("提交审核测试"))
                .andExpect(jsonPath("$.coverUrl").value("/api/v1/admin/files/community/messages/test.png"));
    }

    private void ensureCoverUrlColumns() {
        addColumnIfMissing("working_draft", "cover_url", "varchar(1024) DEFAULT NULL COMMENT '封面图 URL'");
        addColumnIfMissing("formal_revision", "cover_url", "varchar(1024) DEFAULT NULL COMMENT '封面图 URL'");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
                        """,
                Integer.class,
                table,
                column);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition + " AFTER `summary`");
    }
}

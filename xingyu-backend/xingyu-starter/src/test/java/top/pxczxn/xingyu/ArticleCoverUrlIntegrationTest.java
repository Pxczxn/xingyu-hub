package top.pxczxn.xingyu;

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

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ArticleCoverUrlIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        ensureCoverUrlColumns();
    }

    @Test
    void saveDraftWithCoverUrl() throws Exception {
        long nonce = System.nanoTime();
        String email = "cover" + nonce + "@example.com";
        String username = "coveruser" + (nonce % 1_000_000_000L);
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
                                {"title":"封面测试","summary":"摘要","coverUrl":"/api/files/community/messages/test.png","bodyMode":"MARKDOWN","body":"正文","lockVersion":0,"visibility":"PUBLIC"}
                                """))
                .andExpect(status().isOk());
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
        assertTrue(jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
                        """,
                Integer.class,
                table,
                column) > 0);
    }
}

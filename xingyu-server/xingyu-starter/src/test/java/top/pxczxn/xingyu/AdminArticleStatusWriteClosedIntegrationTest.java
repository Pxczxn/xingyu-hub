package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端文章运营接口不能改写编辑状态。
 *
 * <p>正式送审仍走作者的 submit。本类只拒绝 PATCH status 的 ARTICLE 分支。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminArticleStatusWriteClosedIntegrationTest {

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

    @Test
    @DisplayName("草稿不能经运营接口直接发布")
    void draftCannotBePublishedThroughOperations() throws Exception {
        String author = registerAndLogin("p1bdraft");
        String articleId = createDraft(author, "p1b-draft-" + System.nanoTime());
        assertEquals("DRAFT", articleStatus(articleId));
        int eventsBefore = eventCount(articleId);

        rejectStatusChange(adminToken(), articleId, "PUBLISHED");

        assertEquals("DRAFT", articleStatus(articleId));
        assertEquals(0, publishedRevisionCount(articleId));
        assertEquals(404, publicDetailStatus(articleId));
        assertFalse(isIndexed(articleId));
        assertEquals(eventsBefore, eventCount(articleId));
    }

    @Test
    @DisplayName("审核中的文章不能被运营接口改成已发布")
    void inReviewArticleCannotBePublishedThroughOperations() throws Exception {
        String author = registerAndLogin("p1breview");
        String articleId = createDraft(author, "p1b-review-" + System.nanoTime());
        submit(author, articleId);
        assertEquals("IN_REVIEW", articleStatus(articleId));
        assertEquals("PENDING", submissionStatus(articleId));
        assertEquals(0, publishedRevisionCount(articleId));
        int eventsBefore = eventCount(articleId);

        rejectStatusChange(adminToken(), articleId, "PUBLISHED");

        assertEquals("IN_REVIEW", articleStatus(articleId));
        assertEquals("PENDING", submissionStatus(articleId));
        assertEquals(0, publishedRevisionCount(articleId));
        assertEquals(404, publicDetailStatus(articleId));
        assertFalse(isIndexed(articleId));
        assertEquals(eventsBefore, eventCount(articleId));
    }

    @Test
    @DisplayName("DRAFT、IN_REVIEW、PUBLISHED 三种运营写入都不会改文章状态")
    void everyArticleStatusWriteIsRejected() throws Exception {
        String author = registerAndLogin("p1bclosed");
        String articleId = createDraft(author, "p1b-closed-" + System.nanoTime());
        String admin = adminToken();

        for (String requested : new String[] {"DRAFT", "IN_REVIEW", "PUBLISHED"}) {
            rejectStatusChange(admin, articleId, requested);
            assertEquals("DRAFT", articleStatus(articleId), requested);
            assertEquals(0, publishedRevisionCount(articleId));
        }
    }

    private void rejectStatusChange(String adminToken, String articleId, String status) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/operations/content/" + articleId + "/status")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ARTICLE\",\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(jsonPath("$.message").value("内容类型或状态无效"));
    }

    private String createDraft(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"bodyMode\":\"MARKDOWN\","
                                + "\"body\":\"正文\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private void submit(String token, String articleId) throws Exception {
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", token))
                .andExpect(status().isOk());
    }

    private int publicDetailStatus(String articleId) throws Exception {
        return mockMvc.perform(get("/api/v1/articles/" + articleId)).andReturn().getResponse().getStatus();
    }

    private String registerAndLogin(String prefix) throws Exception {
        String username = prefix + System.nanoTime();
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
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private int publishedRevisionCount(String articleId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM published_revision WHERE article_id = ?",
                Integer.class, articleId);
        return count == null ? 0 : count;
    }

    private String submissionStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM review_submission WHERE article_id = ? ORDER BY submitted_at DESC LIMIT 1",
                String.class, articleId);
    }

    private boolean isIndexed(String articleId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document"
                        + " WHERE object_type = 'ARTICLE' AND object_id = ? AND removed_at IS NULL",
                Integer.class, articleId);
        return count != null && count > 0;
    }

    private int eventCount(String articleId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reliable_event WHERE aggregate_type = 'article' AND aggregate_id = ?",
                Integer.class, articleId);
        return count == null ? 0 : count;
    }
}

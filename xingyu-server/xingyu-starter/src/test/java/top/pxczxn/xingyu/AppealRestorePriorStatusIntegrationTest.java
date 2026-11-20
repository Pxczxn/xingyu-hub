package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 申诉通过只撤销治理隐藏，不把治理前已经回收或删除的内容重新公开。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AppealRestorePriorStatusIntegrationTest {

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
    @DisplayName("已发布动态隐藏后，申诉通过恢复公开和搜索")
    void publishedMomentReturnsToPublicAfterApprovedAppeal() throws Exception {
        People people = people("p23pub");
        String momentId = createMoment(people.authorToken(), "已发布动态");
        String caseId = uphold(people.reporterToken(), "MOMENT", momentId);
        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals("PUBLISHED", priorStatus(caseId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed("MOMENT", momentId));

        approveAppeal(people.authorToken(), caseId);

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed("MOMENT", momentId));
    }

    @Test
    @DisplayName("已回收动态被举报后，申诉通过仍然是回收状态")
    void trashedMomentStaysTrashedAfterApprovedAppeal() throws Exception {
        People people = people("p23trash");
        String momentId = createMoment(people.authorToken(), "已回收动态");
        mockMvc.perform(post("/api/v1/moments/" + momentId + "/trash").header("satoken", people.authorToken()))
                .andExpect(status().isOk());
        String caseId = uphold(people.reporterToken(), "MOMENT", momentId);

        assertEquals("TRASHED", momentStatus(momentId));
        assertEquals("TRASHED", priorStatus(caseId));
        approveAppeal(people.authorToken(), caseId);

        assertEquals("TRASHED", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed("MOMENT", momentId));
    }

    @Test
    @DisplayName("可见评论隐藏后，申诉通过恢复为可见")
    void visibleCommentReturnsAfterApprovedAppeal() throws Exception {
        People people = people("p23cvis");
        String momentId = createMoment(people.authorToken(), "评论宿主");
        String commentId = createComment(people.authorToken(), "MOMENT", momentId, "可见评论");
        String caseId = uphold(people.reporterToken(), "COMMENT", commentId);
        assertEquals("HIDDEN", commentStatus(commentId));
        assertEquals("VISIBLE", priorStatus(caseId));
        assertFalse(commentListed(people.authorToken(), momentId, commentId));

        approveAppeal(people.authorToken(), caseId);

        assertEquals("VISIBLE", commentStatus(commentId));
        assertTrue(commentListed(people.authorToken(), momentId, commentId));
        assertFalse(indexed("COMMENT", commentId));
    }

    @Test
    @DisplayName("已删除评论被举报后，申诉通过仍然是删除状态")
    void deletedCommentStaysDeletedAfterApprovedAppeal() throws Exception {
        People people = people("p23cdel");
        String momentId = createMoment(people.authorToken(), "删除评论宿主");
        String commentId = createComment(people.authorToken(), "MOMENT", momentId, "将被删除");
        mockMvc.perform(delete("/api/v1/comments/" + commentId).header("satoken", people.authorToken()))
                .andExpect(status().isNoContent());
        String caseId = uphold(people.reporterToken(), "COMMENT", commentId);

        assertEquals("DELETED", commentStatus(commentId));
        assertEquals("DELETED", priorStatus(caseId));
        approveAppeal(people.authorToken(), caseId);

        assertEquals("DELETED", commentStatus(commentId));
        assertFalse(commentListed(people.authorToken(), momentId, commentId));
        assertFalse(indexed("COMMENT", commentId));
    }

    @Test
    @DisplayName("已发布文章隐藏后，申诉通过恢复公开，且不改编辑状态")
    void publishedArticleBecomesPublicAgainAfterApprovedAppeal() throws Exception {
        People people = people("p23art");
        String articleId = publishArticle(people.authorToken(), "可恢复文章");
        assertEquals(200, articleDetailStatus(articleId));
        String caseId = uphold(people.reporterToken(), "ARTICLE", articleId);
        assertEquals("HIDDEN", moderationStatus(articleId));
        assertEquals(404, articleDetailStatus(articleId));
        assertFalse(indexed("ARTICLE", articleId));

        approveAppeal(people.authorToken(), caseId);

        assertEquals("NORMAL", moderationStatus(articleId));
        assertEquals("PUBLISHED", articleStatus(articleId));
        assertEquals("ACTIVE", lifecycleStatus(articleId));
        assertEquals(200, articleDetailStatus(articleId));
        assertTrue(indexed("ARTICLE", articleId));
    }

    @Test
    @DisplayName("已回收文章隐藏后，申诉通过仍然不能公开")
    void trashedArticleStaysUnreadableAfterApprovedAppeal() throws Exception {
        People people = people("p23artr");
        String articleId = publishArticle(people.authorToken(), "已回收文章");
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash").header("satoken", people.authorToken()))
                .andExpect(status().isOk());
        String caseId = uphold(people.reporterToken(), "ARTICLE", articleId);
        approveAppeal(people.authorToken(), caseId);

        assertEquals("NORMAL", moderationStatus(articleId));
        assertEquals("TRASHED", lifecycleStatus(articleId));
        assertEquals(404, articleDetailStatus(articleId));
        assertFalse(indexed("ARTICLE", articleId));
    }

    @Test
    @DisplayName("驳回申诉后动态继续隐藏")
    void rejectedAppealKeepsMomentHidden() throws Exception {
        People people = people("p23rej");
        String momentId = createMoment(people.authorToken(), "驳回后仍隐藏");
        String caseId = uphold(people.reporterToken(), "MOMENT", momentId);
        String appealId = submitAppeal(people.authorToken(), caseId);

        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\"}"))
                .andExpect(jsonPath("$.code").value(200));

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed("MOMENT", momentId));
        assertEquals("REJECTED", appealStatus(appealId));
    }

    @Test
    @DisplayName("已批准的申诉不能再次处理")
    void approvedAppealCannotBeDecidedAgain() throws Exception {
        People people = people("p23rep");
        String momentId = createMoment(people.authorToken(), "重复裁决");
        String caseId = uphold(people.reporterToken(), "MOMENT", momentId);
        String appealId = approveAppeal(people.authorToken(), caseId);

        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\"}"))
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("申诉已处理"));

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals("APPROVED", appealStatus(appealId));
        assertEquals(1, appealCount(caseId));
    }

    @Test
    @DisplayName("没有治理措施时不能申诉，内容状态不变")
    void appealWithoutMeasureDoesNotChangeContent() throws Exception {
        People people = people("p23none");
        String momentId = createMoment(people.authorToken(), "驳回举报");
        String reportId = submitReport(people.reporterToken(), "MOMENT", momentId);
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "DISMISSED");
        assertEquals("PUBLISHED", momentStatus(momentId));

        mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", people.authorToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","detail":"没有措施"}
                                """.formatted(caseId)))
                .andExpect(status().isBadRequest());

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(0, appealCount(caseId));
        assertEquals(0, measureCount(caseId));
    }

    private String uphold(String reporterToken, String type, String objectId) throws Exception {
        String reportId = submitReport(reporterToken, type, objectId);
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        return caseId;
    }

    private String approveAppeal(String authorToken, String caseId) throws Exception {
        String appealId = submitAppeal(authorToken, caseId);
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(jsonPath("$.code").value(200));
        return appealId;
    }

    private People people(String prefix) throws Exception {
        return new People(registerAndLogin(prefix + "a"), registerAndLogin(prefix + "r"));
    }

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String createComment(String token, String objectType, String objectId, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","body":"%s"}
                                """.formatted(objectType, objectId, body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String publishArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(title)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", token))
                .andExpect(status().isOk());
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rows = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode list = rows.isArray() ? rows : rows.path("data");
        String submissionId = null;
        for (JsonNode row : list) {
            if (articleId.equals(row.path("articleId").asText(null))) {
                submissionId = row.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String submitReport(String token, String type, String objectId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"SPAM"}
                                """.formatted(type, objectId)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
    }

    private void decideCase(String caseId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(jsonPath("$.code").value(200));
    }

    private String submitAppeal(String token, String caseId) throws Exception {
        String measureId = jdbcTemplate.queryForObject(
                """
                SELECT m.id FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                String.class, caseId);
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"请求恢复"}
                                """.formatted(caseId, measureId)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String registerAndLogin(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
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

    private String caseIdOf(String reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private String priorStatus(String caseId) {
        return jdbcTemplate.query(
                """
                SELECT m.prior_status FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                rs -> rs.next() ? rs.getString(1) : null,
                caseId);
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private String moderationStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT moderation_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String lifecycleStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT lifecycle_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String appealStatus(String appealId) {
        return jdbcTemplate.queryForObject("SELECT status FROM appeal WHERE id = ?", String.class, appealId);
    }

    private int appealCount(String caseId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM appeal WHERE case_id = ?", Integer.class, caseId);
        return count == null ? 0 : count;
    }

    private int measureCount(String caseId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                Integer.class, caseId);
        return count == null ? 0 : count;
    }

    private int momentDetailStatus(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
    }

    private int articleDetailStatus(String articleId) throws Exception {
        return mockMvc.perform(get("/api/v1/articles/" + articleId)).andReturn().getResponse().getStatus();
    }

    private boolean commentListed(String token, String momentId, String commentId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/comments/MOMENT/" + momentId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode row : rows) {
            if (commentId.equals(row.path("id").asText())) {
                return true;
            }
        }
        return false;
    }

    private boolean indexed(String type, String objectId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM search_document
                WHERE object_type = ? AND object_id = ? AND removed_at IS NULL
                """,
                Integer.class, type, objectId);
        return count != null && count > 0;
    }

    private record People(String authorToken, String reporterToken) {
    }
}

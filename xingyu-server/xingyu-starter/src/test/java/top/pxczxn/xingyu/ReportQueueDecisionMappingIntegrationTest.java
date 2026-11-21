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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Timestamp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 举报队列的决定值必须与案件接口一致：DISMISSED 驳回，UPHELD 隐藏。
 *
 * <p>消费者延迟拉长，避免发布事件的异步刷新在断言窗口里改写索引。
 * 隐藏本身在决定事务内同步刷新索引。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportQueueDecisionMappingIntegrationTest {

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
        CommunityTestSupport.requireIsolatedTargets(
                configGroupService, jdbcTemplate, dataSource, redisConnectionFactory);
    }

    @Test
    @DisplayName("举报队列提交 DISMISSED 只关闭案件，不隐藏内容")
    void dismissedClosesWithoutHiding() throws Exception {
        OpenReport report = openReport("rqdismiss");
        Timestamp indexedAt = indexedAt(report.articleId());
        assertNotNull(indexedAt, "已发布文章必须已有活索引");
        assertEquals(200, publicDetailStatus(report.articleId()));

        decide(report.reportId(), "DISMISSED").andExpect(jsonPath("$.code").value(200));

        assertEquals("CLOSED", reportStatus(report.reportId()));
        assertEquals("CLOSED", caseStatus(report.caseId()));
        assertEquals("DISMISSED", decisionOf(report.caseId()));
        assertEquals(0, measureCount(report.caseId()));
        assertEquals("PUBLISHED", articleStatus(report.articleId()));
        assertFalse("HIDDEN".equals(moderationStatus(report.articleId())));
        assertEquals(indexedAt, indexedAt(report.articleId()));
        assertTrue(isIndexed(report.articleId()));
        assertEquals(200, publicDetailStatus(report.articleId()));
    }

    @Test
    @DisplayName("举报队列提交 UPHELD 隐藏文章并同步移除搜索索引")
    void upheldHidesAndRemovesIndex() throws Exception {
        OpenReport report = openReport("rqupheld");
        assertTrue(isIndexed(report.articleId()));

        decide(report.reportId(), "UPHELD").andExpect(jsonPath("$.code").value(200));

        assertEquals("UPHELD", decisionOf(report.caseId()));
        assertEquals(1, measureCount(report.caseId()));
        assertEquals("HIDE_CONTENT", measureType(report.caseId()));
        assertEquals("HIDDEN", moderationStatus(report.articleId()));
        assertEquals("PUBLISHED", articleStatus(report.articleId()));
        assertFalse(isIndexed(report.articleId()));
        assertEquals(404, publicDetailStatus(report.articleId()));
    }

    @Test
    @DisplayName("非法决定值被拒绝，且不写入决定、措施或索引")
    void illegalDecisionLeavesStateUntouched() throws Exception {
        OpenReport report = openReport("rqillegal");
        Timestamp indexedAt = indexedAt(report.articleId());
        String moderation = moderationStatus(report.articleId());

        decide(report.reportId(), "BAN_USER")
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("决定值无效")));

        assertEquals("SUBMITTED", reportStatus(report.reportId()));
        assertEquals("OPEN", caseStatus(report.caseId()));
        assertNull(decisionOf(report.caseId()));
        assertEquals(0, measureCount(report.caseId()));
        assertEquals(moderation, moderationStatus(report.articleId()));
        assertEquals("PUBLISHED", articleStatus(report.articleId()));
        assertEquals(indexedAt, indexedAt(report.articleId()));
        assertTrue(isIndexed(report.articleId()));
        assertEquals(200, publicDetailStatus(report.articleId()));
    }

    @Test
    @DisplayName("已处理举报再次提交仍冲突，且不新增决定或措施")
    void repeatDecideConflictsWithoutAnotherDecision() throws Exception {
        OpenReport report = openReport("rqrepeat");
        decide(report.reportId(), "DISMISSED").andExpect(jsonPath("$.code").value(200));

        decide(report.reportId(), "UPHELD")
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("举报已处理"));

        assertEquals("DISMISSED", decisionOf(report.caseId()));
        assertEquals(1, decisionCount(report.caseId()));
        assertEquals(0, measureCount(report.caseId()));
        assertEquals("PUBLISHED", articleStatus(report.articleId()));
        assertFalse("HIDDEN".equals(moderationStatus(report.articleId())));
        assertTrue(isIndexed(report.articleId()));
    }

    private org.springframework.test.web.servlet.ResultActions decide(String reportId, String decision)
            throws Exception {
        return mockMvc.perform(post("/api/v1/admin/moderation/reports/" + reportId + "/decide")
                .header("satoken", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"" + decision + "\"}"));
    }

    private OpenReport openReport(String prefix) throws Exception {
        String author = registerAndLogin(prefix + "a");
        String reporter = registerAndLogin(prefix + "r");
        String articleId = publishArticle(author, prefix + "-" + System.nanoTime());
        String reportId = submitReport(reporter, articleId);
        String caseId = jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
        return new OpenReport(articleId, reportId, caseId);
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
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文内容","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(title)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", token))
                .andExpect(status().isOk());

        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode queueBody = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode queueRows = queueBody.isArray() ? queueBody : queueBody.path("data");
        String submissionId = null;
        for (JsonNode row : queueRows) {
            if (articleId.equals(row.path("articleId").asText(null))) {
                submissionId = row.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "发布流水线必须在审核队列中找到该文章");
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String submitReport(String token, String articleId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"ARTICLE","objectId":"%s","reason":"SPAM"}
                                """.formatted(articleId)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
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

    private int publicDetailStatus(String articleId) throws Exception {
        return mockMvc.perform(get("/api/v1/articles/" + articleId)).andReturn().getResponse().getStatus();
    }

    private String reportStatus(String reportId) {
        return jdbcTemplate.queryForObject("SELECT status FROM report WHERE id = ?", String.class, reportId);
    }

    private String caseStatus(String caseId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM moderation_case WHERE id = ?", String.class, caseId);
    }

    private String decisionOf(String caseId) {
        return jdbcTemplate.query(
                "SELECT decision FROM moderation_decision WHERE case_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                caseId);
    }

    private int decisionCount(String caseId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", Integer.class, caseId);
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

    private String measureType(String caseId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT m.measure_type FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                String.class, caseId);
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private String moderationStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT moderation_status FROM article WHERE id = ?", String.class, articleId);
    }

    private boolean isIndexed(String articleId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM search_document
                WHERE object_type = 'ARTICLE' AND object_id = ? AND removed_at IS NULL
                """,
                Integer.class, articleId);
        return count != null && count > 0;
    }

    private Timestamp indexedAt(String articleId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT indexed_at FROM search_document
                WHERE object_type = 'ARTICLE' AND object_id = ?
                """,
                Timestamp.class, articleId);
    }

    private record OpenReport(String articleId, String reportId, String caseId) {
    }
}

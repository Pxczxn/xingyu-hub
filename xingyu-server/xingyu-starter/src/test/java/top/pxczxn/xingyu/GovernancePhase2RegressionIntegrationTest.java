package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
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
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 2 治理链路回归。
 *
 * <p>后台轮询被推迟到 1 小时，避免它在断言窗口里用更早的事务快照改索引。
 * 每次治理提交之后，测试再显式调用 {@link ReliableEventConsumer#poll()}，
 * 用一个新事务重放已经提交的发布事件，确认索引不会被写回公开状态。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GovernancePhase2RegressionIntegrationTest {

    private static final String PASSWORD = "admin123";

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
    @Autowired
    private ReliableEventConsumer eventConsumer;
    private final List<String> createdCommunityUserIds = new ArrayList<>();

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

    @AfterEach
    void removeCreatedAdmins() {
        for (String userId : createdCommunityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        createdCommunityUserIds.clear();
    }

    @Test
    @DisplayName("场景A：举报、认定、隐藏、申诉通过，审计保留且索引经消费者后仍恢复")
    void upheldAppealRestoresPublishedArticleAndKeepsAudit() throws Exception {
        Person author = register("p25aa");
        Person reporter = register("p25ar");
        String articleId = publishArticle(author.token(), "回归文章");
        assertTrue(indexed("ARTICLE", articleId));
        String reportId = submitReport(reporter.token(), "ARTICLE", articleId);
        String caseId = caseIdOf(reportId);

        decideReport(reportId, "UPHELD").andExpect(jsonPath("$.code").value(200));
        assertAuditClosed(reportId, caseId, reporter.username(), articleId, "UPHELD", "HIDDEN", "NORMAL");
        assertEquals(404, articleDetail(articleId));
        assertFalse(indexed("ARTICLE", articleId));
        consumePending();
        assertFalse(indexed("ARTICLE", articleId));

        String appealId = submitAppeal(author.token(), caseId);
        decideAppeal(appealId, "APPROVED").andExpect(jsonPath("$.code").value(200));
        consumePending();

        assertEquals("NORMAL", moderation(articleId));
        assertEquals("PUBLISHED", editorial(articleId));
        assertEquals("ACTIVE", lifecycle(articleId));
        assertEquals(200, articleDetail(articleId));
        assertTrue(indexed("ARTICLE", articleId));
        Map<String, Object> appeal = appealRow(appealId);
        assertEquals("APPROVED", appeal.get("status"));
        assertEquals("APPROVED", appeal.get("outcome"));
        assertEquals(adminId(), String.valueOf(appeal.get("decided_by")));
        assertNotNull(appeal.get("decided_at"));
        assertEquals(1, count("SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId));
        assertEquals(1, count("""
                SELECT COUNT(*) FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """, caseId));
        assertEquals("CLOSED", jdbcTemplate.queryForObject(
                "SELECT status FROM moderation_case WHERE id = ?", String.class, caseId));
    }

    @Test
    @DisplayName("场景B：驳回举报不隐藏，重复处理冲突")
    void dismissedReportLeavesArticlePublic() throws Exception {
        Person author = register("p25ba");
        Person reporter = register("p25br");
        String articleId = publishArticle(author.token(), "驳回文章");
        String reportId = submitReport(reporter.token(), "ARTICLE", articleId);
        String caseId = caseIdOf(reportId);

        decideReport(reportId, "DISMISSED").andExpect(jsonPath("$.code").value(200));
        consumePending();

        assertEquals("CLOSED", reportStatus(reportId));
        assertEquals("DISMISSED", decisionOf(caseId));
        assertEquals(0, measureCount(caseId));
        assertEquals("NORMAL", moderation(articleId));
        assertEquals(200, articleDetail(articleId));
        assertTrue(indexed("ARTICLE", articleId));

        decideReport(reportId, "UPHELD")
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("举报已处理"));
        assertEquals(1, count("SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId));
        assertEquals("NORMAL", moderation(articleId));
        assertTrue(indexed("ARTICLE", articleId));
    }

    @Test
    @DisplayName("场景C：驳回申诉继续隐藏，重复裁决冲突")
    void rejectedAppealStaysHiddenAfterConsumer() throws Exception {
        Person author = register("p25ca");
        Person reporter = register("p25cr");
        String articleId = publishArticle(author.token(), "驳回申诉");
        String reportId = submitReport(reporter.token(), "ARTICLE", articleId);
        decideReport(reportId, "UPHELD").andExpect(jsonPath("$.code").value(200));
        String appealId = submitAppeal(author.token(), caseIdOf(reportId));

        decideAppeal(appealId, "REJECTED").andExpect(jsonPath("$.code").value(200));
        consumePending();

        assertEquals("HIDDEN", moderation(articleId));
        assertEquals(404, articleDetail(articleId));
        assertFalse(indexed("ARTICLE", articleId));
        assertEquals("REJECTED", appealRow(appealId).get("outcome"));

        decideAppeal(appealId, "APPROVED")
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("申诉已处理"));
        assertEquals("HIDDEN", moderation(articleId));
        assertFalse(indexed("ARTICLE", articleId));
    }

    @Test
    @DisplayName("场景D：回收动态、删除评论、回收文章和空 prior 不被申诉公开")
    void priorStateSurvivesApprovedAppeal() throws Exception {
        Person author = register("p25da");
        Person reporter = register("p25dr");

        String momentId = createMoment(author.token(), "回收动态");
        mockMvc.perform(post("/api/v1/moments/" + momentId + "/trash").header("satoken", author.token()))
                .andExpect(status().isOk());
        String momentCase = uphold(reporter.token(), "MOMENT", momentId);
        assertEquals("TRASHED", momentStatus(momentId));
        assertEquals("TRASHED", priorOfCase(momentCase));
        approve(author.token(), momentCase);
        consumePending();
        assertEquals("TRASHED", momentStatus(momentId));
        assertEquals(404, momentDetail(momentId));
        assertFalse(indexed("MOMENT", momentId));

        String hostId = createMoment(author.token(), "评论宿主");
        String commentId = createComment(author.token(), hostId, "将删除");
        mockMvc.perform(delete("/api/v1/comments/" + commentId).header("satoken", author.token()))
                .andExpect(status().isNoContent());
        String commentCase = uphold(reporter.token(), "COMMENT", commentId);
        assertEquals("DELETED", commentStatus(commentId));
        approve(author.token(), commentCase);
        assertEquals("DELETED", commentStatus(commentId));
        assertFalse(commentListed(author.token(), hostId, commentId));

        String articleId = publishArticle(author.token(), "回收文章");
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash").header("satoken", author.token()))
                .andExpect(status().isOk());
        String articleCase = uphold(reporter.token(), "ARTICLE", articleId);
        approve(author.token(), articleCase);
        consumePending();
        assertEquals("NORMAL", moderation(articleId));
        assertEquals("TRASHED", lifecycle(articleId));
        assertEquals(404, articleDetail(articleId));
        assertFalse(indexed("ARTICLE", articleId));

        String hiddenMoment = createMoment(author.token(), "历史空prior");
        String nullCase = uphold(reporter.token(), "MOMENT", hiddenMoment);
        jdbcTemplate.update("""
                UPDATE moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                SET m.prior_status = NULL
                WHERE d.case_id = ?
                """, nullCase);
        approve(author.token(), nullCase);
        consumePending();
        assertEquals("HIDDEN", momentStatus(hiddenMoment));
        assertNull(priorOfCase(nullCase));
        assertFalse(indexed("MOMENT", hiddenMoment));
    }

    @Test
    @DisplayName("场景E：未登录、普通用户、无角色和禁用账号不能产生治理写入")
    void unauthorizedCallsDoNotWriteGovernance() throws Exception {
        Person author = register("p25ea");
        String momentId = createMoment(author.token(), "权限宿主");
        String reportId = submitReport(register("p25er").token(), "MOMENT", momentId);
        String caseId = caseIdOf(reportId);
        int decisions = count("SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId);

        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(401));

        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", author.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(401));

        String noRoleToken = seedAuthenticatedCommunityUserWithoutAdmin("p25plain");
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", noRoleToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("没有角色权限"));

        SeededAdmin disabledAdmin = seedCommunityAdmin("p25off");
        String token = loginAdmin(disabledAdmin.username());
        setCommunityStatus(disabledAdmin.userId(), "SUSPENDED");
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("用户已被禁用"));
        setCommunityStatus(disabledAdmin.userId(), "ACTIVE");
        mockMvc.perform(get("/api/v1/admin/moderation/reports").header("satoken", token))
                .andExpect(jsonPath("$.code").value(200));

        assertEquals(decisions, count("SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId));
        assertEquals(0, measureCount(caseId));
        assertEquals("PUBLISHED", momentStatus(momentId));
    }

    @Test
    @DisplayName("场景F：非法值、重复举报、不存在对象和终态不能产生副作用")
    void invalidAndRepeatedOperationsDoNotWrite() throws Exception {
        Person author = register("p25fa");
        Person reporter = register("p25fr");
        String articleId = publishArticle(author.token(), "非法输入");
        String reportId = submitReport(reporter.token(), "ARTICLE", articleId);
        String caseId = caseIdOf(reportId);

        decideReport(reportId, "BAN_USER")
                .andExpect(jsonPath("$.code").value(400));
        assertEquals("SUBMITTED", reportStatus(reportId));
        assertNull(decisionOf(caseId));
        assertEquals("NORMAL", moderation(articleId));
        assertTrue(indexed("ARTICLE", articleId));

        String again = submitReport(reporter.token(), "ARTICLE", articleId);
        assertEquals(reportId, again);
        assertEquals(1, count(
                "SELECT COUNT(*) FROM report WHERE object_id = ? AND reporter_id = ?",
                articleId, userId(reporter.username())));

        int code = bodyCode(mockMvc.perform(post("/api/v1/admin/moderation/reports/" + UUID.randomUUID() + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andReturn());
        assertNotEquals(200, code);
        code = bodyCode(mockMvc.perform(post("/api/v1/admin/moderation/cases/" + UUID.randomUUID() + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andReturn());
        assertNotEquals(200, code);
        code = bodyCode(mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + UUID.randomUUID() + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andReturn());
        assertNotEquals(200, code);
        assertNull(decisionOf(caseId));
        assertEquals("NORMAL", moderation(articleId));

        decideReport(reportId, "DISMISSED").andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", author.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"caseId\":\"" + caseId + "\",\"detail\":\"没有措施\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(409));
        assertEquals(1, count("SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId));
        assertEquals(0, measureCount(caseId));
        assertEquals(0, count("SELECT COUNT(*) FROM appeal WHERE case_id = ?", caseId));
        assertEquals("NORMAL", moderation(articleId));
        assertTrue(indexed("ARTICLE", articleId));
    }

    @Test
    @DisplayName("V058 能被文件名规则识别，测试库已有列，台账现状可核对")
    void v058ColumnExistsAndScriptIsRecognized() throws Exception {
        Integer column = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'moderation_measure'
                  AND COLUMN_NAME = 'prior_status'
                """, Integer.class);
        assertEquals(1, column);
        Integer ledger = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM schema_migration WHERE version IN ('058', '58')", Integer.class);
        assertNotNull(ledger);
        Path script = locate("sql", "V058__moderation_measure_prior_status.sql");
        assertTrue(Files.isRegularFile(script), script.toString());
        assertTrue(script.getFileName().toString().matches("V\\d+__.*\\.sql"));
    }

    private void consumePending() {
        for (int round = 0; round < 40; round++) {
            Integer pending = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                Integer.class));
    }

    private void assertAuditClosed(String reportId, String caseId, String reporterName, String articleId,
                                   String decision, String moderation, String prior) {
        Map<String, Object> report = jdbcTemplate.queryForMap(
                "SELECT status, reporter_id, object_type, object_id FROM report WHERE id = ?", reportId);
        assertEquals("CLOSED", report.get("status"));
        assertEquals(userId(reporterName), report.get("reporter_id"));
        assertEquals("ARTICLE", report.get("object_type"));
        assertEquals(articleId, report.get("object_id"));
        assertEquals("CLOSED", jdbcTemplate.queryForObject(
                "SELECT status FROM moderation_case WHERE id = ? AND report_id = ?",
                String.class, caseId, reportId));
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT decision, decided_by FROM moderation_decision WHERE case_id = ?", caseId);
        assertEquals(decision, row.get("decision"));
        assertEquals(adminId(), String.valueOf(row.get("decided_by")));
        Map<String, Object> measure = jdbcTemplate.queryForMap("""
                SELECT m.measure_type, m.target_type, m.target_id, m.prior_status
                FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """, caseId);
        assertEquals("HIDE_CONTENT", measure.get("measure_type"));
        assertEquals("ARTICLE", measure.get("target_type"));
        assertEquals(articleId, measure.get("target_id"));
        assertEquals(prior, measure.get("prior_status"));
        assertEquals(moderation, moderation(articleId));
    }

    private String uphold(String reporterToken, String type, String objectId) throws Exception {
        String reportId = submitReport(reporterToken, type, objectId);
        String caseId = caseIdOf(reportId);
        decideReport(reportId, "UPHELD").andExpect(jsonPath("$.code").value(200));
        return caseId;
    }

    private void approve(String authorToken, String caseId) throws Exception {
        String appealId = submitAppeal(authorToken, caseId);
        decideAppeal(appealId, "APPROVED").andExpect(jsonPath("$.code").value(200));
    }

    private org.springframework.test.web.servlet.ResultActions decideReport(String reportId, String decision)
            throws Exception {
        return mockMvc.perform(post("/api/v1/admin/moderation/reports/" + reportId + "/decide")
                .header("satoken", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"" + decision + "\"}"));
    }

    private org.springframework.test.web.servlet.ResultActions decideAppeal(String appealId, String decision)
            throws Exception {
        return mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                .header("satoken", adminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"" + decision + "\",\"comment\":\"回归\"}"));
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

    private String submitAppeal(String token, String caseId) throws Exception {
        String measureId = jdbcTemplate.queryForObject("""
                SELECT m.id FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """, String.class, caseId);
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

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String createComment(String token, String momentId, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","body":"%s"}
                                """.formatted(momentId, body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private Person register(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
        String email = username + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"Test1234!@#ab","rememberMe":false}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return new Person(username, login.getResponse().getHeader("satoken"));
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

    private String loginAdmin(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD
                                + "\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String seedAuthenticatedCommunityUserWithoutAdmin(String prefix) throws Exception {
        String username = prefix + (System.nanoTime() % 100_000_000L);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, PASSWORD);
        createdCommunityUserIds.add(userId);
        return CommunityTestSupport.loginThenRevokeAdmin(
                mockMvc, objectMapper, jdbcTemplate, userId, username, PASSWORD);
    }

    private SeededAdmin seedCommunityAdmin(String prefix) {
        String username = prefix + (System.nanoTime() % 100_000_000L);
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, PASSWORD);
        createdCommunityUserIds.add(userId);
        CommunityTestSupport.grantRole(jdbcTemplate, userId, "admin");
        return new SeededAdmin(userId, username);
    }

    private void setCommunityStatus(String communityUserId, String status) {
        jdbcTemplate.update("UPDATE community_user SET status = ? WHERE id = ?", status, communityUserId);
    }

    private String adminId() {
        return jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = 'admin' LIMIT 1", String.class);
    }

    private String userId(String username) {
        return jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = ?", String.class, username);
    }

    private String caseIdOf(String reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private String reportStatus(String reportId) {
        return jdbcTemplate.queryForObject("SELECT status FROM report WHERE id = ?", String.class, reportId);
    }

    private String decisionOf(String caseId) {
        return jdbcTemplate.query(
                "SELECT decision FROM moderation_decision WHERE case_id = ?",
                rs -> rs.next() ? rs.getString(1) : null, caseId);
    }

    private String priorOfCase(String caseId) {
        return jdbcTemplate.query("""
                SELECT m.prior_status FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """, rs -> rs.next() ? rs.getString(1) : null, caseId);
    }

    private Map<String, Object> appealRow(String appealId) {
        return jdbcTemplate.queryForMap(
                "SELECT status, outcome, decided_by, decided_at FROM appeal WHERE id = ?", appealId);
    }

    private int measureCount(String caseId) {
        return count("""
                SELECT COUNT(*) FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """, caseId);
    }

    private int count(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    private String moderation(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT moderation_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String editorial(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private String lifecycle(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT lifecycle_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    private int articleDetail(String articleId) throws Exception {
        return mockMvc.perform(get("/api/v1/articles/" + articleId)).andReturn().getResponse().getStatus();
    }

    private int momentDetail(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
    }

    private boolean commentListed(String token, String momentId, String commentId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/comments/MOMENT/" + momentId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        for (JsonNode row : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (commentId.equals(row.path("id").asText())) {
                return true;
            }
        }
        return false;
    }

    private boolean indexed(String type, String objectId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM search_document
                WHERE object_type = ? AND object_id = ? AND removed_at IS NULL
                """, Integer.class, type, objectId);
        return count != null && count > 0;
    }

    private int bodyCode(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        if (body == null || body.isBlank()) {
            return result.getResponse().getStatus();
        }
        JsonNode node = objectMapper.readTree(body);
        return node.has("code") ? node.get("code").asInt() : result.getResponse().getStatus();
    }

    private static Path locate(String directory, String filename) {
        Path current = Path.of(System.getProperty("user.dir"));
        for (int depth = 0; depth < 6 && current != null; depth++) {
            Path candidate = current.resolve(directory).resolve(filename);
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
            current = current.getParent();
        }
        return Path.of(directory, filename);
    }

    private record Person(String username, String token) {
    }

    private record SeededAdmin(String userId, String username) {
    }
}

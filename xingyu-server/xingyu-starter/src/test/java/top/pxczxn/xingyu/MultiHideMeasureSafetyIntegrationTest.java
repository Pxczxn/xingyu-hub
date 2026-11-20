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
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.service.SearchIndexService;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 同一动态上的多项隐藏措施：只有最后一项有效隐藏撤销后才恢复，
 * 并发创建记下的 prior_status 与加锁后看到的状态一致，失败时整笔回滚。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MultiHideMeasureSafetyIntegrationTest {

    @LocalServerPort
    private int port;

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
    @SpyBean
    private SearchIndexService searchIndexService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

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
    void resetIndexSpy() {
        reset(searchIndexService);
    }

    @Test
    @DisplayName("两项隐藏：撤销第一项后仍隐藏，撤销最后一项后恢复原状态")
    void revokingTheFirstOfTwoHidesKeepsTheMomentHidden() throws Exception {
        HiddenMoment hidden = hideMoment("two", "两项隐藏", 2);
        assertEquals(List.of("PUBLISHED", "HIDDEN"), hidden.priors());

        approve(hidden.appeals().get(0));

        assertHidden(hidden.momentId());
        assertEquals("PENDING", appealStatus(hidden.appeals().get(1)));

        approve(hidden.appeals().get(1));

        assertRestored(hidden.momentId());
    }

    @Test
    @DisplayName("三项隐藏逐项撤销，只有最后一项才恢复")
    void onlyTheThirdRevokeRestores() throws Exception {
        HiddenMoment hidden = hideMoment("three", "三项隐藏", 3);
        assertEquals(List.of("PUBLISHED", "HIDDEN", "HIDDEN"), hidden.priors());

        approve(hidden.appeals().get(0));
        assertHidden(hidden.momentId());
        approve(hidden.appeals().get(1));
        assertHidden(hidden.momentId());
        approve(hidden.appeals().get(2));

        assertRestored(hidden.momentId());
    }

    @Test
    @DisplayName("三项隐藏按相反顺序撤销，最终恢复结果一致")
    void reverseRevokeOrderRestoresTheSameStatus() throws Exception {
        HiddenMoment forward = hideMoment("ordF", "顺序甲", 3);
        HiddenMoment reverse = hideMoment("ordR", "顺序乙", 3);

        approve(forward.appeals().get(0));
        assertHidden(forward.momentId());
        approve(forward.appeals().get(1));
        assertHidden(forward.momentId());
        approve(forward.appeals().get(2));

        approve(reverse.appeals().get(2));
        assertHidden(reverse.momentId());
        approve(reverse.appeals().get(1));
        assertHidden(reverse.momentId());
        approve(reverse.appeals().get(0));

        assertRestored(forward.momentId());
        assertRestored(reverse.momentId());
        assertEquals("PUBLISHED", momentStatus(forward.momentId()));
        assertEquals(momentStatus(forward.momentId()), momentStatus(reverse.momentId()));
    }

    @Test
    @DisplayName("同一动态并发创建两项隐藏，prior_status 分别是加锁时看到的状态")
    void concurrentHidesRecordTheLockedStatus() throws Exception {
        String author = registerAndLogin("raceC");
        String momentId = createMoment(author, "并发创建");
        String firstCase = openCase(registerAndLogin("raceC1"), momentId);
        String secondCase = openCase(registerAndLogin("raceC2"), momentId);
        String token = adminToken();

        List<Integer> codes = decideTogether(token, List.of(
                "/api/v1/admin/moderation/cases/" + firstCase + "/decide",
                "/api/v1/admin/moderation/cases/" + secondCase + "/decide"),
                "{\"decision\":\"UPHELD\"}");

        assertEquals(List.of(200, 200), codes);
        assertEquals("HIDDEN", momentStatus(momentId));
        assertFalse(indexed(momentId));
        assertEquals(Set.of("PUBLISHED", "HIDDEN"), Set.copyOf(priorsOf(List.of(firstCase, secondCase))));
    }

    @Test
    @DisplayName("两项隐藏并发撤销，未全部批准前不恢复，结束后恢复一次")
    void concurrentRevokesDoNotRestoreEarly() throws Exception {
        HiddenMoment hidden = hideMoment("raceV", "并发撤销", 2);
        String token = adminToken();
        AtomicBoolean early = new AtomicBoolean(false);
        AtomicBoolean stop = new AtomicBoolean(false);
        Thread observer = new Thread(() -> {
            while (!stop.get()) {
                Map<String, Object> row = jdbcTemplate.queryForMap(
                        """
                        SELECT m.status AS status,
                               (SELECT COUNT(*) FROM appeal
                                WHERE id IN (?, ?) AND status <> 'APPROVED') AS pending
                        FROM moment m WHERE m.id = ?
                        """,
                        hidden.appeals().get(0), hidden.appeals().get(1), hidden.momentId());
                if ("PUBLISHED".equals(row.get("status")) && ((Number) row.get("pending")).intValue() > 0) {
                    early.set(true);
                }
            }
        });
        observer.start();
        try {
            List<Integer> codes = decideTogether(token, List.of(
                    "/api/v1/admin/moderation/appeals/" + hidden.appeals().get(0) + "/decide",
                    "/api/v1/admin/moderation/appeals/" + hidden.appeals().get(1) + "/decide"),
                    "{\"decision\":\"APPROVED\"}");
            assertEquals(List.of(200, 200), codes);
        } finally {
            stop.set(true);
            observer.join(5_000);
        }

        assertFalse(early.get());
        assertEquals("APPROVED", appealStatus(hidden.appeals().get(0)));
        assertEquals("APPROVED", appealStatus(hidden.appeals().get(1)));
        assertRestored(hidden.momentId());
    }

    @Test
    @DisplayName("隐藏执行到索引刷新失败时，措施、决定和动态状态一起回滚")
    void failedHideRollsBackMeasureAndStatus() throws Exception {
        String author = registerAndLogin("failA");
        String momentId = createMoment(author, "执行失败");
        String caseId = openCase(registerAndLogin("failR"), momentId);
        String caseStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM moderation_case WHERE id = ?", String.class, caseId);
        searchIndexService.refresh(SearchIndexService.MOMENT, momentId);
        assertTrue(indexed(momentId));
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("index refresh failed");
        }).when(searchIndexService).refresh(eq(SearchIndexService.MOMENT), eq(momentId));

        try {
            mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                            .header("satoken", adminToken())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"decision\":\"UPHELD\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(500))
                    .andExpect(jsonPath("$.message").value("index refresh failed"));
        } finally {
            doCallRealMethod().when(searchIndexService)
                    .refresh(eq(SearchIndexService.MOMENT), eq(momentId));
        }

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(caseStatus, jdbcTemplate.queryForObject(
                "SELECT status FROM moderation_case WHERE id = ?", String.class, caseId));
        assertEquals(0, count(
                "SELECT COUNT(*) FROM moderation_decision WHERE case_id = ?", caseId));
        assertEquals(0, count(
                """
                SELECT COUNT(*) FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                caseId));
        assertTrue(indexed(momentId));
        assertEquals(200, momentDetailStatus(momentId));
    }

    @Test
    @DisplayName("两项文章隐藏：撤销第一项后治理状态仍是 HIDDEN，最后一项写回 NORMAL")
    void revokingOneArticleHideLeavesTheOther() throws Exception {
        String author = registerAndLogin("artA");
        String articleId = publishArticle(author, "两项文章");
        List<String> cases = List.of(
                uphold(registerAndLogin("artR1"), "ARTICLE", articleId),
                uphold(registerAndLogin("artR2"), "ARTICLE", articleId));
        assertEquals(List.of("NORMAL", "HIDDEN"), cases.stream().map(this::priorStatus).toList());
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals("ACTIVE", articleColumn(articleId, "lifecycle_status"));
        assertEquals("HIDDEN", articleColumn(articleId, "moderation_status"));

        approve(submitAppeal(author, cases.get(0)));

        assertEquals("HIDDEN", articleColumn(articleId, "moderation_status"));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals("ACTIVE", articleColumn(articleId, "lifecycle_status"));
        assertEquals(404, detailStatus("/api/v1/articles/" + articleId));

        approve(submitAppeal(author, cases.get(1)));

        assertEquals("NORMAL", articleColumn(articleId, "moderation_status"));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals("ACTIVE", articleColumn(articleId, "lifecycle_status"));
        assertEquals(200, detailStatus("/api/v1/articles/" + articleId));
    }

    @Test
    @DisplayName("冻结文章的隐藏记下 FROZEN，最后一项撤销写回 FROZEN")
    void frozenArticleReturnsToFrozen() throws Exception {
        String author = registerAndLogin("frzA");
        String articleId = publishArticle(author, "冻结文章");
        jdbcTemplate.update("UPDATE article SET moderation_status = 'FROZEN' WHERE id = ?", articleId);
        String first = uphold(registerAndLogin("frzR1"), "ARTICLE", articleId);
        String second = uphold(registerAndLogin("frzR2"), "ARTICLE", articleId);
        assertEquals(List.of("FROZEN", "HIDDEN"), List.of(priorStatus(first), priorStatus(second)));
        assertEquals("HIDDEN", articleColumn(articleId, "moderation_status"));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));

        approve(submitAppeal(author, first));
        assertEquals("HIDDEN", articleColumn(articleId, "moderation_status"));
        assertEquals(404, detailStatus("/api/v1/articles/" + articleId));

        approve(submitAppeal(author, second));
        assertEquals("FROZEN", articleColumn(articleId, "moderation_status"));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals("ACTIVE", articleColumn(articleId, "lifecycle_status"));
        assertEquals(200, detailStatus("/api/v1/articles/" + articleId));
    }

    @Test
    @DisplayName("文章存在空 prior_status 时，撤销全部措施也不把治理状态改回 NORMAL")
    void nullArticlePriorStaysHidden() throws Exception {
        String author = registerAndLogin("anlA");
        String articleId = publishArticle(author, "文章空原状态");
        String first = uphold(registerAndLogin("anlR1"), "ARTICLE", articleId);
        String second = uphold(registerAndLogin("anlR2"), "ARTICLE", articleId);
        jdbcTemplate.update(
                """
                UPDATE moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                SET m.prior_status = NULL
                WHERE d.case_id = ?
                """,
                first);

        approve(submitAppeal(author, first));
        approve(submitAppeal(author, second));

        assertEquals("HIDDEN", articleColumn(articleId, "moderation_status"));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals(404, detailStatus("/api/v1/articles/" + articleId));
    }

    @Test
    @DisplayName("两项评论隐藏：撤销第一项后仍不可见，最后一项恢复为 VISIBLE")
    void revokingOneCommentHideLeavesTheOther() throws Exception {
        String author = registerAndLogin("cmtA");
        String momentId = createMoment(author, "评论宿主");
        String commentId = createComment(author, momentId, "两项评论");
        String first = uphold(registerAndLogin("cmtR1"), "COMMENT", commentId);
        String second = uphold(registerAndLogin("cmtR2"), "COMMENT", commentId);
        assertEquals(List.of("VISIBLE", "HIDDEN"), List.of(priorStatus(first), priorStatus(second)));
        assertEquals("HIDDEN", commentStatus(commentId));
        assertFalse(commentListed(author, momentId, commentId));

        approve(submitAppeal(author, first));
        assertEquals("HIDDEN", commentStatus(commentId));
        assertFalse(commentListed(author, momentId, commentId));

        approve(submitAppeal(author, second));
        assertEquals("VISIBLE", commentStatus(commentId));
        assertTrue(commentListed(author, momentId, commentId));
    }

    @Test
    @DisplayName("已删除评论的多项隐藏不把 DELETED 改成 HIDDEN 或 VISIBLE")
    void deletedCommentStaysDeletedAcrossHides() throws Exception {
        String author = registerAndLogin("delA");
        String momentId = createMoment(author, "删除宿主");
        String commentId = createComment(author, momentId, "已删除评论");
        mockMvc.perform(delete("/api/v1/comments/" + commentId).header("satoken", author))
                .andExpect(status().isNoContent());
        String first = uphold(registerAndLogin("delR1"), "COMMENT", commentId);
        String second = uphold(registerAndLogin("delR2"), "COMMENT", commentId);
        assertEquals(List.of("DELETED", "DELETED"), List.of(priorStatus(first), priorStatus(second)));
        assertEquals("DELETED", commentStatus(commentId));

        approve(submitAppeal(author, first));
        approve(submitAppeal(author, second));

        assertEquals("DELETED", commentStatus(commentId));
        assertFalse(commentListed(author, momentId, commentId));
    }

    private HiddenMoment hideMoment(String prefix, String body, int hides) throws Exception {
        String author = registerAndLogin(prefix + "a");
        String momentId = createMoment(author, body);
        List<String> appeals = new ArrayList<>();
        List<String> priors = new ArrayList<>();
        for (int i = 0; i < hides; i++) {
            String caseId = uphold(registerAndLogin(prefix + "r" + i), "MOMENT", momentId);
            priors.add(priorStatus(caseId));
            appeals.add(submitAppeal(author, caseId));
        }
        assertEquals("HIDDEN", momentStatus(momentId));
        return new HiddenMoment(momentId, List.copyOf(appeals), List.copyOf(priors));
    }

    private List<Integer> decideTogether(String token, List<String> paths, String json) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(paths.size());
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (String path : paths) {
                futures.add(pool.submit(() -> postCode(token, path, json)));
            }
            List<Integer> codes = new ArrayList<>();
            for (Future<Integer> future : futures) {
                codes.add(future.get(30, TimeUnit.SECONDS));
            }
            return codes;
        } finally {
            pool.shutdownNow();
        }
    }

    private int postCode(String token, String path, String json) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .header("satoken", token)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode body = objectMapper.readTree(response.body());
        return body.has("code") ? body.path("code").asInt() : response.statusCode();
    }

    private void approve(String appealId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(jsonPath("$.code").value(200));
    }

    private void assertHidden(String momentId) throws Exception {
        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
    }

    private void assertRestored(String momentId) throws Exception {
        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed(momentId));
    }

    private String uphold(String reporterToken, String type, String objectId) throws Exception {
        String caseId = openCase(reporterToken, type, objectId);
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(200));
        return caseId;
    }

    private String openCase(String reporterToken, String momentId) throws Exception {
        return openCase(reporterToken, "MOMENT", momentId);
    }

    private String openCase(String reporterToken, String type, String objectId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"SPAM"}
                                """.formatted(type, objectId)))
                .andExpect(status().isOk())
                .andReturn();
        String reportId = objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
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

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
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

    private List<String> priorsOf(List<String> caseIds) {
        List<String> priors = new ArrayList<>();
        for (String caseId : caseIds) {
            priors.add(priorStatus(caseId));
        }
        return priors;
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String appealStatus(String appealId) {
        return jdbcTemplate.queryForObject("SELECT status FROM appeal WHERE id = ?", String.class, appealId);
    }

    private int count(String sql, String id) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, id);
        return count == null ? 0 : count;
    }

    private int momentDetailStatus(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
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

    private String articleColumn(String articleId, String column) {
        return jdbcTemplate.queryForObject(
                "SELECT " + column + " FROM article WHERE id = ?", String.class, articleId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
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

    private int detailStatus(String path) throws Exception {
        return mockMvc.perform(get(path)).andReturn().getResponse().getStatus();
    }

    private boolean indexed(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM search_document
                WHERE object_type = 'MOMENT' AND object_id = ? AND removed_at IS NULL
                """,
                Integer.class, momentId);
        return count != null && count > 0;
    }

    private record HiddenMoment(String momentId, List<String> appeals, List<String> priors) {
    }
}

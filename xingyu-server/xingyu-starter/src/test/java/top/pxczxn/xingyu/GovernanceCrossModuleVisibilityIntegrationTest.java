package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 跨模块可见性：治理措施必须真的改变"其他模块看到的内容"。
 *
 * <p>只断言"status 变成了 HIDDEN"是不够的 —— 那只是字段。本测试从**真实的消费入口**
 * 出发，证明：
 * <ul>
 *   <li>MOMENT：隐藏后公开动态列表里不再出现；恢复后重新出现；搜索索引中消失/回归，
 *       且不残留"幽灵 SearchDocument"。</li>
 *   <li>COMMENT：comment 根本不在搜索索引里（{@code SearchIndexService} 对 COMMENT 是
 *       default 分支），所以隐藏/恢复**不得**凭空造出 search_document 行。</li>
 * </ul>
 *
 * <p>刻意**不碰** SERIES 章节可见性 —— 那是一个独立的、尚未定档的债务，治理测试不得
 * 顺手替它做决定。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GovernanceCrossModuleVisibilityIntegrationTest {

    private static final String PREFIX = "govvis-";
    private static final String USER_PREFIX = "govvis";

    /** Bounded so a handler that keeps failing cannot hang the test forever. */
    private static final int MAX_DRAIN_ROUNDS = 20;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ReliableEventConsumer eventConsumer;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        cleanup();
        adminToken = adminToken();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    /**
     * 纯 DML 清理（Test Infrastructure Gate Recovery，2026-10-09）。
     *
     * <p>历史实现用 {@code jdbcTemplate.execute} 建临时普通表来物化 ID 集合
     * （规避 error 1093 自引用删除、以及"同一语句多次引用"的问题），
     * 被静态门禁判定为测试源码改 schema。现在把 ID 集合收进 Java 侧 List，
     * 经 {@link NamedParameterJdbcTemplate} 以 IN 列表下发——语义等价、纯 DML、
     * 定位仍只靠本类专属前缀（并行安全不变）。
     */
    private void cleanup() {
        NamedParameterJdbcTemplate np = new NamedParameterJdbcTemplate(jdbcTemplate);
        Map<String, Object> prefixParams = Map.of(
                "email", PREFIX + "%@example.com",
                "username", USER_PREFIX + "%");

        List<String> anchor = new ArrayList<>();
        anchor.addAll(np.queryForList(
                "SELECT id FROM community_user WHERE email LIKE :email", prefixParams, String.class));
        anchor.addAll(np.queryForList(
                "SELECT user_id FROM community_profile WHERE username LIKE :username", prefixParams, String.class));
        if (anchor.isEmpty()) {
            return;
        }
        Map<String, Object> userParams = Map.of("users", anchor);

        List<String> reportIds = np.queryForList(
                "SELECT r.id FROM report r WHERE r.reporter_id IN (:users)", userParams, String.class);
        List<String> caseIds = reportIds.isEmpty() ? List.of() : np.queryForList(
                "SELECT id FROM moderation_case WHERE report_id IN (:reports)",
                Map.of("reports", reportIds), String.class);

        if (!caseIds.isEmpty()) {
            Map<String, Object> caseParams = Map.of("cases", caseIds);
            np.update("DELETE FROM moderation_measure WHERE decision_id IN "
                    + "(SELECT id FROM moderation_decision WHERE case_id IN (:cases))", caseParams);
            np.update("DELETE FROM moderation_decision WHERE case_id IN (:cases)", caseParams);
            np.update("DELETE FROM appeal WHERE case_id IN (:cases)", caseParams);
            np.update("DELETE FROM moderation_case WHERE id IN (:cases)", caseParams);
        }
        if (!reportIds.isEmpty()) {
            Map<String, Object> reportParams = Map.of("reports", reportIds);
            np.update("DELETE FROM report_supplement WHERE report_id IN (:reports)", reportParams);
            np.update("DELETE FROM report WHERE id IN (:reports)", reportParams);
        }

        // 索引行：按被治理对象清理（普通子查询，避免自引用 DELETE 报 1093）。
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM moment WHERE author_id IN (:users))", userParams);
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM comment WHERE author_id IN (:users))", userParams);
        np.update("DELETE FROM search_document WHERE object_id IN "
                + "(SELECT id FROM article WHERE owner_id IN (:users))", userParams);

        np.update("DELETE FROM comment WHERE author_id IN (:users)", userParams);
        np.update("DELETE FROM moment_revision WHERE moment_id IN "
                + "(SELECT id FROM moment WHERE author_id IN (:users))", userParams);
        np.update("DELETE FROM moment WHERE author_id IN (:users)", userParams);

        // 文章：从叶子往根删。审核记录挂在 submission 上，submission 挂在 article 上。
        List<String> articleIds = np.queryForList(
                "SELECT id FROM article WHERE owner_id IN (:users)", userParams, String.class);
        if (!articleIds.isEmpty()) {
            Map<String, Object> articleParams = Map.of("articles", articleIds);
            np.update("DELETE FROM review_decision WHERE submission_id IN "
                    + "(SELECT id FROM review_submission WHERE article_id IN (:articles))", articleParams);
            np.update("DELETE FROM review_submission WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM published_revision WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM working_draft WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM article_topic WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM formal_revision WHERE article_id IN (:articles)", articleParams);
            np.update("DELETE FROM article WHERE id IN (:articles)", articleParams);
        }

        np.update("DELETE FROM community_session WHERE user_id IN (:users)", userParams);
        np.update("DELETE FROM community_profile WHERE user_id IN (:users)", userParams);
        np.update("DELETE FROM community_user WHERE id IN (:users)", userParams);
    }

    // ---------------------------------------------------------------
    // MOMENT：真实消费入口
    // ---------------------------------------------------------------

    @Test
    void hidingAMomentRemovesItFromThePublicFeedAndTheIndex() throws Exception {
        Fixture f = hiddenMoment();

        // 真实入口 1：公开动态列表不再包含它。
        mockMvc.perform(get("/api/v1/moments").param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + f.momentId() + "')]").isEmpty());

        // 真实入口 2：首页组装不再包含它。
        mockMvc.perform(get("/api/v1/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..id").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.hasItem(f.momentId()))));

        // 索引：不得残留可被搜索到的行。
        assertFalse(indexed("MOMENT", f.momentId()), "隐藏后不得在搜索索引中可见");
    }

    @Test
    void restoringAMomentBringsItBackToThePublicFeedAndTheIndex() throws Exception {
        Fixture f = hiddenMoment();

        String appealId = submitAppeal(f.authorToken(), f.caseId(), f.measureId(), "应恢复");
        decideAppeal(appealId, "APPROVED");
        drainReliableEvents();

        assertEquals("PUBLISHED", momentStatus(f.momentId()), "批准后对象回到 PUBLISHED");

        // 真实入口 1：公开列表重新包含它。
        mockMvc.perform(get("/api/v1/moments").param("limit", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + f.momentId() + "')]").isNotEmpty());

        // 索引：回归（且不是"被移除了但行还在"的假回归）。
        assertTrue(indexed("MOMENT", f.momentId()), "恢复后必须回到搜索索引");
    }

    // ---------------------------------------------------------------
    // COMMENT：索引不是它的领域，绝不能造幽灵行
    // ---------------------------------------------------------------

    @Test
    void commentModerationNeverIntroducesASearchDocument() throws Exception {
        Fixture f = hiddenMoment();
        String commentId = createComment(f.authorToken(), "MOMENT", f.momentId(), PREFIX + "被治理评论");

        // 单独对评论发起举报并隐藏。
        String reportId = submitReport(f.reporterToken(), "COMMENT", commentId, "SPAM");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        drainReliableEvents();

        assertEquals("HIDDEN", commentStatus(commentId), "评论必须被隐藏");
        assertFalse(hasSearchDocument("COMMENT", commentId), "评论不参与索引，不得出现幽灵行");

        // 恢复后同理。
        String measureId = latestMeasureId(caseId);
        String appealId = submitAppeal(f.authorToken(), caseId, measureId, "恢复评论");
        decideAppeal(appealId, "APPROVED");
        drainReliableEvents();

        assertEquals("VISIBLE", commentStatus(commentId), "评论恢复后必须是 VISIBLE");
        assertFalse(hasSearchDocument("COMMENT", commentId), "恢复同样不得造出索引行");
    }

    // ---------------------------------------------------------------
    // ARTICLE：公开详情 + 首页 discoveries + 索引
    // ---------------------------------------------------------------

    /**
     * 文章走**真实**发布链路（草稿 → 提交 → 管理员审核通过），再走**真实**治理链路
     * （举报 → 案件裁定 UPHELD → 隐藏），断言三件事都真的发生：
     * <ol>
     *   <li>非作者访问公开详情 → 404（治理隐藏对读路径生效）；</li>
     *   <li>首页 discoveries 不再包含它（真实消费入口失效）；</li>
     *   <li>搜索索引行被移除（无幽灵行）。</li>
     * </ol>
     * 再用申诉批准恢复，断言详情重新可读、索引回归。
     */
    @Test
    void hidingAnArticleRemovesItFromThePublicDetailAndTheIndex() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorName = USER_PREFIX + "aowner" + (nonce % 100_000_000L);
        String reporterName = USER_PREFIX + "areporter" + (nonce % 100_000_000L);
        String authorEmail = authorName + "@example.com";
        String reporterEmail = reporterName + "@example.com";

        register(authorEmail, authorName, password);
        register(reporterEmail, reporterName, password);
        String authorToken = login(authorEmail, password);
        String reporterToken = login(reporterEmail, password);

        String articleId = publishArticle(authorToken, PREFIX + "跨模块可见性文章");
        drainReliableEvents();
        assertTrue(indexed("ARTICLE", articleId), "前置：公开文章必须先进入搜索索引");
        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isOk());

        String reportId = submitReport(reporterToken, "ARTICLE", articleId, "SPAM");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        drainReliableEvents();

        // 1. 非作者公开详情 404
        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        // 2. 首页 discoveries 不再包含
        mockMvc.perform(get("/api/v1/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..id").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.hasItem(articleId))));
        // 3. 索引移除
        assertFalse(indexed("ARTICLE", articleId), "隐藏后不得在搜索索引中可见");

        // 申诉批准 → 恢复
        String measureId = latestMeasureId(caseId);
        String appealId = submitAppeal(authorToken, caseId, measureId, "应恢复文章");
        decideAppeal(appealId, "APPROVED");
        drainReliableEvents();

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isOk());
        assertTrue(indexed("ARTICLE", articleId), "恢复后文章必须回到搜索索引");
    }

    // ---------------------------------------------------------------
    // fixtures
    // ---------------------------------------------------------------

    private record Fixture(String authorToken, String authorName, String reporterToken, String reporterName,
                           String momentId, String reportId, String caseId, String measureId) {
    }

    /** 造一个已被认定为违规的公开动态，并返回可申诉的 measure。 */
    private Fixture hiddenMoment() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorName = USER_PREFIX + "owner" + (nonce % 100_000_000L);
        String reporterName = USER_PREFIX + "reporter" + (nonce % 100_000_000L);
        String authorEmail = authorName + "@example.com";
        String reporterEmail = reporterName + "@example.com";

        register(authorEmail, authorName, password);
        register(reporterEmail, reporterName, password);
        String authorToken = login(authorEmail, password);
        String reporterToken = login(reporterEmail, password);

        String momentId = createMoment(authorToken, PREFIX + "跨模块可见性动态");
        // 生产链路是 outbox 异步消费：必须把事件抽干，否则断言的是"还没跑到的索引"。
        drainReliableEvents();
        // 发布后索引里应该先有一行（前置：证明"隐藏移除了东西"不是空谈）。
        assertTrue(indexed("MOMENT", momentId), "前置：公开动态必须先进入搜索索引");

        String reportId = submitReport(reporterToken, "MOMENT", momentId, "SPAM");
        String caseId = caseIdOf(reportId);
        decideCase(caseId, "UPHELD");
        drainReliableEvents();
        String measureId = latestMeasureId(caseId);
        assertEquals("HIDDEN", momentStatus(momentId), "前置：认定违规后动态必须隐藏");
        assertFalse(indexed("MOMENT", momentId), "前置：隐藏后必须已移出搜索索引");
        return new Fixture(authorToken, authorName, reporterToken, reporterName,
                momentId, reportId, caseId, measureId);
    }

    // ---- HTTP helpers ----

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
                .andReturn();
        return result.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
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

    /**
     * Publishes an article through the REAL pipeline: create draft → save draft → submit →
     * admin approve. Governance tests must not shortcut publishing with raw SQL.
     */
    private String publishArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("articleId").asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文内容","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(title)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk());

        MvcResult queueResult = mockMvc.perform(get("/api/v1/admin/review/queue")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode queueBody = objectMapper.readTree(queueResult.getResponse().getContentAsString());
        JsonNode queue = queueBody.isArray() ? queueBody : queueBody.path("data");
        String submissionId = null;
        for (JsonNode item : queue) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                submissionId = item.path("submissionId").asText(null);
                break;
            }
        }
        if (submissionId == null) {
            throw new IllegalStateException("审核队列里找不到本次提交的文章：" + articleId);
        }
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
        return articleId;
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

    private String submitReport(String token, String objectType, String objectId, String reason) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"%s"}
                                """.formatted(objectType, objectId, reason)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
    }

    private void decideCase(String caseId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    private String submitAppeal(String token, String caseId, String measureId, String detail) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"%s"}
                                """.formatted(caseId, measureId, detail)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private void decideAppeal(String appealId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    // ---- DB probes ----

    /**
     * Runs the real outbox consumer until nothing is pending.
     *
     * <p>The search index is NOT written synchronously by the create/hide/restore calls:
     * {@code MomentService} (and the moderation executor) publish a {@code reliable_event},
     * and the scheduled {@link ReliableEventConsumer} later hands it to
     * {@code SearchIndexEventHandler} → {@code SearchIndexService}. Asserting on the index
     * without draining first would race the poller. Calling {@code poll()} directly keeps the
     * test deterministic instead of sleeping.
     */
    private void drainReliableEvents() {
        for (int round = 0; round < MAX_DRAIN_ROUNDS; round++) {
            Integer pending = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    private String caseIdOf(String reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private String latestMeasureId(String caseId) {
        return jdbcTemplate.queryForObject(
                "SELECT mm.id FROM moderation_measure mm "
                        + "JOIN moderation_decision md ON md.id = mm.decision_id "
                        + "WHERE md.case_id = ? ORDER BY mm.created_at DESC LIMIT 1",
                String.class, caseId);
    }

    /** A row in search_document that a search would actually surface (removed_at IS NULL). */
    private boolean indexed(String objectType, String objectId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type = ? AND object_id = ? "
                        + "AND removed_at IS NULL",
                Integer.class, objectType, objectId);
        return n != null && n > 0;
    }

    /** A row exists at all, removed or not — used to prove COMMENT never gets one. */
    private boolean hasSearchDocument(String objectType, String objectId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type = ? AND object_id = ?",
                Integer.class, objectType, objectId);
        return n != null && n > 0;
    }
}

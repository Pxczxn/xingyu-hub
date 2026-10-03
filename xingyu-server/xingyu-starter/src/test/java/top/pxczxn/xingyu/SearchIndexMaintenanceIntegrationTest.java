package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 索引运维入口（`/api/v1/admin/community/search-index/**`）的集成测试。
 *
 * <p>对应产品文档 §20.3「索引更新失败必须可重试和人工重建」与 §1840 的「搜索索引健康、
 * dead-letter、重建」。断言的是**行为**，不是「接口存在」：
 *
 * <ol>
 *   <li>人工制造一次索引漂移（把索引行标成 removed，就像一次坏发布那样），
 *       再调单资源重建 —— 它必须被修回来；</li>
 *   <li>再漂移一次，调全量重建 —— 它只**入队**，把 outbox 排空后同样必须被修回来；</li>
 *   <li>health 同时反映投影与 outbox：排空后 pending 为 0，重建入队后 pending &gt;= 1。</li>
 * </ol>
 *
 * <p>「漂移」用一条 data UPDATE 制造（不是结构变更，测试源码里允许数据写入），
 * 因为要让重建**有东西可修**，索引必须先真的错掉 —— 否则测的只是「重建不报错」。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SearchIndexMaintenanceIntegrationTest {

    private static final int MAX_DRAIN_ROUNDS = 20;

    /** V027 renamed the session-token header from `Authorization` to `satoken`. */
    private static final String ADMIN_TOKEN_HEADER = "satoken";

    private static final String REBUILD_BASE = "/api/v1/admin/community/search-index";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ReliableEventConsumer eventConsumer;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
    }

    @Test
    @DisplayName("单资源重建与全量重建都能修回被漂移掉的索引行")
    void rebuildRepairsDriftedIndexEntries() throws Exception {
        String token = registerAndLogin("indexrebuild" + uniqueSuffix());
        String articleId = publishArticle(token, "索引重建验证文章");
        drainReliableEvents();
        assertTrue(isIndexed(articleId), "前置条件：文章已入索引");

        // 1. manufacture drift, then repair it with the single-resource rebuild (synchronous)
        markIndexRemoved(articleId);
        assertFalse(isIndexed(articleId), "前置条件：索引行已被标成 removed");

        mockMvc.perform(post(REBUILD_BASE + "/rebuild/ARTICLE/" + articleId)
                        .header(ADMIN_TOKEN_HEADER, adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REBUILT"));
        assertTrue(isIndexed(articleId), "单资源重建后应当重新入索引");

        // 2. drift again, then repair it with the full rebuild (queued, then drained)
        markIndexRemoved(articleId);
        assertFalse(isIndexed(articleId), "前置条件：再次制造漂移");

        MvcResult queued = mockMvc.perform(post(REBUILD_BASE + "/rebuild")
                        .header(ADMIN_TOKEN_HEADER, adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        long queuedCount = objectMapper
                .readTree(queued.getResponse().getContentAsString())
                .path("data")
                .path("queued")
                .asLong();
        assertTrue(queuedCount >= 1, "全量重建至少应当为这篇文章排一个事件");

        drainReliableEvents();
        assertTrue(isIndexed(articleId), "全量重建排空后应当重新入索引");
    }

    @Test
    @DisplayName("health 同时反映索引投影与事件积压")
    void healthReportsProjectionAndOutbox() throws Exception {
        String token = registerAndLogin("indexhealth" + uniqueSuffix());
        publishArticle(token, "索引健康验证文章");
        drainReliableEvents();

        JsonNode health = health();
        assertTrue(health.path("indexed").asLong() >= 1, "至少应当有刚发布的那篇文章在索引里");
        // We just drained the outbox, so nothing may be left waiting.
        assertTrue(health.path("pendingEvents").asLong() == 0,
                "排空后 pendingEvents 应当为 0，实际=" + health.path("pendingEvents").asLong());

        // Queueing a full rebuild must show up as backlog — that is the whole point of
        // reporting the outbox next to the projection.
        mockMvc.perform(post(REBUILD_BASE + "/rebuild").header(ADMIN_TOKEN_HEADER, adminToken()))
                .andExpect(status().isOk());
        assertTrue(health().path("pendingEvents").asLong() >= 1,
                "刚排入全量重建后 pendingEvents 应当大于 0");
    }

    // ---------------------------------------------------------------- helpers

    private JsonNode health() throws Exception {
        MvcResult result = mockMvc.perform(get(REBUILD_BASE + "/health")
                        .header(ADMIN_TOKEN_HEADER, adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    /** Simulates the drift a bad deploy would leave: the row exists but is marked removed. */
    private void markIndexRemoved(String articleId) {
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW()"
                        + " WHERE object_type = 'ARTICLE' AND object_id = ?",
                articleId);
    }

    private boolean isIndexed(String articleId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document"
                        + " WHERE object_type = 'ARTICLE' AND object_id = ? AND removed_at IS NULL",
                Integer.class, articleId);
        return count != null && count > 0;
    }

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

    private String registerAndLogin(String username) throws Exception {
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
                .andExpect(header().exists("satoken"))
                .andReturn();

        return login.getResponse().getHeader("satoken");
    }

    private String publishArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper
                .readTree(created.getResponse().getContentAsString())
                .get("articleId")
                .asText();

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

        String adminToken = adminToken();
        assertTrue(!adminToken.isBlank(), "管理员登录失败，无法完成审核发布");

        MvcResult queueResult = mockMvc.perform(get("/api/v1/admin/review/queue")
                        .header(ADMIN_TOKEN_HEADER, adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode queueBody = objectMapper.readTree(queueResult.getResponse().getContentAsString());
        JsonNode queue = queueBody.isArray() ? queueBody : queueBody.path("data");
        assertTrue(queue.isArray(), "审核队列响应不是数组：" + queueBody);

        String submissionId = null;
        for (JsonNode item : queue) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                submissionId = item.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "审核队列里找不到本次提交的文章：" + articleId);

        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header(ADMIN_TOKEN_HEADER, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());

        return articleId;
    }

    private String adminToken() throws Exception {
        MvcResult adminLogin = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andReturn();
        if (adminLogin.getResponse().getStatus() != 200) {
            return "";
        }
        return objectMapper
                .readTree(adminLogin.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText("");
    }

    private static String uniqueSuffix() {
        return Long.toString(System.nanoTime() % 1_000_000_000L);
    }
}

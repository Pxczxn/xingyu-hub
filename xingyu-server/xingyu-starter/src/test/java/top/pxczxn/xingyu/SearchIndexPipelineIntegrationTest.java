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

import static org.junit.jupiter.api.Assertions.assertEquals;
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
 * 公开搜索索引链路（2026-09-29 新增）的端到端验证。
 *
 * <p>在此之前 `search_document` **没有任何生产写入方**：发布文章只会把
 * `article.status` 置为 PUBLISHED 并写一行 `published_revision`，索引表始终为空。
 * 于是首页 feed、搜索、话题内容、发现页永远只有种子数据，收藏更是必然 404
 * （`CollectionService.validateObject` 要求对象已入索引）。
 *
 * <p>现在补上了「内容生命周期事件 → {@code SearchIndexEventHandler} → {@code SearchIndexService}
 * → {@code SearchIndexProvider}」这条链路（产品文档 v3.2 §20.3）。本测试断言的是**可观察结果**，
 * 而不是「事件发出去了」：
 * <ol>
 *   <li>发布后索引里真的有这行，且 `removed_at IS NULL`；</li>
 *   <li>它真的出现在公开首页 feed（`GET /api/v1/home` 的 discoveries）里；</li>
 *   <li>它真的可以收藏 —— 这正是之前做不到的那一步。</li>
 * </ol>
 *
 * <p>生产环境靠 `ReliableEventConsumer` 的定时轮询消费事件；测试里显式调它的
 * {@code poll()} 把 outbox 抽干，而不是 sleep 等运气。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SearchIndexPipelineIntegrationTest {

    /** Bounded so a handler that keeps failing cannot hang the test forever. */
    private static final int MAX_DRAIN_ROUNDS = 20;

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

    @Autowired
    private top.pxczxn.xingyu.community.service.SearchIndexService searchIndexService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
    }

    @Test
    @DisplayName("发布文章 → 索引落库 → 出现在首页 feed → 可以收藏")
    void publishedArticleBecomesIndexedVisibleAndBookmarkable() throws Exception {
        String token = registerAndLogin("indexflow" + uniqueSuffix());
        String articleId = publishArticle(token, "索引链路验证文章");

        // Give it one like so the article sorts to the front of `listActiveByHot`, which
        // orders by like count and only then by recency. Without it the assertion below would
        // depend on how much other content happens to be in the database.
        mockMvc.perform(post("/api/v1/likes/ARTICLE/" + articleId).header("satoken", token))
                .andExpect(status().isNoContent());

        drainReliableEvents();

        // 1. the index row exists and is live
        assertTrue(isIndexed("ARTICLE", articleId),
                "发布后 search_document 应当有该文章的行且 removed_at 为空");

        // 2. it is reachable through the public home composition
        JsonNode guestItem = discoveriesItem(null, articleId);
        assertNotNull(guestItem, "新发布的文章应当出现在首页 discoveries 里");

        // `bookmarked` is VIEWER-SCOPED, so a guest must get "unknown" — not false. Rendering
        // unknown as false would show a signed-out reader a wrong toggle state.
        assertFalse(guestItem.hasNonNull("bookmarked"),
                "游客视图里 bookmarked 应当是未知（null/缺省），而不是 false");
        assertFalse(guestItem.hasNonNull("liked"),
                "游客视图里 liked 同样是未知，而不是 false");

        // The COUNTS are not viewer-scoped, so a guest still gets them. This is also what
        // exercises the `likedObjectIds` batch query from the other direction.
        assertTrue(guestItem.hasNonNull("likeCount"), "点赞数对所有人可见");

        // 3. signed in, before bookmarking: the server can answer, and the answer is false
        JsonNode beforeItem = discoveriesItem(token, articleId);
        assertNotNull(beforeItem, "登录视图里也应当能看到这篇文章");
        assertTrue(beforeItem.hasNonNull("bookmarked"), "登录后 bookmarked 应当是已知值");
        assertFalse(beforeItem.path("bookmarked").asBoolean(), "尚未收藏时应当为 false");

        // This test liked the article earlier, so the viewer-scoped like batch must report it.
        assertTrue(beforeItem.path("liked").asBoolean(),
                "本测试已点过赞，登录视图里 liked 应当为 true");
        assertEquals(1, beforeItem.path("likeCount").asInt(), "点赞数应当为 1");

        // 4. bookmarking works at all — impossible before the index existed
        mockMvc.perform(post("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"ARTICLE","objectId":"%s"}
                                """.formatted(articleId)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/bookmarks/status")
                        .header("satoken", token)
                        .param("objectType", "ARTICLE")
                        .param("objectId", articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookmarked").value(true));

        // 5. and the home payload reflects it — this is what lets the 收藏 toggle start in the
        //    right state instead of guessing.
        JsonNode afterItem = discoveriesItem(token, articleId);
        assertNotNull(afterItem, "收藏后仍应能在首页看到这篇文章");
        assertTrue(afterItem.path("bookmarked").asBoolean(),
                "收藏后首页载荷里的 bookmarked 应当变成 true");
    }

    @Test
    @DisplayName("下架（治理隐藏）后索引行被标记为 removed")
    void hidingAnArticleRemovesItFromTheIndex() throws Exception {
        String token = registerAndLogin("indexhide" + uniqueSuffix());
        String articleId = publishArticle(token, "索引移除验证文章");
        drainReliableEvents();
        assertTrue(isIndexed("ARTICLE", articleId), "前置条件：文章已入索引");

        // Route it through the real index service — the same call the moderation executor and
        // the lifecycle events make — then assert the public result.
        jdbcTemplate.update(
                "UPDATE article SET moderation_status = 'HIDDEN' WHERE id = ?", articleId);
        indexServiceRefresh("ARTICLE", articleId);

        assertTrue(!isIndexed("ARTICLE", articleId),
                "被治理隐藏的文章不应再留在公开索引里");
    }

    // ---------------------------------------------------------------- helpers

    private void indexServiceRefresh(String objectType, String objectId) {
        searchIndexService.refresh(objectType, objectId);
    }

    /**
     * Runs the real consumer until the outbox has nothing pending. The production path is a
     * poller; calling it directly keeps the test deterministic instead of racing a timer.
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

    private boolean isIndexed(String objectType, String objectId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document"
                        + " WHERE object_type = ? AND object_id = ? AND removed_at IS NULL",
                Integer.class, objectType, objectId);
        return count != null && count > 0;
    }

    /**
     * The article's row in `GET /api/v1/home`'s discoveries, or null when it is not there.
     *
     * <p>`token` may be null: the endpoint serves guests too, and now carries the caller's
     * identity when there is one — which is exactly what makes `bookmarked` viewer-scoped.
     */
    private JsonNode discoveriesItem(String token, String articleId) throws Exception {
        var request = get("/api/v1/home");
        if (token != null) {
            request = request.header("satoken", token);
        }
        MvcResult home = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        JsonNode discoveries = objectMapper
                .readTree(home.getResponse().getContentAsString())
                .path("discoveries");
        for (JsonNode item : discoveries) {
            if (articleId.equals(item.path("objectId").asText(null))) {
                return item;
            }
        }
        return null;
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

    /** Draft → submit → admin approve. The publish path is what must produce the index event. */
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

    /** V027 renamed the session-token header from `Authorization` to `satoken`. */
    private static final String ADMIN_TOKEN_HEADER = "satoken";

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

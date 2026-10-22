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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.core.event.ReliableEventMapper;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 文章重新送审期间的公开可见性一致性。
 *
 * <p>业务契约：一篇文章一旦发布过，读者就应该能继续发现并阅读**已发布版本**；
 * 作者提交新版本进入审核只影响新版本，不能让旧版本在详情、搜索、话题、发现等入口消失。
 *
 * <p>本测试走真实链路（注册→审核放行→建稿→送审→管理员批准），只在需要模拟治理状态时
 * 直接改库并显式调用索引刷新（该路径由可靠事件驱动，测试里手工触发以避免等待 5 秒轮询）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ArticleRevisionVisibilityConsistencyIntegrationTest {

    private static final String PREFIX = "revcons-";
    private static final String USER_PREFIX = "revcons";
    private static final String TOPIC_ID = "01900000-0000-7000-8000-000000000003"; // tech
    private static final String TOPIC_SLUG = "tech";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ReliableEventMapper reliableEventMapper;

    @Autowired
    private top.pxczxn.xingyu.community.service.SearchIndexService searchIndexService;

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

    @Test
    void publishedRevisionStaysReadableAndDiscoverableWhileNextRevisionIsInReview() throws Exception {
        User author = createApprovedUser("author");
        String articleId = createAndPublish(author.token(), "首发标题", "首发正文", "PUBLIC");
        awaitSearchDocument(articleId, "首发标题");

        // v1 is public.
        mockMvc.perform(get("/api/v1/articles/" + articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("首发标题"));

        // Author edits and submits v2; the article flips to IN_REVIEW.
        saveDraft(author.token(), articleId, "新标题", "新正文");
        submit(author.token(), articleId);
        assertEquals("IN_REVIEW", articleStatus(articleId));

        // The reader still gets the PUBLISHED revision, not the draft and not a 404.
        mockMvc.perform(get("/api/v1/articles/" + articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("首发标题"))
                .andExpect(jsonPath("$.body").value("首发正文"));

        // Search still finds the published revision, and the draft title does not leak.
        assertEquals(1, countSearchHits("首发标题", articleId),
                "重新送审期间搜索必须仍能命中已发布版本");
        assertEquals(0, countSearchHits("新标题", articleId),
                "草稿/送审版本的内容不得进入搜索");

        // Every public discovery surface that lists articles must agree with search.
        assertTrue(idsOf(getBody("/api/v1/topics/" + TOPIC_SLUG + "/content?limit=50")).contains(articleId),
                "话题内容列表必须仍包含已发布版本");
        assertEquals(1, articleCountOf(author.username()),
                "重新送审期间个人主页的公开文章数不得减少");
        assertTrue(idsOf(getBody("/api/v1/discover?topic=" + TOPIC_SLUG + "&limit=50")).contains(articleId),
                "发现页按话题筛选必须仍包含已发布版本");
        assertTrue(spaceWorkIds(author).contains(articleId),
                "创作空间作品列表必须仍包含已发布版本");

        // Approving v2 replaces the public revision.
        approveLatest(articleId);
        awaitSearchDocument(articleId, "新标题");
        mockMvc.perform(get("/api/v1/articles/" + articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("新标题"))
                .andExpect(jsonPath("$.body").value("新正文"));
        assertEquals(0, countSearchHits("首发标题", articleId), "批准后搜索结果应更新为新版本标题");
    }

    @Test
    void firstSubmissionBeforeAnyPublishIsNotReadableOrDiscoverable() throws Exception {
        User author = createApprovedUser("first");
        String articleId = createArticle(author.token());
        saveDraft(author.token(), articleId, "未发布标题", "未发布正文");
        submit(author.token(), articleId);

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        assertEquals(0, countSearchHits("未发布标题", articleId), "从未发布的内容不得进入搜索");
        assertFalse(idsOf(getBody("/api/v1/topics/" + TOPIC_SLUG + "/content?limit=50")).contains(articleId));
        assertFalse(idsOf(getBody("/api/v1/discover?topic=" + TOPIC_SLUG + "&limit=50")).contains(articleId));
    }

    @Test
    void rejectedRevisionKeepsPreviousPublishedVersionReadable() throws Exception {
        User author = createApprovedUser("reject");
        String articleId = createAndPublish(author.token(), "已发布标题", "已发布正文", "PUBLIC");
        awaitSearchDocument(articleId, "已发布标题");

        saveDraft(author.token(), articleId, "被拒标题", "被拒正文");
        submit(author.token(), articleId);
        rejectLatest(articleId);
        assertEquals("DRAFT", articleStatus(articleId));

        mockMvc.perform(get("/api/v1/articles/" + articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("已发布标题"))
                .andExpect(jsonPath("$.body").value("已发布正文"));
        assertEquals(1, countSearchHits("已发布标题", articleId), "拒绝后仍应命中已发布版本");
        assertEquals(0, countSearchHits("被拒标题", articleId), "被拒版本不得进入搜索");
    }

    @Test
    void governanceHiddenArticleDisappearsFromReadAndDiscovery() throws Exception {
        User author = createApprovedUser("hidden");
        String articleId = createAndPublish(author.token(), "治理标题", "治理正文", "PUBLIC");
        awaitSearchDocument(articleId, "治理标题");

        // Simulate the governance measure landing, then run the same index refresh the
        // reliable-event consumer would run (avoids waiting for the 5s poll).
        jdbcTemplate.update("UPDATE article SET moderation_status='HIDDEN' WHERE id = ?", articleId);
        searchIndexService.refresh("ARTICLE", articleId);

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/articles/" + articleId).header("satoken", author.token()))
                .andExpect(status().isOk());
        assertEquals(0, countSearchHits("治理标题", articleId), "治理隐藏内容不得出现在搜索");
        assertFalse(idsOf(getBody("/api/v1/topics/" + TOPIC_SLUG + "/content?limit=50")).contains(articleId));
        assertFalse(idsOf(getBody("/api/v1/discover?topic=" + TOPIC_SLUG + "&limit=50")).contains(articleId));
        assertFalse(spaceWorkIds(author).contains(articleId), "治理隐藏内容不得出现在创作空间作品列表");
    }

    @Test
    void privateArticleIsNotReadableOrDiscoverableByOthers() throws Exception {
        User author = createApprovedUser("private");
        String articleId = createAndPublish(author.token(), "私有标题", "私有正文", "PRIVATE");

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/articles/" + articleId).header("satoken", author.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("私有标题"));
        assertEquals(0, countSearchHits("私有标题", articleId), "PRIVATE 文章不得进入搜索");
        assertFalse(idsOf(getBody("/api/v1/topics/" + TOPIC_SLUG + "/content?limit=50")).contains(articleId));
        assertFalse(spaceWorkIds(author).contains(articleId), "PRIVATE 文章不得出现在公开作品列表");
    }

    @Test
    void followingFeedKeepsPublishedRevisionWhileNextRevisionInReview() throws Exception {
        User author = createApprovedUser("followee");
        User reader = createApprovedUser("follower");
        String articleId = createAndPublish(author.token(), "关注流标题", "关注流正文", "PUBLIC");
        awaitSearchDocument(articleId, "关注流标题");

        mockMvc.perform(post("/api/v1/follows/users/" + author.id())
                        .header("satoken", reader.token()))
                .andExpect(status().isNoContent());
        assertTrue(feedIds(reader.token()).contains(articleId), "关注流初始应包含已发布文章");

        saveDraft(author.token(), articleId, "关注流新标题", "关注流新正文");
        submit(author.token(), articleId);

        assertTrue(feedIds(reader.token()).contains(articleId),
                "重新送审期间关注流必须仍包含已发布版本");
    }

    // ---- HTTP flows ----

    private record User(String token, String id, String email, String username) {
    }

    private static final AtomicInteger SEQ = new AtomicInteger();

    private User createApprovedUser(String tag) throws Exception {
        int seq = SEQ.incrementAndGet();
        String email = PREFIX + tag + "-" + seq + "@example.com";
        String username = USER_PREFIX + tag + seq;
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Passw0rd!23","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk());
        String userId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email = ?", String.class, email);
        assertNotNull(userId);
        mockMvc.perform(post("/api/v1/admin/community/users/" + userId + "/approve")
                        .header("satoken", adminToken))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"Passw0rd!23","rememberMe":false}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        String token = login.getResponse().getHeader("satoken");
        assertNotNull(token);
        return new User(token, userId, email, username);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
        assertFalse(token.isBlank());
        return token;
    }

    private String createArticle(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("articleId").asText();
    }

    private String createAndPublish(String token, String title, String body, String visibility) throws Exception {
        String articleId = createArticle(token);
        saveDraft(token, articleId, title, body, visibility);
        submit(token, articleId);
        approveLatest(articleId);
        assertEquals("PUBLISHED", articleStatus(articleId));
        return articleId;
    }

    private void saveDraft(String token, String articleId, String title, String body) throws Exception {
        saveDraft(token, articleId, title, body, "PUBLIC");
    }

    private void saveDraft(String token, String articleId, String title, String body, String visibility) throws Exception {
        MvcResult current = mockMvc.perform(get("/api/v1/me/articles/" + articleId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        long lockVersion = objectMapper.readTree(current.getResponse().getContentAsString())
                .path("lockVersion").asLong();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"%s","visibility":"%s","lockVersion":%d,"topicIds":["%s"]}
                                """.formatted(title, body, visibility, lockVersion, TOPIC_ID)))
                .andExpect(status().isOk());
    }

    private void submit(String token, String articleId) throws Exception {
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk());
    }

    private void approveLatest(String articleId) throws Exception {
        decideLatest(articleId, "APPROVED");
    }

    private void rejectLatest(String articleId) throws Exception {
        decideLatest(articleId, "REJECTED");
    }

    private void decideLatest(String articleId, String decision) throws Exception {
        String submissionId = latestSubmissionId(articleId);
        assertNotNull(submissionId, "审核队列里找不到文章 " + articleId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\",\"comment\":\"test\"}"))
                .andExpect(status().isOk());
    }

    private String latestSubmissionId(String articleId) throws Exception {
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode items = body.isArray() ? body : body.path("data");
        for (JsonNode item : items) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                return item.path("submissionId").asText(null);
            }
        }
        return null;
    }

    // ---- probes ----

    private int articleCountOf(String username) throws Exception {
        JsonNode body = objectMapper.readTree(getBody("/api/v1/u/" + username));
        return body.path("articleCount").asInt();
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private String getBody(String path) throws Exception {
        MvcResult result = mockMvc.perform(get(path)).andReturn();
        int status = result.getResponse().getStatus();
        String body = result.getResponse().getContentAsString();
        if (status != 200) {
            throw new AssertionError("GET " + path + " -> " + status + " body=" + body);
        }
        return body;
    }

    private List<String> idsOf(String json) throws Exception {
        JsonNode node = objectMapper.readTree(json);
        JsonNode items = node.isArray() ? node : node.path("items");
        java.util.ArrayList<String> ids = new java.util.ArrayList<>();
        for (JsonNode item : items) {
            ids.add(item.path("id").asText(null));
        }
        return ids;
    }

    private List<String> spaceWorkIds(User author) throws Exception {
        String spaceSlug = jdbcTemplate.queryForObject(
                "SELECT slug FROM community_creation_space WHERE user_id = ?", String.class, author.id());
        JsonNode body = objectMapper.readTree(getBody("/api/v1/spaces/" + spaceSlug + "/works"));
        java.util.ArrayList<String> ids = new java.util.ArrayList<>();
        for (JsonNode work : body.path("works")) {
            ids.add(work.path("id").asText(null));
        }
        return ids;
    }

    private List<String> feedIds(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/feed")
                        .param("type", "following")
                        .param("size", "50")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        java.util.ArrayList<String> ids = new java.util.ArrayList<>();
        for (JsonNode item : objectMapper.readTree(result.getResponse().getContentAsString())) {
            ids.add(item.path("id").asText(null));
        }
        return ids;
    }

    private int countSearchHits(String query, String articleId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/search")
                        .param("q", query)
                        .param("type", "ARTICLE")
                        .param("limit", "50"))
                .andExpect(status().isOk())
                .andReturn();
        int hits = 0;
        for (JsonNode item : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (articleId.equals(item.path("objectId").asText(null))) {
                hits++;
            }
        }
        return hits;
    }

    /**
     * 搜索索引由可靠事件异步驱动。轮询真实索引行，不缩短生产链路。
     */
    private void awaitSearchDocument(String articleId, String expectedTitle) throws Exception {
        for (int i = 0; i < 150; i++) {
            List<String> titles = jdbcTemplate.queryForList(
                    "SELECT title FROM search_document WHERE object_type='ARTICLE' AND object_id=? AND removed_at IS NULL",
                    String.class, articleId);
            if (titles.size() == 1 && expectedTitle.equals(titles.get(0))) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("等待搜索索引超时：article=" + articleId + " title=" + expectedTitle);
    }

    // ---- cleanup ----

    private void cleanup() {
        String userSub = "SELECT id FROM community_user WHERE email LIKE '" + PREFIX + "%@example.com'";
        String articleSub = "SELECT id FROM article WHERE owner_id IN (" + userSub + ")";
        jdbcTemplate.update("DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id IN (" + articleSub + "))");
        jdbcTemplate.update("DELETE FROM review_submission WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM search_document WHERE object_type='ARTICLE' AND object_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM reliable_event WHERE aggregate_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM article_topic WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM published_revision WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM working_draft WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM article WHERE owner_id IN (" + userSub + ")");
        jdbcTemplate.update("DELETE FROM community_session WHERE user_id IN (" + userSub + ")");
        jdbcTemplate.update("DELETE FROM username_history WHERE user_id IN (" + userSub + ")");
        jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id IN (" + userSub + ")");
        jdbcTemplate.update("DELETE FROM community_profile WHERE user_id IN (" + userSub + ")");
        jdbcTemplate.update("DELETE FROM community_user WHERE email LIKE '" + PREFIX + "%@example.com'");
    }
}

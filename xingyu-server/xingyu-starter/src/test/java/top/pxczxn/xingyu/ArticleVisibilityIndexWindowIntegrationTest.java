package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.service.SearchIndexService;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 可见性收紧后的索引窗口审计。
 *
 * <p>问题：公开列表/搜索信任 {@code search_document}。索引由可靠事件异步维护（默认 5 秒轮询）。
 * 若文章转 PRIVATE、移入回收站后只发事件，则在事件被消费之前，索引仍标记为活文档，
 * 搜索与发现入口会继续展示其标题/摘要——而详情接口已经 404。这不是"内容新鲜度延迟"，
 * 而是把不应公开的标题暴露给无权读者。
 *
 * <p>本测试用 {@link ReliableEventConsumer} 的 mock 关闭异步消费，把"事件尚未被处理"的
 * 窗口固定下来：写路径若只发事件，索引永远不会更新，断言必然失败；写路径若同步刷新索引
 * （治理隐藏已经这样做），断言通过。这样验证的是确定性行为，而不是和 5 秒轮询赛跑。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ArticleVisibilityIndexWindowIntegrationTest {

    private static final String PREFIX = "viswin-";
    private static final String USER_PREFIX = "viswin";
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
    private SearchIndexService searchIndexService;

    /** 关闭异步索引消费：把"事件尚未处理"的窗口固定成确定性状态。 */
    @MockBean
    private ReliableEventConsumer consumer;

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
    void privateArticleLeavesSearchAndDiscoveryImmediately() throws Exception {
        User author = createApprovedUser("priv");
        String articleId = createAndPublish(author.token(), "转私密标题", "转私密正文", "PUBLIC");
        // 索引由事件异步维护；这里手工建立"已公开"的索引基线。
        searchIndexService.refresh("ARTICLE", articleId);
        assertTrue(searchIds("转私密标题").contains(articleId), "基线：公开文章应可被搜索");

        // 作者改为 PRIVATE，重新送审并批准：发布指针切到 PRIVATE 版本。
        saveDraft(author.token(), articleId, "转私密标题", "转私密正文", "PRIVATE");
        submit(author.token(), articleId);
        approveLatest(articleId);

        // 详情同步拒绝；搜索/话题/发现必须同样立即拒绝，而不是等 5 秒。
        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        assertFalse(searchIds("转私密标题").contains(articleId),
                "转 PRIVATE 后搜索不得继续返回标题（索引窗口泄露）");
        assertFalse(topicIds().contains(articleId), "转 PRIVATE 后话题内容不得继续返回");
        assertFalse(discoverIds().contains(articleId), "转 PRIVATE 后发现页不得继续返回");
    }

    @Test
    void trashedArticleLeavesSearchAndDiscoveryImmediately() throws Exception {
        User author = createApprovedUser("trash");
        String articleId = createAndPublish(author.token(), "回收站标题", "回收站正文", "PUBLIC");
        searchIndexService.refresh("ARTICLE", articleId);
        assertTrue(searchIds("回收站标题").contains(articleId), "基线：公开文章应可被搜索");

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash")
                        .header("satoken", author.token()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/restore")
                        .header("satoken", author.token()))
                .andExpect(status().isNoContent());
        // 恢复后仍是 PUBLIC 的已发布版本：应重新可发现（这里只验证恢复不报错，
        // 恢复后的索引重建同样由写路径负责；见 restoreArticle）。

        // 再删一次，固定"删除后、索引刷新前"的状态。
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash")
                        .header("satoken", author.token()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isNotFound());
        assertFalse(searchIds("回收站标题").contains(articleId),
                "删除后搜索不得继续返回标题（索引窗口泄露）");
        assertFalse(topicIds().contains(articleId), "删除后话题内容不得继续返回");
        assertFalse(discoverIds().contains(articleId), "删除后发现页不得继续返回");
    }

    @Test
    void restoringPublishedArticleMakesItDiscoverableAgain() throws Exception {
        User author = createApprovedUser("restore");
        String articleId = createAndPublish(author.token(), "恢复标题", "恢复正文", "PUBLIC");
        searchIndexService.refresh("ARTICLE", articleId);

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash")
                        .header("satoken", author.token())).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/restore")
                        .header("satoken", author.token())).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/articles/" + articleId)).andExpect(status().isOk());
        assertTrue(searchIds("恢复标题").contains(articleId),
                "恢复已发布文章后应重新进入搜索（不能等下一条事件）");
    }

    // ---- helpers ----

    private record User(String token, String id, String username) {
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
        mockMvc.perform(post("/api/v1/admin/community/users/" + userId + "/approve")
                        .header("satoken", adminToken)).andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"Passw0rd!23","rememberMe":false}
                                """.formatted(email)))
                .andExpect(status().isOk()).andReturn();
        return new User(login.getResponse().getHeader("satoken"), userId, username);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk()).andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
        assertFalse(token.isBlank(), "admin 登录必须返回 token");
        return token;
    }

    private String createAndPublish(String token, String title, String body, String visibility) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("articleId").asText();
        saveDraft(token, articleId, title, body, visibility);
        submit(token, articleId);
        approveLatest(articleId);
        return articleId;
    }

    private void saveDraft(String token, String articleId, String title, String body, String visibility) throws Exception {
        MvcResult current = mockMvc.perform(get("/api/v1/me/articles/" + articleId).header("satoken", token))
                .andExpect(status().isOk()).andReturn();
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
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", token))
                .andExpect(status().isOk());
    }

    private void approveLatest(String articleId) throws Exception {
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", adminToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode items = body.isArray() ? body : body.path("data");
        String submissionId = null;
        for (JsonNode item : items) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                submissionId = item.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "审核队列里找不到文章 " + articleId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"test\"}"))
                .andExpect(status().isOk());
    }

    private List<String> searchIds(String query) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/search")
                        .param("q", query).param("type", "ARTICLE").param("limit", "50"))
                .andExpect(status().isOk()).andReturn();
        List<String> ids = new ArrayList<>();
        for (JsonNode item : objectMapper.readTree(result.getResponse().getContentAsString())) {
            ids.add(item.path("objectId").asText(null));
        }
        return ids;
    }

    private List<String> topicIds() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/topics/" + TOPIC_SLUG + "/content")
                        .param("limit", "50"))
                .andExpect(status().isOk()).andReturn();
        List<String> ids = new ArrayList<>();
        for (JsonNode item : objectMapper.readTree(result.getResponse().getContentAsString())) {
            ids.add(item.path("id").asText(null));
        }
        return ids;
    }

    private List<String> discoverIds() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/discover")
                        .param("topic", TOPIC_SLUG).param("limit", "50"))
                .andExpect(status().isOk()).andReturn();
        List<String> ids = new ArrayList<>();
        for (JsonNode item : objectMapper.readTree(result.getResponse().getContentAsString()).path("items")) {
            ids.add(item.path("id").asText(null));
        }
        return ids;
    }

    private void cleanup() {
        String userSub = "SELECT id FROM community_user WHERE email LIKE '" + PREFIX + "%@example.com'";
        String articleSub = "SELECT id FROM article WHERE owner_id IN (" + userSub + ")";
        jdbcTemplate.update("DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id IN (" + articleSub + "))");
        jdbcTemplate.update("DELETE FROM review_submission WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM search_document WHERE object_type='ARTICLE' AND object_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM reliable_event WHERE aggregate_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM article_topic WHERE article_id IN (" + articleSub + ")");
        jdbcTemplate.update("DELETE FROM content_trash WHERE object_type='ARTICLE' AND object_id IN (" + articleSub + ")");
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

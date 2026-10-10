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
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Static Design Final Fix CB-2 回归（2026-10-09）。
 *
 * <p>系列章节标题契约：owner 管理视图的草稿章节回退 working_draft.title；
 * 已发布章节保持正式版本标题；非作者无法经管理接口读取；公开系列接口不泄露
 * 草稿标题；章节顺序不回归。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StudioSeriesChapterTitleIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;
    @Autowired
    private top.pxczxn.xingyu.core.event.ReliableEventConsumer eventConsumer;

    private static final int MAX_DRAIN_ROUNDS = 20;

    private final List<String> userIds = new ArrayList<>();
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        userIds.clear();
        adminToken = adminLogin();
    }

    @AfterEach
    void tearDown() {
        for (String userId : userIds) {
            jdbcTemplate.update("""
                    DELETE wd FROM working_draft wd
                    JOIN article a ON a.id = wd.article_id WHERE a.owner_id = ?
                    """, userId);
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?))", userId);
            jdbcTemplate.update("DELETE FROM review_submission WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM article_topic WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM article WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE sc FROM series_chapter sc JOIN series s ON sc.series_id = s.id WHERE s.owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM series WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
    }

    @Test
    void draftChaptersShowWorkingDraftTitleAndPublicationDoesNotLeakIt() throws Exception {
        Fixture author = fixture("cb2a");
        Fixture outsider = fixture("cb2b");

        // 1. 草稿文章：working_draft.title = "草稿章节的真标题"
        String draftId = createArticle(author.token(), "草稿章节的真标题", "纯草稿正文");
        // 2. 已发布文章：正式标题 "已发布章节标题"
        String publishedId = createArticle(author.token(), "已发布章节标题", "已发布正文");
        String submissionId = submit(author.token(), publishedId);
        approve(submissionId);
        // 公开侧章节标题以搜索索引文档为准；发布经 outbox 异步建索引——显式抽干
        // reliable_event 保证确定性（与 SearchIndexPipelineIntegrationTest 同法）。
        drainReliableEvents();

        // 3. 系列编排：已发布在前、草稿在后（顺序断言用）
        String seriesId = createSeries(author.token(), "cb2-series-" + (System.nanoTime() % 1000000));
        updateChapters(author.token(), seriesId, publishedId, draftId);

        // 4. 作者管理视图：草稿章节 = working_draft.title；已发布章节 = 正式标题；顺序保持
        MvcResult mine = mockMvc.perform(get("/api/v1/me/series/" + seriesId)
                        .header("satoken", author.token()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode mineChapters = objectMapper.readTree(mine.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("chapters");
        assertEquals(2, mineChapters.size());
        assertEquals("已发布章节标题", mineChapters.get(0).path("title").asText(),
                "已发布章节必须保持正式版本标题");
        assertEquals("草稿章节的真标题", mineChapters.get(1).path("title").asText(),
                "草稿章节必须回退 working_draft.title（CB-2 修复前为 null → 前端显示无标题文章）");
        assertEquals(publishedId, mineChapters.get(0).path("articleId").asText(), "章节顺序不得回归");

        // 5. 非作者走创作者管理接口 → 404（不泄露，requireOwnedSeries）
        mockMvc.perform(get("/api/v1/me/series/" + seriesId)
                        .header("satoken", outsider.token()))
                .andExpect(status().isNotFound());

        // 6. 公开系列接口：不泄露草稿标题
        String slug = jdbcTemplate.queryForObject(
                "SELECT slug FROM series WHERE id = ?", String.class, seriesId);
        String ownerUsername = jdbcTemplate.queryForObject("""
                SELECT p.username FROM community_profile p
                JOIN series s ON s.owner_id = p.user_id WHERE s.id = ?
                """, String.class, seriesId);
        MvcResult pub = mockMvc.perform(get("/api/v1/series/" + ownerUsername + "/" + slug))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode pubChapters = objectMapper.readTree(pub.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("chapters");
        assertEquals(2, pubChapters.size(), "公开侧章节列表结构不变");
        assertEquals("已发布章节标题", pubChapters.get(0).path("title").asText(),
                "公开侧已发布章节标题正常");
        assertTrue(pubChapters.get(1).path("title").isNull() || pubChapters.get(1).path("title").asText().isEmpty(),
                "公开侧草稿章节标题必须保持为空——working_draft 标题不得泄露");
    }

    // ---- helpers ----

    private record Fixture(String userId, String token) {
    }

    private String adminLogin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private void approve(String submissionId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
    }

    /** 显式消费 outbox 事件（发布→搜索索引为异步链路），替代 sleep 等运气。 */
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

    private String submit(String token, String articleId) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(r.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("submissionId").asText();
    }

    private String createArticle(String token, String title, String body) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"bodyMode\":\"MARKDOWN\","
                                + "\"body\":\"" + body + "\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String createSeries(String token, String slug) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"CB2 审计系列\",\"slug\":\"" + slug + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(created.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        return json.path("id").asText(null) != null
                ? json.path("id").asText()
                : json.path("data").path("id").asText();
    }

    private void updateChapters(String token, String seriesId, String... articleIds) throws Exception {
        StringBuilder ids = new StringBuilder("[");
        for (int i = 0; i < articleIds.length; i++) {
            if (i > 0) ids.append(",");
            ids.append("\"").append(articleIds[i]).append("\"");
        }
        ids.append("]");
        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"chapterArticleIds\":" + ids + ",\"lockVersion\":0}"))
                .andExpect(status().isOk());
    }

    private Fixture fixture(String prefix) throws Exception {
        String email = prefix + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, display_name, visibility, followers_visibility, created_at)
                VALUES (?, ?, ?, ?, 'PUBLIC', 'PRIVATE', NOW())
                """, UUID.randomUUID().toString(), userId, prefix + (System.nanoTime() % 100000000L),
                prefix + "-display");
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + "-space-" + (System.nanoTime() % 100000000L));

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = login.getResponse().getHeader("satoken");
        assertNotNull(token);
        return new Fixture(userId, token);
    }
}

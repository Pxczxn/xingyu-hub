package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import top.pxczxn.xingyu.community.support.PasswordSupport;

/**
 * 收藏生命周期回归（2026-10-10 P0-C）。
 *
 * <p>背景：前端收藏 UI 曾因 interactions.api.ts 的 2026-09-29 注释被隐藏，理由是
 * 「search_document 无写入方」——该论断已过时：发布现在发布 PUBLICATION_SUCCEEDED 事件，
 * SearchIndexEventHandler 消费后索引落库，收藏可用（发布→索引→收藏正向路径已由
 * {@link SearchIndexPipelineIntegrationTest} 钉死）。本测试补齐恢复 UI 所依赖的其余
 * 契约：取消收藏、重复操作幂等、刷新状态回读、游客行为、未登录拒绝。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class BookmarkLifecycleIntegrationTest {

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

    private final List<String> userIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();

    private String token;
    private String articleId;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = registerAndLogin("bookmarklife" + System.nanoTime());
        articleId = publishArticle(token, "收藏生命周期验证文章");
        drainReliableEvents();
        assertTrue(isIndexed(articleId), "前置条件：发布后文章已入索引");
    }

    @AfterAll
    void tearDown() {
        for (String aid : articleIds) {
            jdbcTemplate.update("DELETE ce FROM collection_entry ce WHERE ce.object_id = ? AND ce.object_type = 'ARTICLE'", aid);
            jdbcTemplate.update("DELETE FROM search_document WHERE object_id = ? AND object_type = 'ARTICLE'", aid);
            jdbcTemplate.update("DELETE wd FROM working_draft wd JOIN article a ON a.id = wd.article_id WHERE a.id = ?", aid);
            jdbcTemplate.update("DELETE pr FROM published_revision pr WHERE pr.article_id = ?", aid);
            jdbcTemplate.update("DELETE rd FROM review_decision rd JOIN review_submission rs ON rd.submission_id = rs.id WHERE rs.article_id = ?", aid);
            jdbcTemplate.update("DELETE FROM review_submission WHERE article_id = ?", aid);
            jdbcTemplate.update("DELETE fr FROM formal_revision fr WHERE fr.article_id = ?", aid);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", aid);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM collection WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        articleIds.clear();
    }

    @BeforeEach
    void resetState() {
        // 每个用例从「未收藏」起步，保证顺序无关
        jdbcTemplate.update(
                "DELETE ce FROM collection_entry ce JOIN collection uc ON uc.id = ce.collection_id "
                        + "WHERE uc.owner_id = ? AND ce.object_id = ? AND ce.object_type = 'ARTICLE'",
                userIds.get(0), articleId);
    }

    // ---- 验收矩阵 ----

    @Test
    @Order(1)
    void bookmarkThenStatusReflectsIt() throws Exception {
        mockMvc.perform(post("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/bookmarks/status")
                        .header("satoken", token)
                        .param("objectType", "ARTICLE")
                        .param("objectId", articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookmarked").value(true));
    }

    @Test
    @Order(2)
    void repeatedBookmarkIsIdempotent() throws Exception {
        postBookmark();
        postBookmark();
        Integer rows = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM collection_entry ce
                JOIN collection uc ON uc.id = ce.collection_id
                WHERE uc.owner_id = ? AND ce.object_id = ? AND ce.object_type = 'ARTICLE'
                """, Integer.class, userIds.get(0), articleId);
        assertTrue(rows != null && rows <= 1, "重复收藏不得产生重复条目，rows=" + rows);
    }

    @Test
    @Order(3)
    void unbookmarkThenStatusReflectsIt() throws Exception {
        postBookmark();
        mockMvc.perform(delete("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/bookmarks/status")
                        .header("satoken", token)
                        .param("objectType", "ARTICLE")
                        .param("objectId", articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookmarked").value(false));
    }

    @Test
    @Order(4)
    void repeatedUnbookmarkIsIdempotent() throws Exception {
        postBookmark();
        deleteBookmark();
        deleteBookmark();
        mockMvc.perform(get("/api/v1/bookmarks/status")
                        .header("satoken", token)
                        .param("objectType", "ARTICLE")
                        .param("objectId", articleId))
                .andExpect(jsonPath("$.bookmarked").value(false));
    }

    @Test
    @Order(5)
    void guestStatusIsFalseAndGuestWriteIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/bookmarks/status")
                        .param("objectType", "ARTICLE")
                        .param("objectId", articleId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookmarked").value(false));
        mockMvc.perform(post("/api/v1/me/bookmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(6)
    void unbookmarkableObjectIsNotFound() throws Exception {
        // 未入索引的对象不可收藏（CollectionService.validateObject）
        mockMvc.perform(post("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"no-such-article\"}"))
                .andExpect(status().isNotFound());
    }

    // ---- helpers ----

    private void postBookmark() throws Exception {
        mockMvc.perform(post("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"))
                .andExpect(status().isOk());
    }

    private void deleteBookmark() throws Exception {
        mockMvc.perform(delete("/api/v1/me/bookmarks")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"))
                .andExpect(status().isNoContent());
    }

    private boolean isIndexed(String id) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type = 'ARTICLE' "
                        + "AND object_id = ? AND removed_at IS NULL",
                Integer.class, id);
        return n != null && n > 0;
    }

    /**
     * 同步驱动可靠事件消费者直至队列排空（复用 SearchIndexPipelineIntegrationTest 的做法）。
     */
    private void drainReliableEvents() {
        for (int i = 0; i < 20; i++) {
            Integer pending = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
    }

    private String registerAndLogin(String prefix) throws Exception {
        String email = prefix + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash("Abcd1234!"));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                "bl-space-" + (System.nanoTime() % 100000000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"Abcd1234!\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String publishArticle(String authorToken, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        String aid = objectMapper.readTree(created.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + aid + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"bodyMode\":\"MARKDOWN\","
                                + "\"body\":\"正文\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        MvcResult submitted = mockMvc.perform(post("/api/v1/me/articles/" + aid + "/submit")
                        .header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        String submissionId = objectMapper.readTree(submitted.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("submissionId").asText();
        // 走真实管理端审批发布
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminLogin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"publish\"}"))
                .andExpect(status().isOk());
        articleIds.add(aid);
        return aid;
    }

    private String adminLogin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }
}

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
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

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列阅读进度的可见性矩阵（Phase 3.1，2026-10-19）。
 *
 * <p>核心契约：进度接口对"这一章是否可读"的判断必须与
 * {@code GET /api/v1/articles/{id}} 完全一致。旧实现的 {@code isReadableBy} 只看
 * 生命周期 / 已发布版本 / 治理隐藏，漏掉了 {@code AccessPolicy} 里的：
 * <ul>
 *   <li>PRIVATE 文章仅作者可读；</li>
 *   <li>审核中的文章仅作者可读；</li>
 *   <li>UNLISTED 仍可由直接链接读取（不可公开列出，但不是 PRIVATE）。</li>
 * </ul>
 *
 * <p>因此本测试不是"逐条断言某个状态码"，而是把文章详情当作唯一事实来源：
 * 对每一篇文章、每一种身份，比较
 * <pre>
 *   文章详情是否 200
 *   ⇔ 进度 GET 是否允许把预置记录作为可续读章节返回
 *   ⇔ 进度 POST 是否接受写入
 * </pre>
 * 并检查数据库是否真的产生了副作用。这样任何新权限分支都必须同时出现在两条路径上。
 *
 * <p>游客的进度接口是 401（私人数据），只参与文章详情矩阵；登录用户参与完整矩阵。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SeriesReadingProgressVisibilityIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> seriesIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();

    private String ownerId;
    private String ownerToken;
    private String readerId;
    private String readerToken;
    private String seriesId;

    private String publicArticle;
    private String unlistedArticle;
    private String privateArticle;
    private String hiddenArticle;
    private String underReviewArticle;
    private String draftArticle;
    private String trashedArticle;
    private String articleOutsideSeries;

    /**
     * One row of the matrix. `isChapter` is separate from readability: an article
     * can be publicly readable and still not belong to this series.
     */
    private record MatrixCase(String name, String articleId, boolean isChapter) {
    }

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        List<String> owner = seedUser("vis-owner");
        ownerId = owner.get(0);
        ownerToken = owner.get(1);
        List<String> reader = seedUser("vis-reader");
        readerId = reader.get(0);
        readerToken = reader.get(1);

        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        seriesId = UUID.randomUUID().toString();
        seriesIds.add(seriesId);
        jdbcTemplate.update("""
                INSERT INTO series
                    (id, owner_id, space_id, title, slug, description, status, lock_version,
                     created_at, updated_at)
                VALUES (?, ?, ?, '可见性矩阵系列', ?, '可见性矩阵', 'ACTIVE', 0, NOW(), NOW())
                """, seriesId, ownerId, spaceId, "vis-" + UUID.randomUUID().toString().substring(0, 12));

        publicArticle = seedArticle("公开章节", "PUBLIC", "PUBLISHED", "ACTIVE", "NORMAL", true);
        unlistedArticle = seedArticle("不列出章节", "UNLISTED", "PUBLISHED", "ACTIVE", "NORMAL", true);
        privateArticle = seedArticle("私密章节", "PRIVATE", "PUBLISHED", "ACTIVE", "NORMAL", true);
        hiddenArticle = seedArticle("治理隐藏章节", "PUBLIC", "PUBLISHED", "ACTIVE", "HIDDEN", true);
        underReviewArticle = seedArticle("审核中章节", "PUBLIC", "IN_REVIEW", "ACTIVE", "NORMAL", true);
        draftArticle = seedArticle("未发布章节", "PRIVATE", "DRAFT", "ACTIVE", "NORMAL", false);
        trashedArticle = seedArticle("已删除章节", "PUBLIC", "PUBLISHED", "TRASHED", "NORMAL", true);
        articleOutsideSeries = seedArticle("系列外文章", "PUBLIC", "PUBLISHED", "ACTIVE", "NORMAL", true);

        int position = 1;
        for (String articleId : List.of(
                publicArticle, unlistedArticle, privateArticle, hiddenArticle,
                underReviewArticle, draftArticle, trashedArticle)) {
            insertChapter(articleId, position++);
        }
    }

    @AfterAll
    void tearDown() {
        for (String articleId : articleIds) {
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        }
        for (String id : seriesIds) {
            jdbcTemplate.update("DELETE FROM series_reader_state WHERE series_id = ?", id);
            jdbcTemplate.update("DELETE FROM series_chapter WHERE series_id = ?", id);
            jdbcTemplate.update("DELETE FROM series WHERE id = ?", id);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        seriesIds.clear();
        articleIds.clear();
    }

    @Test
    void guestArticleReadMatchesTheVisibilityPolicy() throws Exception {
        assertArticleStatus(publicArticle, null, 200);
        assertArticleStatus(unlistedArticle, null, 200, "UNLISTED 是直接链接可读，不是 PRIVATE");
        assertArticleStatus(privateArticle, null, 404);
        assertArticleStatus(hiddenArticle, null, 404);
        assertArticleStatus(underReviewArticle, null, 404);
        assertArticleStatus(draftArticle, null, 404);
        assertArticleStatus(trashedArticle, null, 404);
        assertArticleStatus(articleOutsideSeries, null, 200);
    }

    /**
     * The decisive experiment: for every article, the progress read and write must
     * agree with the article detail endpoint for the SAME viewer.
     */
    @Test
    void progressReadAndWriteAgreeWithArticleDetailForEveryViewer() throws Exception {
        List<MatrixCase> cases = matrixCases();
        assertMatrixFor("owner", ownerToken, cases);
        assertMatrixFor("reader", readerToken, cases);
    }

    @Test
    void privateArticleIsNotLeakedByProgressRead() throws Exception {
        // A record can exist from before the article became private. Reading it
        // must not hand the chapter back to a non-owner.
        seedProgress(privateArticle, readerId);
        JsonNode page = progress(readerToken);
        assertEquals(true, page.path("readingHistoryEnabled").asBoolean());
        assertEquals(true, page.path("chapterArticleId").isNull(),
                "PRIVATE 文章不得通过进度接口暴露");
        assertEquals(true, page.path("chapterIndex").isNull());

        // The owner still sees their own position.
        seedProgress(privateArticle, ownerId);
        JsonNode ownerPage = progress(ownerToken);
        assertEquals(privateArticle, ownerPage.path("chapterArticleId").asText());
    }

    @Test
    void rejectedWriteIsIndistinguishableFromAnArticleThatDoesNotExist() throws Exception {
        clearProgress(readerId);

        int privateStatus = postProgress(privateArticle, readerToken);
        int missingStatus = postProgress("does-not-exist-" + UUID.randomUUID(), readerToken);

        assertEquals(404, privateStatus);
        assertEquals(404, missingStatus, "拒绝行为不能泄露私人文章是否存在");
        assertEquals(0, progressRows(readerId));
    }

    // ---- matrix ----

    private void assertMatrixFor(String identity, String token, List<MatrixCase> cases) throws Exception {
        for (MatrixCase testCase : cases) {
            boolean readable = articleStatus(testCase.articleId(), token) == 200;
            boolean resumable = readable && testCase.isChapter();

            // 1) Reading an existing record: the chapter comes back iff it is readable.
            clearProgress(userIdFor(token));
            seedProgress(testCase.articleId(), userIdFor(token));
            JsonNode page = progress(token);
            boolean returned = testCase.articleId().equals(page.path("chapterArticleId").asText(null));
            assertEquals(resumable, returned,
                    identity + " / " + testCase.name() + ": 进度读取与文章可见性不一致");

            // 2) Writing: accepted iff readable AND a chapter of this series.
            clearProgress(userIdFor(token));
            int status = postProgress(testCase.articleId(), token);
            String stored = storedArticle(userIdFor(token));
            if (resumable) {
                assertEquals(204, status, identity + " / " + testCase.name() + ": 应接受写入");
                assertEquals(testCase.articleId(), stored,
                        identity + " / " + testCase.name() + ": 接受的写入必须落库");
            } else {
                assertEquals(404, status, identity + " / " + testCase.name() + ": 应拒绝写入");
                assertEquals(null, stored,
                        identity + " / " + testCase.name() + ": 拒绝的写入不得留下记录");
            }
            clearProgress(userIdFor(token));
        }
    }

    private List<MatrixCase> matrixCases() {
        return List.of(
                new MatrixCase("PUBLIC", publicArticle, true),
                new MatrixCase("UNLISTED", unlistedArticle, true),
                new MatrixCase("PRIVATE", privateArticle, true),
                new MatrixCase("HIDDEN", hiddenArticle, true),
                new MatrixCase("UNDER_REVIEW", underReviewArticle, true),
                new MatrixCase("NO_PUBLISHED_REVISION", draftArticle, true),
                new MatrixCase("TRASHED", trashedArticle, true),
                new MatrixCase("PUBLIC_BUT_NOT_A_CHAPTER", articleOutsideSeries, false));
    }

    // ---- helpers ----

    private void assertArticleStatus(String articleId, String token, int expected) throws Exception {
        assertArticleStatus(articleId, token, expected, null);
    }

    private void assertArticleStatus(String articleId, String token, int expected, String message)
            throws Exception {
        int actual = articleStatus(articleId, token);
        assertEquals(expected, actual, message == null ? articleId : message + " (" + articleId + ")");
    }

    private int articleStatus(String articleId, String token) throws Exception {
        var request = get("/api/v1/articles/" + articleId);
        if (token != null) request.header("satoken", token);
        return mockMvc.perform(request).andReturn().getResponse().getStatus();
    }

    private int postProgress(String articleId, String token) throws Exception {
        return mockMvc.perform(post("/api/v1/me/reading-progress")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"seriesId\":\"" + seriesId + "\",\"articleId\":\"" + articleId + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    private JsonNode progress(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/me/series/" + seriesId + "/reading-progress")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String userIdFor(String token) {
        return token.equals(ownerToken) ? ownerId : readerId;
    }

    private void seedProgress(String articleId, String userId) {
        clearProgress(userId);
        jdbcTemplate.update("""
                INSERT INTO series_reader_state
                    (id, series_id, user_id, last_read_article_id, last_read_at, following,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), 0, NOW(), NOW())
                """, UUID.randomUUID().toString(), seriesId, userId, articleId);
    }

    private void clearProgress(String userId) {
        jdbcTemplate.update(
                "DELETE FROM series_reader_state WHERE series_id = ? AND user_id = ?", seriesId, userId);
    }

    private String storedArticle(String userId) {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT last_read_article_id FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                String.class, seriesId, userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int progressRows(String userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                Integer.class, seriesId, userId);
        return count == null ? 0 : count;
    }

    /** 返回 [userId, token]。 */
    private List<String> seedUser(String prefix) throws Exception {
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
                    (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + (System.nanoTime() % 1_000_000_000L));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'visibility-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + "-space-" + (System.nanoTime() % 100_000_000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return List.of(userId, login.getResponse().getHeader("satoken"));
    }

    private String seedArticle(String title, String visibility, String status, String lifecycle,
                               String moderation, boolean published) {
        String articleId = UUID.randomUUID().toString();
        articleIds.add(articleId);
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        jdbcTemplate.update("""
                INSERT INTO article
                    (id, space_id, owner_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                """, articleId, spaceId, ownerId, status, lifecycle, moderation);

        String formalRevisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, summary, body_mode, body, slug, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, ?, NULL, 'MARKDOWN', '正文', NULL, ?, 0, NOW(), NOW())
                """, formalRevisionId, articleId, title, visibility);

        if (published) {
            jdbcTemplate.update("""
                    INSERT INTO published_revision
                        (id, article_id, formal_revision_id, published_at, publication_event_id)
                    VALUES (?, ?, ?, NOW(), ?)
                    """, UUID.randomUUID().toString(), articleId, formalRevisionId,
                    "vis-pub-" + UUID.randomUUID());
        }
        return articleId;
    }

    private void insertChapter(String articleId, int position) {
        jdbcTemplate.update("""
                INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
                VALUES (?, ?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), seriesId, articleId, position);
    }
}

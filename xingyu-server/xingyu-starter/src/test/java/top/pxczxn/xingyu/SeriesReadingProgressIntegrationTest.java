package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterAll;import org.junit.jupiter.api.BeforeAll;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列阅读进度（Phase 3C，2026-10-19）。
 *
 * <p>本轮新增/收紧的契约：
 * <ol>
 *   <li>新增 {@code GET /me/series/{id}/reading-progress}，只读当前会话用户自己的
 *       单系列进度；不要求把整份阅读历史拉到前端再筛。</li>
 *   <li>写入必须属于该系列且文章可读。旧实现只校验"系列存在"，任意 articleId
 *       都能写成有效进度。</li>
 *   <li>阅读历史关闭时读取不返回进度、写入不落库。</li>
 *   <li>记录章节被移出系列后，读取返回"无可继续章节"而不是伪造序号。</li>
 *   <li>并发/重复写入使用唯一键 upsert，不会产生第二行。</li>
 * </ol>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SeriesReadingProgressIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";
    private static final int CHAPTER_COUNT = 4;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> seriesIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();

    private String readerId;
    private String readerToken;
    private String ownerId;
    private String seriesId;

    private String publishedFirst;
    private String publishedSecond;
    private String publishedThird;
    private String draftChapter;
    private String publishedOutsideSeries;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        List<String> reader = seedUser("prog-reader");
        readerId = reader.get(0);
        readerToken = reader.get(1);
        ownerId = seedUser("prog-owner").get(0);

        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        seriesId = UUID.randomUUID().toString();
        seriesIds.add(seriesId);
        jdbcTemplate.update("""
                INSERT INTO series
                    (id, owner_id, space_id, title, slug, description, status, lock_version,
                     created_at, updated_at)
                VALUES (?, ?, ?, '进度回归系列', ?, '用于阅读进度闭环', 'ACTIVE', 0, NOW(), NOW())
                """, seriesId, ownerId, spaceId, "prog-" + UUID.randomUUID().toString().substring(0, 12));

        publishedFirst = seedPublishedArticle("第一章");
        publishedSecond = seedPublishedArticle("第二章");
        publishedThird = seedPublishedArticle("第三章");
        draftChapter = seedDraftArticle();
        publishedOutsideSeries = seedPublishedArticle("不属于该系列的文章");

        insertChapter(publishedFirst, 1);
        insertChapter(publishedSecond, 2);
        insertChapter(publishedThird, 3);
        insertChapter(draftChapter, 4);
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

    // ---- 身份与隐私 ----

    @Test
    @Order(1)
    void guestCannotReadPrivateProgress() throws Exception {
        mockMvc.perform(get("/api/v1/me/series/" + seriesId + "/reading-progress"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(2)
    void readerWithNoRecordGetsAnEmptyButExplicitProgress() throws Exception {
        mockMvc.perform(progressRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readingHistoryEnabled").value(true))
                .andExpect(jsonPath("$.chapterCount").value(CHAPTER_COUNT))
                .andExpect(jsonPath("$.chapterArticleId").doesNotExist())
                .andExpect(jsonPath("$.chapterIndex").doesNotExist())
                .andExpect(jsonPath("$.lastReadAt").doesNotExist());
    }

    @Test
    @Order(3)
    void recordingAChapterIsVisibleOnTheNextRead() throws Exception {
        record(publishedSecond).andExpect(status().isNoContent());

        mockMvc.perform(progressRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapterArticleId").value(publishedSecond))
                .andExpect(jsonPath("$.chapterIndex").value(2))
                .andExpect(jsonPath("$.chapterCount").value(CHAPTER_COUNT))
                .andExpect(jsonPath("$.lastReadAt").exists());
    }

    @Test
    @Order(4)
    void anotherUserNeverSeesThisReadersProgress() throws Exception {
        String ownerToken = login(ownerId);
        mockMvc.perform(get("/api/v1/me/series/" + seriesId + "/reading-progress")
                        .header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapterArticleId").doesNotExist())
                .andExpect(jsonPath("$.chapterIndex").doesNotExist());
    }

    // ---- 写入归属与可见性 ----

    @Test
    @Order(5)
    void articleOutsideTheSeriesCannotBeRecorded() throws Exception {
        record(publishedOutsideSeries).andExpect(status().isNotFound());
        assertEquals(publishedSecond, currentRecordedArticle(), "失败的写入不得覆盖已有进度");
    }

    @Test
    @Order(6)
    void unreadableChapterCannotBeRecorded() throws Exception {
        // 第四章在系列里，但它是草稿、没有已发布版本。
        record(draftChapter).andExpect(status().isNotFound());
        assertEquals(publishedSecond, currentRecordedArticle());
    }

    // ---- 失效与隐私开关 ----

    @Test
    @Order(7)
    void chapterRemovedFromTheSeriesIsNotResumed() throws Exception {
        jdbcTemplate.update(
                "DELETE FROM series_chapter WHERE series_id = ? AND article_id = ?", seriesId, publishedSecond);

        mockMvc.perform(progressRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapterCount").value(CHAPTER_COUNT - 1))
                .andExpect(jsonPath("$.chapterArticleId").doesNotExist())
                .andExpect(jsonPath("$.chapterIndex").doesNotExist())
                .andExpect(jsonPath("$.lastReadAt").exists());

        insertChapter(publishedSecond, 2);
    }

    @Test
    @Order(8)
    void disabledReadingHistoryIsNeitherReadNorWritten() throws Exception {
        setReadingHistoryEnabled(false);
        int before = recordedRows();

        mockMvc.perform(progressRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readingHistoryEnabled").value(false))
                .andExpect(jsonPath("$.chapterArticleId").doesNotExist())
                .andExpect(jsonPath("$.chapterIndex").doesNotExist())
                .andExpect(jsonPath("$.chapterCount").value(CHAPTER_COUNT));

        // 请求本身仍合法（章节存在且可读），但开关关闭时不得落库。
        record(publishedThird).andExpect(status().isNoContent());
        assertEquals(before, recordedRows(), "阅读历史关闭时不得写入新记录");

        setReadingHistoryEnabled(true);
        assertEquals(publishedSecond, currentRecordedArticle(),
                "关闭期间既不能写入，也不应抹掉未关闭前的记录");
    }

    @Test
    @Order(9)
    void archivedSeriesHasNoPrivateProgress() throws Exception {
        jdbcTemplate.update("UPDATE series SET status = 'ARCHIVED' WHERE id = ?", seriesId);
        mockMvc.perform(progressRequest()).andExpect(status().isNotFound());
        record(publishedFirst).andExpect(status().isNotFound());
        jdbcTemplate.update("UPDATE series SET status = 'ACTIVE' WHERE id = ?", seriesId);
    }

    @Test
    @Order(10)
    void repeatedWritesKeepOneRowAndTheLatestChapter() throws Exception {
        record(publishedFirst).andExpect(status().isNoContent());
        record(publishedThird).andExpect(status().isNoContent());

        assertEquals(1, recordedRows(), "唯一键 upsert 不得产生第二行");
        assertEquals(publishedThird, currentRecordedArticle());
        mockMvc.perform(progressRequest())
                .andExpect(jsonPath("$.chapterIndex").value(3));
    }

    @Test
    @Order(11)
    void progressWriteKeepsTheLegacyFollowingFlag() throws Exception {
        // `following` is an old field in the same row; reading position and the
        // follow flag are different facts, so an upsert must not reset it.
        jdbcTemplate.update(
                "UPDATE series_reader_state SET following = 1 WHERE series_id = ? AND user_id = ?",
                seriesId, readerId);

        record(publishedFirst).andExpect(status().isNoContent());

        Integer following = jdbcTemplate.queryForObject(
                "SELECT following FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                Integer.class, seriesId, readerId);
        assertEquals(1, following);
    }

    @Test
    @Order(12)
    void reorderingChaptersRecomputesTheIndexFromTheArticleId() throws Exception {
        record(publishedSecond).andExpect(status().isNoContent());

        // Move 第二章 from position 2 to 1 (and 第一章 to 2). The record stores the
        // article id, so the index must follow the new editorial order.
        moveChapter(publishedFirst, 99);
        moveChapter(publishedSecond, 1);
        moveChapter(publishedFirst, 2);

        mockMvc.perform(progressRequest())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chapterArticleId").value(publishedSecond))
                .andExpect(jsonPath("$.chapterIndex").value(1));

        // Restore the original order for the remaining assertions/cleanup.
        moveChapter(publishedFirst, 99);
        moveChapter(publishedSecond, 2);
        moveChapter(publishedFirst, 1);
    }

    // ---- helpers ----

    private MockHttpServletRequestBuilder progressRequest() {
        return get("/api/v1/me/series/" + seriesId + "/reading-progress").header("satoken", readerToken);
    }

    private ResultActions record(String articleId) throws Exception {
        return mockMvc.perform(post("/api/v1/me/reading-progress")
                .header("satoken", readerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"seriesId\":\"" + seriesId + "\",\"articleId\":\"" + articleId + "\"}"));
    }

    private String currentRecordedArticle() {
        List<String> rows = jdbcTemplate.queryForList(
                "SELECT last_read_article_id FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                String.class, seriesId, readerId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int recordedRows() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                Integer.class, seriesId, readerId);
        return count == null ? 0 : count;
    }

    private void setReadingHistoryEnabled(boolean enabled) {
        jdbcTemplate.update(
                "UPDATE community_profile SET settings_json = ? WHERE user_id = ?",
                "{\"readingHistoryEnabled\":" + enabled + "}", readerId);
    }

    private String login(String userId) throws Exception {
        String email = jdbcTemplate.queryForObject(
                "SELECT email FROM community_user WHERE id = ?", String.class, userId);
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
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
                VALUES (?, ?, ?, 'progress-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + "-space-" + (System.nanoTime() % 100_000_000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return List.of(userId, login.getResponse().getHeader("satoken"));
    }

    private String seedPublishedArticle(String title) {
        String articleId = seedArticle("PUBLISHED");
        String formalRevisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, summary, body_mode, body, slug, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, ?, NULL, 'MARKDOWN', '正文', NULL, 'PUBLIC', 0, NOW(), NOW())
                """, formalRevisionId, articleId, title);
        jdbcTemplate.update("""
                INSERT INTO published_revision
                    (id, article_id, formal_revision_id, published_at, publication_event_id)
                VALUES (?, ?, ?, NOW(), ?)
                """, UUID.randomUUID().toString(), articleId, formalRevisionId,
                "prog-pub-" + UUID.randomUUID());
        return articleId;
    }

    private String seedDraftArticle() {
        return seedArticle("DRAFT");
    }

    private String seedArticle(String status) {
        String articleId = UUID.randomUUID().toString();
        articleIds.add(articleId);
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        jdbcTemplate.update("""
                INSERT INTO article
                    (id, space_id, owner_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', 'NORMAL', NOW(), NOW())
                """, articleId, spaceId, ownerId, status);
        return articleId;
    }

    private void insertChapter(String articleId, int position) {
        jdbcTemplate.update("""
                INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
                VALUES (?, ?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), seriesId, articleId, position);
    }

    private void moveChapter(String articleId, int position) {
        jdbcTemplate.update(
                "UPDATE series_chapter SET position = ? WHERE series_id = ? AND article_id = ?",
                position, seriesId, articleId);
    }
}

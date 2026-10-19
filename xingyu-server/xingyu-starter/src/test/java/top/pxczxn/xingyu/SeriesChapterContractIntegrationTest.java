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
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列章节整表替换的契约回归（Phase 5，2026-10-19）。
 *
 * <p>本轮前端新增"移除章节 / 拖拽排序"，它们仍然复用既有契约：
 * {@code PUT /me/series/{id}} + {@code chapterArticleIds} + {@code lockVersion}。
 * 因此这里验证的是<b>替换语义本身</b>，不新增章节 API：
 *
 * <ul>
 *   <li>顺序以提交数组为准，空数组只清空关联、不删除文章；</li>
 *   <li>非数组、重复 ID、他人文章、缺失 lockVersion 都必须在写库前 400；</li>
 *   <li>校验失败不得留下"章节已清空但版本没动"的中间状态；</li>
 *   <li>同一版本并发替换章节时恰好一胜一 409；</li>
 *   <li>移除读者正在阅读的章节后，进度接口回到"无可续读章节"而不是猜测序号；</li>
 *   <li>原始文章与阅读记录仍然存在。</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SeriesChapterContractIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;
    @SpyBean
    private SeriesChapterMapper chapterMapper;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> seriesIds = new ArrayList<>();

    private Fixture author;
    private Fixture outsider;
    private String seriesId;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        userIds.clear();
        seriesIds.clear();
        author = fixture("sca");
        outsider = fixture("scb");
        seriesId = createSeries(author.token(), "sc-series-" + (System.nanoTime() % 100000000L));
    }

    @AfterEach
    void tearDown() {
        for (String series : seriesIds) {
            jdbcTemplate.update("DELETE FROM series_reader_state WHERE series_id = ?", series);
            jdbcTemplate.update("DELETE FROM series_subscription WHERE series_id = ?", series);
            jdbcTemplate.update("DELETE FROM series_chapter WHERE series_id = ?", series);
            jdbcTemplate.update("DELETE FROM series WHERE id = ?", series);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("""
                    DELETE wd FROM working_draft wd
                    JOIN article a ON a.id = wd.article_id WHERE a.owner_id = ?
                    """, userId);
            jdbcTemplate.update(
                    "DELETE FROM published_revision WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)",
                    userId);
            jdbcTemplate.update(
                    "DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?))",
                    userId);
            jdbcTemplate.update(
                    "DELETE FROM review_submission WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)",
                    userId);
            jdbcTemplate.update(
                    "DELETE FROM formal_revision WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)",
                    userId);
            jdbcTemplate.update(
                    "DELETE FROM article_topic WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)",
                    userId);
            jdbcTemplate.update("DELETE FROM article WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        seriesIds.clear();
    }

    // ---- replacement semantics ----

    @Test
    void anotherOwnerCannotReplaceChapters() throws Exception {
        String article = createArticle(author.token(), "保留章");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(article), 0L).getResponse().getStatus());
        assertEquals(404, putChapters(outsider.token(), seriesId, List.of(), 1L).getResponse().getStatus());
        assertChapterOrder(seriesId, article);
        assertEquals(1L, lockVersionInDb());
    }

    @Test
    void failureAfterDeletingOldRelationsRollsBackTheEntireUpdate() throws Exception {
        String first = createArticle(author.token(), "原章节");
        String second = createArticle(author.token(), "新增章");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(first), 0L).getResponse().getStatus());
        doThrow(new IllegalStateException("simulated insert failure"))
                .when(chapterMapper).insert(argThat((SeriesChapter chapter) -> second.equals(chapter.getArticleId())));
        MvcResult failed = putRawBody(author.token(), seriesId,
                Map.of("title", "不得保存的标题", "chapterArticleIds", List.of(first, second), "lockVersion", 1L));
        assertEquals(500, failed.getResponse().getStatus());
        assertChapterOrder(seriesId, first);
        assertEquals(1L, lockVersionInDb());
        assertEquals("章节契约系列", jdbcTemplate.queryForObject("SELECT title FROM series WHERE id = ?", String.class, seriesId));
        assertEquals(2L, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM article WHERE id IN (?, ?)", Long.class, first, second));
    }

    @Test
    void malformedVersionAndListEntriesCannotClearChapters() throws Exception {
        String article = createArticle(author.token(), "保留章");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(article), 0L).getResponse().getStatus());
        for (Object token : List.of(1.5, -1, "1", true, 18446744073709551617.0)) {
            assertEquals(400, putRawBody(author.token(), seriesId,
                    Map.of("chapterArticleIds", List.of(), "lockVersion", token)).getResponse().getStatus());
        }
        for (Object entry : java.util.Arrays.asList(null, "", " ", 42, Map.of("id", article))) {
            assertEquals(400, putChapters(author.token(), seriesId, java.util.Arrays.asList(entry), 1L).getResponse().getStatus());
        }
        assertChapterOrder(seriesId, article);
        assertEquals(1L, lockVersionInDb());
    }

    @Test
    void draftsAndArticlesUnderReviewCanBeArrangedWithoutPublishingThem() throws Exception {
        String draft = createArticle(author.token(), "预编排草稿");
        String review = createArticle(author.token(), "预编排审核稿");
        jdbcTemplate.update("UPDATE article SET status = 'IN_REVIEW' WHERE id = ?", review);
        assertEquals(200, putChapters(author.token(), seriesId, List.of(draft, review), 0L).getResponse().getStatus());
        assertChapterOrder(seriesId, draft, review);
        assertEquals("DRAFT", jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, draft));
        assertEquals("IN_REVIEW", jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, review));
        for (String article : List.of(draft, review)) {
            mockMvc.perform(get("/api/v1/articles/" + article)).andExpect(status().isNotFound());
        }
    }

    @Test
    void replacementPersistsOrderAndEmptyListOnlyClearsRelations() throws Exception {
        String first = createArticle(author.token(), "第一章");
        String second = createArticle(author.token(), "第二章");

        MvcResult replaced = putChapters(author.token(), seriesId, List.of(second, first), 0L);
        assertEquals(200, replaced.getResponse().getStatus());
        JsonNode body = json(replaced);
        assertEquals(1L, body.path("lockVersion").asLong());
        assertChapterOrder(seriesId, second, first);

        MvcResult publicView = mockMvc.perform(get("/api/v1/series/" + seriesId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode publicChapters = json(publicView).path("chapters");
        assertEquals(2, publicChapters.size());
        assertEquals(second, publicChapters.get(0).path("articleId").asText());
        assertEquals(first, publicChapters.get(1).path("articleId").asText());

        MvcResult cleared = putChapters(author.token(), seriesId, List.of(), 1L);
        assertEquals(200, cleared.getResponse().getStatus());
        assertEquals(0, json(cleared).path("chapters").size());
        assertEquals(0L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_chapter WHERE series_id = ?", Long.class, seriesId));

        // 清空章节不是删除文章：两篇文章仍在作者的稿件列表里。
        JsonNode mine = json(mockMvc.perform(get("/api/v1/me/articles").header("satoken", author.token()))
                .andExpect(status().isOk())
                .andReturn());
        List<String> ids = new ArrayList<>();
        mine.forEach(node -> ids.add(node.path("id").asText()));
        assertTrue(ids.contains(first) && ids.contains(second), "清空章节不得删除原始文章");
    }

    @Test
    void duplicateIdsAreRejectedBeforeAnyWrite() throws Exception {
        String article = createArticle(author.token(), "唯一章节");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(article), 0L).getResponse().getStatus());

        MvcResult duplicate = putChapters(author.token(), seriesId, List.of(article, article), 1L);
        assertEquals(400, duplicate.getResponse().getStatus(),
                "重复 articleId 必须是 400，而不是数据库唯一键 500");
        assertChapterOrder(seriesId, article);
        assertEquals(1L, lockVersionInDb());
    }

    @Test
    void nonArrayChapterIdsAreRejectedInsteadOfClearingTheSeries() throws Exception {
        String article = createArticle(author.token(), "保留章节");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(article), 0L).getResponse().getStatus());

        for (Object invalid : List.of(Map.of(), "not-an-array", 42, true)) {
            MvcResult result = putRawBody(author.token(), seriesId,
                    Map.of("chapterArticleIds", invalid, "lockVersion", 1L));
            assertEquals(400, result.getResponse().getStatus(), "非法列表必须是 400: " + invalid);
        }
        assertChapterOrder(seriesId, article);
        assertEquals(1L, lockVersionInDb());
    }

    @Test
    void foreignOrUnknownArticleIsRejectedBeforeAnyWrite() throws Exception {
        String mine = createArticle(author.token(), "我的章节");
        String foreign = createArticle(outsider.token(), "别人的章节");

        MvcResult foreignResult = putChapters(author.token(), seriesId, List.of(mine, foreign), 0L);
        assertEquals(400, foreignResult.getResponse().getStatus());
        assertEquals(0L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_chapter WHERE series_id = ?", Long.class, seriesId),
                "他人文章不得留下任何章节");
        assertEquals(0L, lockVersionInDb());

        MvcResult unknownResult = putChapters(author.token(), seriesId, List.of(mine, "missing-article"), 0L);
        assertEquals(400, unknownResult.getResponse().getStatus());
        assertEquals(0L, lockVersionInDb());
    }

    @Test
    void missingLockVersionIsRejected() throws Exception {
        String article = createArticle(author.token(), "版本令牌检查");
        MvcResult result = putRawBody(author.token(), seriesId,
                Map.of("chapterArticleIds", List.of(article)));
        assertEquals(400, result.getResponse().getStatus(),
                "缺 lockVersion 不得回退到当前版本静默成功");
        assertEquals(0L, lockVersionInDb());
    }

    @Test
    void concurrentReplacementsOnSameVersionProduceExactlyOneWinner() throws Exception {
        String first = createArticle(author.token(), "并发甲");
        String second = createArticle(author.token(), "并发乙");

        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<MvcResult>> results = new ArrayList<>();
        for (String articleId : List.of(first, second)) {
            results.add(pool.submit((Callable<MvcResult>) () -> {
                ready.countDown();
                start.await();
                return putChapters(author.token(), seriesId, List.of(articleId), 0L);
            }));
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS));
        start.countDown();

        List<Integer> statuses = new ArrayList<>();
        List<String> winners = new ArrayList<>();
        for (Future<MvcResult> future : results) {
            MvcResult result = future.get(30, TimeUnit.SECONDS);
            statuses.add(result.getResponse().getStatus());
            if (result.getResponse().getStatus() == 200) {
                winners.add(json(result).path("chapters").get(0).path("articleId").asText());
            }
        }
        pool.shutdown();

        assertEquals(1, statuses.stream().filter(s -> s == 200).count(),
                "同一版本只允许一路成功，statuses=" + statuses);
        assertEquals(1, statuses.stream().filter(s -> s == 409).count(),
                "另一路必须 409，statuses=" + statuses);
        assertEquals(1L, lockVersionInDb());
        assertEquals(1, winners.size());
        assertChapterOrder(seriesId, winners.get(0));
    }

    @Test
    void removingTheChapterBeingReadInvalidatesResumeWithoutGuessingAnIndex() throws Exception {
        String first = createArticle(author.token(), "保留章");
        String second = createArticle(author.token(), "被移除章");
        publishFixtureArticle(first, "保留章");
        publishFixtureArticle(second, "被移除章");
        assertEquals(200, putChapters(author.token(), seriesId, List.of(first, second), 0L).getResponse().getStatus());

        Fixture reader = fixture("scr");
        mockMvc.perform(post("/api/v1/me/reading-progress").header("satoken", reader.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("seriesId", seriesId, "articleId", second))))
                .andExpect(status().isNoContent());
        JsonNode before = json(mockMvc.perform(get("/api/v1/me/series/" + seriesId + "/reading-progress")
                .header("satoken", reader.token())).andExpect(status().isOk()).andReturn());
        assertEquals(second, before.path("chapterArticleId").asText());
        assertEquals(2, before.path("chapterIndex").asInt());

        // 第二版：移除读者正在读的章节。
        assertEquals(200, putChapters(author.token(), seriesId, List.of(first), 1L).getResponse().getStatus());

        MvcResult progress = mockMvc.perform(get("/api/v1/me/series/" + seriesId + "/reading-progress")
                        .header("satoken", reader.token()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = json(progress);
        assertEquals(1, body.path("chapterCount").asInt());
        assertTrue(body.path("chapterArticleId").isNull() || body.path("chapterArticleId").isMissingNode(),
                "已移除的章节不能再作为续读位置");
        assertTrue(body.path("chapterIndex").isNull() || body.path("chapterIndex").isMissingNode(),
                "序号不能是猜出来的");

        // 原始文章仍在；阅读记录行也没有被章节替换删除。
        assertEquals(1L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article WHERE id = ?", Long.class, second));
        assertEquals(1L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_reader_state WHERE series_id = ? AND user_id = ?",
                Long.class, seriesId, reader.userId()));
        JsonNode catalog = json(mockMvc.perform(get("/api/v1/series/" + seriesId))
                .andExpect(status().isOk()).andReturn()).path("chapters");
        assertEquals(1, catalog.size());
        assertEquals(first, catalog.get(0).path("articleId").asText());
        JsonNode article = json(mockMvc.perform(get("/api/v1/articles/" + second))
                .andExpect(status().isOk()).andReturn());
        assertEquals(second, article.path("id").asText());
        assertEquals(0, article.path("seriesContexts").size());
    }

    // ---- helpers ----

    private void publishFixtureArticle(String articleId, String title) {
        String revisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("UPDATE article SET status = 'PUBLISHED' WHERE id = ?", articleId);
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, body_mode, body, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, ?, 'MARKDOWN', 'fixture body', 'PUBLIC', 0, NOW(), NOW())
                """, revisionId, articleId, title);
        jdbcTemplate.update("""
                INSERT INTO published_revision (id, article_id, formal_revision_id, published_at, publication_event_id)
                VALUES (?, ?, ?, NOW(), ?)
                """, UUID.randomUUID().toString(), articleId, revisionId, "phase5-" + UUID.randomUUID());
    }

    private record Fixture(String userId, String token) {
    }

    private void assertChapterOrder(String series, String... expectedArticleIds) {
        List<String> actual = jdbcTemplate.queryForList(
                "SELECT article_id FROM series_chapter WHERE series_id = ? ORDER BY position ASC",
                String.class, series);
        assertEquals(List.of(expectedArticleIds), actual);
    }

    private long lockVersionInDb() {
        Long value = jdbcTemplate.queryForObject(
                "SELECT lock_version FROM series WHERE id = ?", Long.class, seriesId);
        return value == null ? -1 : value;
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private MvcResult putChapters(String token, String series, Object ids, long lockVersion) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("chapterArticleIds", ids);
        body.put("lockVersion", lockVersion);
        return putRawBody(token, series, body);
    }

    private MvcResult putRawBody(String token, String series, Map<String, Object> body) throws Exception {
        return mockMvc.perform(put("/api/v1/me/series/" + series)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andReturn();
    }

    private String createSeries(String token, String slug) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"章节契约系列\",\"slug\":\"" + slug + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String id = json(created).path("id").asText();
        assertTrue(!id.isBlank());
        seriesIds.add(id);
        return id;
    }

    private String createArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = json(created).path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"bodyMode\":\"MARKDOWN\","
                                + "\"body\":\"body\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        return articleId;
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

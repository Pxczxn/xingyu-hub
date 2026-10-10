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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Studio Draft Persistence Recovery 回归（2026-10-09）。
 *
 * <p>覆盖 D3（字段清空语义 + 响应与 DB 一致）与 D0（乐观锁原子性）：
 * 清空字段真实落库、响应=DB、未提交字段不受影响、过期版本 409 且不覆盖正文、
 * 同版本并发保存恰好一个成功、非作者写入 404、版本恢复受版本保护。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StudioDraftPersistenceRecoveryIntegrationTest {

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

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        userIds.clear();
    }

    @AfterEach
    void tearDown() {
        for (String userId : userIds) {
            jdbcTemplate.update("""
                    DELETE wd FROM working_draft wd
                    JOIN article a ON a.id = wd.article_id WHERE a.owner_id = ?
                    """, userId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM review_submission WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM article_topic WHERE article_id IN (SELECT id FROM article WHERE owner_id = ?)", userId);
            jdbcTemplate.update("DELETE FROM article WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
    }

    /** D3：显式清空 summary/coverUrl/slug → DB 真实清空；响应、GET、DB 三方一致。 */
    @Test
    void clearingFieldsReallyPersistsNullsAndResponseMatchesDb() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"T","summary":"S","coverUrl":"http://x/c.png","slug":"s-1",
                 "bodyMode":"MARKDOWN","body":"B"}
                """);

        JsonNode second = saveDraft(f, """
                {"title":"T","summary":"","coverUrl":"","slug":"",
                 "bodyMode":"MARKDOWN","body":"B"}
                """);

        // DB 真实清空
        assertEquals(null, querySummary(f.articleId()), "summary 必须真实清空（D3 修复前实测残留 'S'）");
        assertEquals(null, queryCover(f.articleId()));
        assertEquals(null, querySlug(f.articleId()));
        // 响应与 DB 一致（旧实现返回内存实体：响应 null 而 DB 'S'）
        assertTrue(second.path("summary").isNull() || second.path("summary").asText("").isEmpty(),
                "响应必须反映真实持久化结果");
        assertEquals(second.path("lockVersion").asLong(),
                lockVersion(f.articleId()).longValue());
        // GET（刷新）不得恢复旧值
        JsonNode reloaded = getDraft(f);
        assertTrue(reloaded.path("summary").isNull() || reloaded.path("summary").asText("").isEmpty());
        assertTrue(reloaded.path("coverUrl").isNull() || reloaded.path("coverUrl").asText("").isEmpty());
    }

    /** 未提交字段不受影响：只提交 title，summary/body 保持原值。 */
    @Test
    void unsubmittedFieldsAreUntouched() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"v1","summary":"keep","bodyMode":"MARKDOWN","body":"body-1"}
                """);
        saveDraft(f, "{\"title\":\"v2\"}");

        assertEquals("keep", querySummary(f.articleId()), "未提交字段不得被触碰");
        assertEquals("body-1", queryBody(f.articleId()));
        assertEquals("v2", queryTitle(f.articleId()));
    }

    /** PATCH 三态（Final Integrity）：只传 body 时，summary/coverUrl/slug/title 一律不动。 */
    @Test
    void bodyOnlySaveDoesNotTouchAnyOtherField() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"full","summary":"sum","coverUrl":"http://x/c.png","slug":"sl",
                 "bodyMode":"MARKDOWN","body":"old"}
                """);

        JsonNode response = saveDraft(f, "{\"body\":\"new\",\"bodyMode\":\"MARKDOWN\",\"lockVersion\":2}");

        assertEquals("full", queryTitle(f.articleId()));
        assertEquals("sum", querySummary(f.articleId()));
        assertEquals("http://x/c.png", queryCover(f.articleId()));
        assertEquals("sl", querySlug(f.articleId()));
        assertEquals("new", queryBody(f.articleId()));
        assertEquals("sum", response.path("summary").asText(), "响应与 DB 一致");
    }

    /** 过期 lockVersion → 409，且不得覆盖正文。 */
    @Test
    void expiredLockVersionIsRejectedAndDoesNotOverwrite() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"v1","bodyMode":"MARKDOWN","body":"first"}
                """); // lockVersion 0 → 1

        mockMvc.perform(put("/api/v1/me/articles/" + f.articleId() + "/draft")
                        .header("satoken", f.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"v2\",\"bodyMode\":\"MARKDOWN\",\"body\":\"stale\",\"lockVersion\":0}"))
                .andExpect(status().isConflict());

        assertEquals("first", queryBody(f.articleId()), "失败请求不得覆盖正文");
        assertEquals(2L, lockVersion(f.articleId()).longValue(), "失败请求不得产生新版本（fixture 1 + first 1 = 2）");
    }

    /**
     * D0 运行时反证（修复后契约）：两个请求携带相同 lockVersion 并发保存——
     * 恰好一个 200、一个 409；最终正文=胜者；lockVersion 恰好 +1。
     */
    @Test
    void concurrentSavesWithSameLockVersionExactlyOneWins() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"base","bodyMode":"MARKDOWN","body":"base"}
                """); // lockVersion 0 → 1

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        AtomicReference<String> resultA = new AtomicReference<>();
        AtomicReference<String> resultB = new AtomicReference<>();

        Runnable writer = (Runnable) () -> {
            try {
                ready.countDown();
                go.await();
                MvcResult r = mockMvc.perform(put("/api/v1/me/articles/" + f.articleId() + "/draft")
                                .header("satoken", f.token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\" racer\",\"bodyMode\":\"MARKDOWN\",\"body\":\" racer-body\",\"lockVersion\":2}"))
                        .andReturn();
                if (Thread.currentThread().getName().endsWith("1")) {
                    resultA.set(String.valueOf(r.getResponse().getStatus()));
                } else {
                    resultB.set(String.valueOf(r.getResponse().getStatus()));
                }
            } catch (Exception e) {
                if (Thread.currentThread().getName().endsWith("1")) {
                    resultA.set("EX:" + e.getMessage());
                } else {
                    resultB.set("EX:" + e.getMessage());
                }
            }
        };
        Thread t1 = new Thread(writer, "writer-1");
        Thread t2 = new Thread(writer, "writer-2");
        t1.start();
        t2.start();
        ready.await();
        go.countDown();
        t1.join(10_000);
        t2.join(10_000);

        int wins = (resultA.get().equals("200") ? 1 : 0) + (resultB.get().equals("200") ? 1 : 0);
        int conflicts = (resultA.get().equals("409") ? 1 : 0) + (resultB.get().equals("409") ? 1 : 0);
        assertEquals(1, wins, "同版本并发保存必须恰好一个成功: A=" + resultA + " B=" + resultB);
        assertEquals(1, conflicts, "另一个必须 409: A=" + resultA + " B=" + resultB);
        assertEquals("racer-body", queryBody(f.articleId()), "最终正文必须是胜者内容（trim 后）");
        assertEquals(3L, lockVersion(f.articleId()).longValue(), "版本必须恰好 +1（不得原地重写同版本）");
    }

    /** 非作者写入 → 404（不泄露存在性）。 */
    @Test
    void nonOwnerCannotSaveAnotherUsersDraft() throws Exception {
        Fixture owner = fixtureWithDraft();
        Fixture intruder = fixtureWithDraft();

        mockMvc.perform(put("/api/v1/me/articles/" + owner.articleId() + "/draft")
                        .header("satoken", intruder.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"hack\",\"bodyMode\":\"MARKDOWN\",\"body\":\"hack\"}"))
                .andExpect(status().isNotFound());
        assertEquals("body-0", queryBody(owner.articleId()), "越权写入不得生效");
    }

    /**
     * 版本恢复：内容真实还原（含把后来新写的 coverUrl 清回历史值），
     * 且与并发保存互斥（恢复受 lockVersion 条件保护）。
     */
    @Test
    void restoreRevisionOverwritesDraftIncludingStaleCover() throws Exception {
        Fixture f = fixtureWithDraft();
        // v1：无封面 → 提交冻结 revision（coverUrl=null）
        saveDraft(f, """
                {"title":"r1","summary":"s1","bodyMode":"MARKDOWN","body":"rev-1"}
                """);
        mockMvc.perform(post("/api/v1/me/articles/" + f.articleId() + "/submit")
                        .header("satoken", f.token()))
                .andExpect(status().isOk());
        String revisionId = jdbcTemplate.queryForObject(
                "SELECT id FROM formal_revision WHERE article_id = ? ORDER BY revision_number DESC LIMIT 1",
                String.class, f.articleId());
        // 撤回提交回到 DRAFT 才能继续编辑
        String submissionId = jdbcTemplate.queryForObject(
                "SELECT id FROM review_submission WHERE article_id = ?", String.class, f.articleId());
        mockMvc.perform(post("/api/v1/me/submissions/" + submissionId + "/withdraw")
                        .header("satoken", f.token()))
                .andExpect(status().isOk());

        // 草稿新封面 + 新正文（lockVersion 2）
        saveDraft(f, """
                {"title":"r2","summary":"s2","coverUrl":"http://x/new.png","bodyMode":"MARKDOWN","body":"rev-2"}
                """);
        assertEquals("http://x/new.png", queryCover(f.articleId()));

        // 恢复 v1：coverUrl 必须被显式清回 NULL（旧实现 updateById 吞 null 会残留 new.png）
        mockMvc.perform(post("/api/v1/me/articles/" + f.articleId()
                        + "/revisions/" + revisionId + "/restore")
                        .header("satoken", f.token()))
                .andExpect(status().isOk());

        assertEquals("rev-1", queryBody(f.articleId()), "正文必须还原");
        assertNull(queryCover(f.articleId()), "历史版本无封面 → 新草稿封面必须被清空");
        assertEquals("r1", queryTitle(f.articleId()));
    }

    /** 定时时间可通过 saveDraft 显式清空（scheduledPublishAt=null）。 */
    @Test
    void scheduledPublishAtCanBeClearedViaSaveDraft() throws Exception {
        Fixture f = fixtureWithDraft();
        saveDraft(f, """
                {"title":"T","bodyMode":"MARKDOWN","body":"B",
                 "scheduledPublishAt":"2035-01-01T00:00:00Z"}
                """);
        assertNotNull(queryScheduled(f.articleId()));
        saveDraft(f, """
                {"title":"T","bodyMode":"MARKDOWN","body":"B","scheduledPublishAt":null}
                """);
        assertNull(queryScheduled(f.articleId()), "saveDraft 显式 null 必须真实清空计划时间");
    }

    // ---- helpers ----

    private record Fixture(String userId, String token, String articleId) {
    }

    private String querySummary(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT summary FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String queryCover(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT cover_url FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String querySlug(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT slug FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String queryTitle(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT title FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String queryBody(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT body FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String queryScheduled(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT scheduled_publish_at FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private Long lockVersion(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT lock_version FROM working_draft WHERE article_id = ?", Long.class, articleId);
    }

    private JsonNode getDraft(Fixture f) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/me/articles/" + f.articleId())
                        .header("satoken", f.token()))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    private Fixture fixtureWithDraft() throws Exception {
        String email = "sdpr_" + System.nanoTime() + "@example.com";
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
                VALUES (?, ?, ?, 'probe', 'PUBLIC', 'PRIVATE', NOW())
                """, UUID.randomUUID().toString(), userId, "sdpr" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                "sdpr-space-" + (System.nanoTime() % 100000000L));

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = login.getResponse().getHeader("satoken");
        assertNotNull(token);

        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("articleId").asText();
        assertNotNull(articleId);
        saveDraft(new Fixture(userId, token, articleId), """
                {"title":"body-0","bodyMode":"MARKDOWN","body":"body-0"}
                """);
        return new Fixture(userId, token, articleId);
    }

    private JsonNode saveDraft(Fixture f, String json) throws Exception {
        MvcResult result = mockMvc.perform(put("/api/v1/me/articles/" + f.articleId() + "/draft")
                        .header("satoken", f.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
}

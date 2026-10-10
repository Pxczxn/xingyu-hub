package top.pxczxn.xingyu;

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
import top.pxczxn.xingyu.community.task.ScheduledArticlePublishTask;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Studio Scheduling &amp; Concurrency Recovery 回归（2026-10-09）。
 *
 * <p>覆盖 D1/D2 修复的完整闭环：原子认领（同一次计划绝不重复消费）、
 * 送审失败回滚保留计划（重试语义）、取消定时真正写 NULL、
 * 批准发布后扫描不再重复送审、公开状态稳定。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StudioSchedulingRecoveryIntegrationTest {

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
    private ScheduledArticlePublishTask publishTask;
    @Autowired
    private top.pxczxn.xingyu.community.service.ReviewService reviewService;

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
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
    }

    /**
     * 主闭环：到期定时 → 第 1 轮消费（送审 1 次 + 计划清 NULL）→ 第 2 轮不重复 →
     * 批准发布 → 第 3 轮仍不重复、公开读取稳定 200。
     */
    @Test
    void scheduledPublishIsConsumedExactlyOnceAndPublicationStaysStable() throws Exception {
        Fixture f = fixture();
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B","visibility":"PUBLIC",
                 "scheduledPublishAt":"2020-01-01T00:00:00Z"}
                """);

        publishTask.publishDueArticles();
        assertEquals(1, submissionCount(f.articleId()), "第 1 轮必须送审一次");
        assertEquals("IN_REVIEW", articleStatus(f.articleId()));
        assertNull(scheduledAt(f.articleId()), "送审成功后计划时间必须真正清 NULL（D2）");

        publishTask.publishDueArticles();
        assertEquals(1, submissionCount(f.articleId()), "第 2 轮不得重复消费（IN_REVIEW 且计划已清）");

        approveFirstSubmission(f.articleId());
        assertEquals("PUBLISHED", articleStatus(f.articleId()));
        mockMvc.perform(get("/api/v1/articles/" + f.articleId()))
                .andExpect(status().isOk());

        publishTask.publishDueArticles();
        assertEquals(1, submissionCount(f.articleId()),
                "批准发布后不得重复送审（D2 修复前实测 submissions=2）");
        assertEquals("PUBLISHED", articleStatus(f.articleId()));
        mockMvc.perform(get("/api/v1/articles/" + f.articleId()))
                .andExpect(status().isOk());
    }

    /** D1：取消定时必须真正写 NULL，后续扫描不得送审。 */
    @Test
    void cancelScheduleReallyClearsTheColumnAndTaskNeverSubmits() throws Exception {
        Fixture f = fixture();
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B",
                 "scheduledPublishAt":"2035-01-01T00:00:00Z"}
                """);
        assertNotNull(scheduledAt(f.articleId()), "前置：计划时间应已写入");

        mockMvc.perform(post("/api/v1/me/articles/" + f.articleId() + "/cancel-schedule")
                        .header("satoken", f.token()))
                .andExpect(status().isOk());

        assertNull(scheduledAt(f.articleId()), "取消后计划时间必须为 NULL（D1 修复前实测残留）");

        // 取消后任务扫描不得送审（列已 NULL，不再命中扫描）
        publishTask.publishDueArticles();
        assertEquals(0, submissionCount(f.articleId()), "取消后任务不得送审");
        assertEquals("DRAFT", articleStatus(f.articleId()));
    }

    /** 送审失败 → 事务回滚 → 计划恢复 → 修复草稿后下一轮重试成功（重试语义保留）。 */
    @Test
    void failedSubmissionRollsBackTheClaimAndRetriesNextRound() throws Exception {
        Fixture f = fixture();
        // body 缺失 → validateDraftForSubmission 必然失败
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN",
                 "scheduledPublishAt":"2020-01-01T00:00:00Z"}
                """);

        publishTask.publishDueArticles();
        assertEquals(0, submissionCount(f.articleId()), "无效草稿不得产生送审记录");
        assertNotNull(scheduledAt(f.articleId()),
                "送审失败必须回滚认领（计划恢复），等待下一轮重试——不得静默丢弃计划");

        // 修复草稿 → 下一轮重试成功
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B",
                 "scheduledPublishAt":"2020-01-01T00:00:00Z"}
                """);
        publishTask.publishDueArticles();
        assertEquals(1, submissionCount(f.articleId()));
        assertNull(scheduledAt(f.articleId()));
    }

    /** 未来时间不被消费；消费后计划列不会再命中扫描。 */
    @Test
    void futureScheduleIsNotConsumedEarly() throws Exception {
        Fixture f = fixture();
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B",
                 "scheduledPublishAt":"2035-01-01T00:00:00Z"}
                """);
        publishTask.publishDueArticles();
        assertEquals(0, submissionCount(f.articleId()), "未到期计划不得消费");
        assertEquals("DRAFT", articleStatus(f.articleId()));
    }

    /**
     * Final Integrity：两个线程同时认领同一到期计划——claimDueSchedule 是条件 UPDATE
     * （当前读 + 行锁），必须恰好一个成功、只送审一次。
     */
    @Test
    void concurrentClaimsOnTheSameDueScheduleExactlyOneWins() throws Exception {
        Fixture f = fixture();
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B","visibility":"PUBLIC",
                 "scheduledPublishAt":"2020-01-01T00:00:00Z"}
                """);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<Boolean> r1 = new java.util.concurrent.atomic.AtomicReference<>();
        java.util.concurrent.atomic.AtomicReference<Boolean> r2 = new java.util.concurrent.atomic.AtomicReference<>();
        Thread t1 = new Thread(() -> {
            try {
                ready.countDown();
                go.await();
                r1.set(reviewService.submitScheduledDraft(f.articleId()));
            } catch (Exception e) {
                r1.set(false);
            }
        });
        Thread t2 = new Thread(() -> {
            try {
                ready.countDown();
                go.await();
                r2.set(reviewService.submitScheduledDraft(f.articleId()));
            } catch (Exception e) {
                r2.set(false);
            }
        });
        t1.start();
        t2.start();
        ready.await();
        go.countDown();
        t1.join(10_000);
        t2.join(10_000);

        int wins = (Boolean.TRUE.equals(r1.get()) ? 1 : 0) + (Boolean.TRUE.equals(r2.get()) ? 1 : 0);
        assertEquals(1, wins, "并发认领必须恰好一个成功: r1=" + r1 + " r2=" + r2);
        assertEquals(1, submissionCount(f.articleId()), "只送审一次");
        assertNull(scheduledAt(f.articleId()));
    }

    /**
     * Final Integrity：取消与扫描竞争——两条路径都把列写 NULL，最终状态确定：
     * 计划要么被完整消费（送审恰好一次）要么被取消（零送审），绝不出现双重结果。
     */
    @Test
    void cancelRacingWithScanYieldsDeterministicOutcome() throws Exception {
        Fixture f = fixture();
        saveDraft(f, """
                {"title":"T","summary":"S","bodyMode":"MARKDOWN","body":"B","visibility":"PUBLIC",
                 "scheduledPublishAt":"2020-01-01T00:00:00Z"}
                """);

        Thread scanner = new Thread(() -> {
            try {
                publishTask.publishDueArticles();
            } catch (Exception ignored) {
            }
        });
        scanner.start();
        // 与扫描竞争的取消
        try {
            mockMvc.perform(post("/api/v1/me/articles/" + f.articleId() + "/cancel-schedule")
                            .header("satoken", f.token()))
                    .andExpect(status().isOk());
        } catch (Exception ignored) {
        }
        scanner.join(15_000);

        Integer subs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_submission WHERE article_id = ?",
                Integer.class, f.articleId());
        String sched = scheduledAt(f.articleId());
        assertNotNull(subs);
        assertTrue(subs <= 1, "竞争下送审至多一次，实际=" + subs);
        assertNull(sched, "无论谁赢，计划列最终必须为 NULL（两条路径都显式清列）");
        if (subs == 1) {
            assertEquals("IN_REVIEW", articleStatus(f.articleId()), "被消费则必须完整进入审核");
        } else {
            assertEquals("DRAFT", articleStatus(f.articleId()), "被取消则保持草稿");
        }
    }

    // ---- helpers ----

    private record Fixture(String userId, String token, String articleId) {
    }

    private int submissionCount(String articleId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_submission WHERE article_id = ?", Integer.class, articleId);
        return n == null ? 0 : n;
    }

    private String scheduledAt(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT scheduled_publish_at FROM working_draft WHERE article_id = ?",
                String.class, articleId);
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private void approveFirstSubmission(String articleId) throws Exception {
        String submissionId = jdbcTemplate.queryForObject(
                "SELECT id FROM review_submission WHERE article_id = ? ORDER BY submitted_at LIMIT 1",
                String.class, articleId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
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

    private Fixture fixture() throws Exception {
        String email = "sscr_" + System.nanoTime() + "@example.com";
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
                """, UUID.randomUUID().toString(), userId, "sscr" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                "sscr-space-" + (System.nanoTime() % 100000000L));

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
        return new Fixture(userId, token, articleId);
    }

    private void saveDraft(Fixture f, String json) throws Exception {
        mockMvc.perform(put("/api/v1/me/articles/" + f.articleId() + "/draft")
                        .header("satoken", f.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk());
    }
}

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.service.ModerationService;
import top.pxczxn.xingyu.community.service.MomentService;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 作者编辑不能把治理隐藏写回公开；多起隐藏措施要等最后一项解除才按记下的原状态恢复。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MomentEditAndMeasureRestoreIntegrationTest {

    private static final int MAX_DRAIN_ROUNDS = 20;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private DataSource dataSource;
    @Autowired
    private RedisConnectionFactory redisConnectionFactory;
    @Autowired
    private SysConfigGroupService configGroupService;
    @Autowired
    private MomentService momentService;
    @Autowired
    private ModerationService moderationService;
    @Autowired
    private PlatformTransactionManager transactionManager;
    @Autowired
    private ReliableEventConsumer eventConsumer;

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        assertEquals("xingyu_hub_test", jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        try (Connection connection = dataSource.getConnection()) {
            assertEquals("xingyu_hub_test", connection.getCatalog());
            String url = connection.getMetaData().getURL();
            assertTrue(url.contains("/xingyu_hub_test"), url);
            assertFalse(url.contains("/xingyu_hub?"), url);
        }
        assertTrue(redisConnectionFactory instanceof LettuceConnectionFactory);
        assertEquals(7, ((LettuceConnectionFactory) redisConnectionFactory).getDatabase());
    }

    @Test
    @DisplayName("治理隐藏先提交时，作者编辑不能把动态写回公开")
    void hideCommitsBeforeEditDoesNotRepublish() throws Exception {
        String author = registerAndLogin("editHideA");
        String reporter = registerAndLogin("editHideR");
        String momentId = createMoment(author, "隐藏前正文");
        String caseId = openCase(reporter, momentId);
        String authorId = momentColumn(momentId, "author_id");
        String createdAt = momentColumn(momentId, "created_at");

        CountDownLatch hiddenHeld = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread hider = new Thread(() -> {
            try {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    moderationService.decideCase(caseId, "1", Map.of("decision", "UPHELD"));
                    hiddenHeld.countDown();
                    await(release);
                });
            } catch (Throwable error) {
                failure.set(error);
                hiddenHeld.countDown();
            }
        });
        hider.start();
        assertTrue(hiddenHeld.await(20, TimeUnit.SECONDS));
        if (failure.get() != null) {
            throw new AssertionError(failure.get());
        }

        ExecutorService edits = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> edit = edits.submit(() -> patchMoment(author, momentId, "编辑试图公开"));
            Thread.sleep(800);
            release.countDown();
            MvcResult result = edit.get(20, TimeUnit.SECONDS);
            assertEquals(409, result.getResponse().getStatus());
            assertTrue(responseText(result).contains("只能编辑已发布的动态"));
        } finally {
            release.countDown();
            edits.shutdownNow();
            hider.join(20_000);
        }
        if (failure.get() != null) {
            throw new AssertionError(failure.get());
        }

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals("隐藏前正文", latestBody(momentId));
        assertEquals(authorId, momentColumn(momentId, "author_id"));
        assertEquals(createdAt, momentColumn(momentId, "created_at"));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
        drainReliableEvents();
        assertEquals("HIDDEN", momentStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("作者编辑先提交后，治理隐藏仍然能隐藏")
    void editCommitsBeforeHideStillHides() throws Exception {
        String author = registerAndLogin("editFirstA");
        String reporter = registerAndLogin("editFirstR");
        String momentId = createMoment(author, "编辑前正文");
        String caseId = openCase(reporter, momentId);
        CommunityUser user = new CommunityUser();
        user.setId(momentColumn(momentId, "author_id"));
        String createdAt = momentColumn(momentId, "created_at");

        CountDownLatch edited = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicReference<Throwable> editFailure = new AtomicReference<>();
        Thread editor = new Thread(() -> {
            try {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    momentService.update(user, momentId, Map.of("body", "编辑后正文"));
                    deferMomentEvents(momentId);
                    edited.countDown();
                    await(release);
                });
            } catch (Throwable error) {
                editFailure.set(error);
                edited.countDown();
            }
        });
        editor.start();
        assertTrue(edited.await(20, TimeUnit.SECONDS));
        if (editFailure.get() != null) {
            release.countDown();
            editor.join(5_000);
            throw new AssertionError(editFailure.get());
        }

        ExecutorService hides = Executors.newSingleThreadExecutor();
        try {
            Future<MvcResult> hide = hides.submit(() -> decide(caseId, "UPHELD"));
            Thread.sleep(800);
            release.countDown();
            MvcResult result = hide.get(30, TimeUnit.SECONDS);
            assertEquals(200, objectMapper.readTree(result.getResponse().getContentAsString()).path("code").asInt());
        } finally {
            release.countDown();
            hides.shutdownNow();
            editor.join(20_000);
        }
        if (editFailure.get() != null) {
            throw new AssertionError(editFailure.get());
        }

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals("编辑后正文", latestBody(momentId));
        assertEquals(user.getId(), momentColumn(momentId, "author_id"));
        assertEquals(createdAt, momentColumn(momentId, "created_at"));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
        drainReliableEvents();
        assertEquals("HIDDEN", momentStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("编辑失败时正文、状态和索引保持不变")
    void rejectedEditKeepsBodyStatusAndIndex() throws Exception {
        String author = registerAndLogin("editFailA");
        String momentId = createMoment(author, "失败前正文");
        drainReliableEvents();
        assertTrue(indexed(momentId));
        String updatedAt = momentColumn(momentId, "updated_at");
        int revisions = revisionCount(momentId);

        MvcResult result = patchMoment(author, momentId, " ");
        assertEquals(400, result.getResponse().getStatus());
        assertTrue(responseText(result).contains("动态正文不能为空"));

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals("失败前正文", latestBody(momentId));
        assertEquals(revisions, revisionCount(momentId));
        assertEquals(updatedAt, momentColumn(momentId, "updated_at"));
        drainReliableEvents();
        assertEquals("失败前正文", indexTitle(momentId));
        assertTrue(indexed(momentId));
        assertEquals(200, momentDetailStatus(momentId));
    }

    @Test
    @DisplayName("已发布动态仍可按原规则编辑")
    void publishedMomentCanStillBeEdited() throws Exception {
        String author = registerAndLogin("editOkA");
        String momentId = createMoment(author, "原正文");
        String authorId = momentColumn(momentId, "author_id");
        String createdAt = momentColumn(momentId, "created_at");
        drainReliableEvents();

        MvcResult result = patchMoment(author, momentId, "新正文");
        assertEquals(200, result.getResponse().getStatus());
        assertTrue(responseText(result).contains("新正文"));

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals("新正文", latestBody(momentId));
        assertEquals(authorId, momentColumn(momentId, "author_id"));
        assertEquals(createdAt, momentColumn(momentId, "created_at"));
        assertEquals(2, revisionCount(momentId));
        drainReliableEvents();
        assertEquals("新正文", indexTitle(momentId));
        assertTrue(indexed(momentId));
        assertEquals(200, momentDetailStatus(momentId));
    }

    @Test
    @DisplayName("隐藏和回收中的动态不能通过编辑入口修改")
    void hiddenAndTrashedMomentsCannotBeEdited() throws Exception {
        String author = registerAndLogin("editClosedA");
        String reporter = registerAndLogin("editClosedR");
        String hiddenId = createMoment(author, "隐藏正文");
        uphold(reporter, hiddenId);
        assertEquals("HIDDEN", momentStatus(hiddenId));
        MvcResult hiddenEdit = patchMoment(author, hiddenId, "改隐藏");
        assertEquals(409, hiddenEdit.getResponse().getStatus());
        assertTrue(responseText(hiddenEdit).contains("只能编辑已发布的动态"));
        assertEquals("HIDDEN", momentStatus(hiddenId));
        assertEquals("隐藏正文", latestBody(hiddenId));
        assertEquals(404, momentDetailStatus(hiddenId));
        assertFalse(indexed(hiddenId));

        String trashedId = createMoment(author, "回收正文");
        drainReliableEvents();
        mockMvc.perform(post("/api/v1/moments/" + trashedId + "/trash").header("satoken", author))
                .andExpect(status().isOk());
        MvcResult trashedEdit = patchMoment(author, trashedId, "改回收");
        assertEquals(409, trashedEdit.getResponse().getStatus());
        assertEquals("TRASHED", momentStatus(trashedId));
        assertEquals("回收正文", latestBody(trashedId));
        assertEquals(404, momentDetailStatus(trashedId));
        assertFalse(indexed(trashedId));
    }

    @Test
    @DisplayName("第一项申诉批准后，另一项有效隐藏仍使动态保持隐藏")
    void approvingFirstAppealKeepsMomentHidden() throws Exception {
        String author = registerAndLogin("multiA");
        String firstReporter = registerAndLogin("multiR1");
        String secondReporter = registerAndLogin("multiR2");
        String momentId = createMoment(author, "两项隐藏");
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        assertEquals("PUBLISHED", priorStatus(firstCase));
        assertEquals("HIDDEN", priorStatus(secondCase));
        String firstAppeal = submitAppeal(author, firstCase);
        submitAppeal(author, secondCase);

        approve(firstAppeal);

        assertEquals("APPROVED", appealStatus(firstAppeal));
        assertEquals("PENDING", appealStatus(appealIdOf(secondCase)));
        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("最后一项有效隐藏解除后，按记下的原状态恢复")
    void releasingTheLastHideRestoresRecordedStatus() throws Exception {
        String author = registerAndLogin("lastA");
        String firstReporter = registerAndLogin("lastR1");
        String secondReporter = registerAndLogin("lastR2");
        String momentId = createMoment(author, "最终恢复");
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        approve(submitAppeal(author, firstCase));
        assertEquals("HIDDEN", momentStatus(momentId));

        approve(submitAppeal(author, secondCase));

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed(momentId));
        assertEquals("最终恢复", indexTitle(momentId));
    }

    @Test
    @DisplayName("多起申诉逐个批准，只有最后一项解除后才恢复")
    void approvingAppealsOneByOneRestoresOnlyAtTheEnd() throws Exception {
        String author = registerAndLogin("seqA");
        String firstReporter = registerAndLogin("seqR1");
        String secondReporter = registerAndLogin("seqR2");
        String momentId = createMoment(author, "逐项恢复");
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        String secondAppeal = submitAppeal(author, secondCase);
        String firstAppeal = submitAppeal(author, firstCase);

        approve(secondAppeal);
        assertEquals("HIDDEN", momentStatus(momentId));
        assertFalse(indexed(momentId));
        assertEquals("PENDING", appealStatus(firstAppeal));

        approve(firstAppeal);
        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed(momentId));
    }

    @Test
    @DisplayName("驳回一起申诉不影响其他隐藏措施")
    void rejectedAppealLeavesTheOtherMeasure() throws Exception {
        String author = registerAndLogin("rejA");
        String firstReporter = registerAndLogin("rejR1");
        String secondReporter = registerAndLogin("rejR2");
        String momentId = createMoment(author, "驳回其一");
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        String firstAppeal = submitAppeal(author, firstCase);
        String secondAppeal = submitAppeal(author, secondCase);

        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + firstAppeal + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\"}"))
                .andExpect(jsonPath("$.code").value(200));

        assertEquals("REJECTED", appealStatus(firstAppeal));
        assertEquals("PENDING", appealStatus(secondAppeal));
        assertEquals(1, measureCount(firstCase));
        assertEquals(1, measureCount(secondCase));
        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("存在空 prior_status 的历史措施时不猜测恢复")
    void nullPriorDoesNotRestore() throws Exception {
        String author = registerAndLogin("nullA");
        String firstReporter = registerAndLogin("nullR1");
        String secondReporter = registerAndLogin("nullR2");
        String momentId = createMoment(author, "历史空状态");
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        jdbcTemplate.update(
                """
                UPDATE moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                SET m.prior_status = NULL
                WHERE d.case_id = ?
                """,
                firstCase);

        approve(submitAppeal(author, firstCase));
        approve(submitAppeal(author, secondCase));

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("已回收动态不因多起申诉批准而重新公开")
    void trashedMomentStaysTrashed() throws Exception {
        String author = registerAndLogin("trashA");
        String firstReporter = registerAndLogin("trashR1");
        String secondReporter = registerAndLogin("trashR2");
        String momentId = createMoment(author, "回收后申诉");
        mockMvc.perform(post("/api/v1/moments/" + momentId + "/trash").header("satoken", author))
                .andExpect(status().isOk());
        String firstCase = uphold(firstReporter, momentId);
        String secondCase = uphold(secondReporter, momentId);
        assertEquals("TRASHED", priorStatus(firstCase));
        assertEquals("TRASHED", priorStatus(secondCase));

        approve(submitAppeal(author, firstCase));
        approve(submitAppeal(author, secondCase));

        assertEquals("TRASHED", momentStatus(momentId));
        assertEquals(404, momentDetailStatus(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("两个管理员并发批准不同申诉后，状态和索引正确")
    void concurrentApprovalsRestoreOnce() throws Exception {
        String author = registerAndLogin("raceA");
        String firstReporter = registerAndLogin("raceR1");
        String secondReporter = registerAndLogin("raceR2");
        String momentId = createMoment(author, "并发批准");
        String firstAppeal = submitAppeal(author, uphold(firstReporter, momentId));
        String secondAppeal = submitAppeal(author, uphold(secondReporter, momentId));
        String token = adminToken();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService admins = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = admins.submit(() -> decideAppealCode(token, firstAppeal, start));
            Future<Integer> second = admins.submit(() -> decideAppealCode(token, secondAppeal, start));
            start.countDown();
            assertEquals(200, first.get(30, TimeUnit.SECONDS));
            assertEquals(200, second.get(30, TimeUnit.SECONDS));
        } finally {
            admins.shutdownNow();
        }

        assertEquals("APPROVED", appealStatus(firstAppeal));
        assertEquals("APPROVED", appealStatus(secondAppeal));
        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed(momentId));
        assertEquals("并发批准", indexTitle(momentId));
    }

    @Test
    @DisplayName("单案件申诉批准后按原状态恢复")
    void singleCaseAppealStillRestores() throws Exception {
        String author = registerAndLogin("oneA");
        String reporter = registerAndLogin("oneR");
        String momentId = createMoment(author, "单案件");
        String caseId = uphold(reporter, momentId);
        assertEquals("HIDDEN", momentStatus(momentId));
        assertFalse(indexed(momentId));

        approve(submitAppeal(author, caseId));

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertEquals(200, momentDetailStatus(momentId));
        assertTrue(indexed(momentId));
    }

    private static String responseText(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private int decideAppealCode(String token, String appealId, CountDownLatch start) throws Exception {
        start.await(20, TimeUnit.SECONDS);
        MvcResult result = mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("code").asInt();
    }

    private MvcResult patchMoment(String token, String momentId, String body) throws Exception {
        MvcResult result = mockMvc.perform(patch("/api/v1/moments/" + momentId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andReturn();
        deferMomentEvents(momentId);
        return result;
    }

    private MvcResult decide(String caseId, String decision) throws Exception {
        return mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andReturn();
    }

    private String uphold(String reporterToken, String momentId) throws Exception {
        String caseId = openCase(reporterToken, momentId);
        decide(caseId, "UPHELD");
        return caseId;
    }

    private String openCase(String reporterToken, String momentId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", reporterToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","reason":"SPAM"}
                                """.formatted(momentId)))
                .andExpect(status().isOk())
                .andReturn();
        String reportId = objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private void approve(String appealId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(jsonPath("$.code").value(200));
    }

    private String submitAppeal(String token, String caseId) throws Exception {
        String measureId = jdbcTemplate.queryForObject(
                """
                SELECT m.id FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                String.class, caseId);
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"请求恢复"}
                                """.formatted(caseId, measureId)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String momentId = objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
        deferMomentEvents(momentId);
        return momentId;
    }

    private String registerAndLogin(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
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
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(20, TimeUnit.SECONDS)) {
                throw new IllegalStateException("等待超时");
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(ex);
        }
    }

    private void drainReliableEvents() {
        releaseDeferredEvents();
        for (int round = 0; round < MAX_DRAIN_ROUNDS; round++) {
            Integer pending = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM reliable_event
                    WHERE status IN ('PENDING', 'FAILED')
                      AND (next_attempt_at IS NULL OR next_attempt_at <= UTC_TIMESTAMP())
                    """,
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
    }

    /**
     * 把这条动态已经提交的待处理事件推到一天后。
     * 浏览器测试进程连着同一个 xingyu_hub_test，每 5 秒领取事件；
     * 这里让它领不到，索引只由本测试显式的 poll 或同步刷新决定。
     */
    private void deferMomentEvents(String momentId) {
        jdbcTemplate.update(
                """
                UPDATE reliable_event
                SET next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY)
                WHERE aggregate_id = ?
                  AND status IN ('PENDING', 'FAILED')
                """,
                momentId);
    }

    private void releaseDeferredEvents() {
        jdbcTemplate.update(
                """
                UPDATE reliable_event
                SET next_attempt_at = NULL
                WHERE aggregate_type = 'moment'
                  AND status IN ('PENDING', 'FAILED')
                  AND next_attempt_at > UTC_TIMESTAMP()
                """);
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String momentColumn(String momentId, String column) {
        return jdbcTemplate.queryForObject(
                "SELECT CAST(" + column + " AS CHAR) FROM moment WHERE id = ?", String.class, momentId);
    }

    private String latestBody(String momentId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT body FROM moment_revision
                WHERE moment_id = ?
                ORDER BY revision_number DESC
                LIMIT 1
                """,
                String.class, momentId);
    }

    private int revisionCount(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM moment_revision WHERE moment_id = ?", Integer.class, momentId);
        return count == null ? 0 : count;
    }

    private String priorStatus(String caseId) {
        return jdbcTemplate.query(
                """
                SELECT m.prior_status FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                rs -> rs.next() ? rs.getString(1) : null,
                caseId);
    }

    private String appealStatus(String appealId) {
        return jdbcTemplate.queryForObject("SELECT status FROM appeal WHERE id = ?", String.class, appealId);
    }

    private String appealIdOf(String caseId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM appeal WHERE case_id = ?", String.class, caseId);
    }

    private int measureCount(String caseId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                Integer.class, caseId);
        return count == null ? 0 : count;
    }

    private int momentDetailStatus(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
    }

    private boolean indexed(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM search_document
                WHERE object_type = 'MOMENT' AND object_id = ? AND removed_at IS NULL
                """,
                Integer.class, momentId);
        return count != null && count > 0;
    }

    private String indexTitle(String momentId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT title FROM search_document
                WHERE object_type = 'MOMENT' AND object_id = ? AND removed_at IS NULL
                """,
                String.class, momentId);
    }
}

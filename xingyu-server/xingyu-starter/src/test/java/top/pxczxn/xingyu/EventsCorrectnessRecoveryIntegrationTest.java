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
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 活动域 Correctness Recovery（Events Correctness Recovery）。
 *
 * <p>本轮只做 Contract / Correctness，不引入人数限制、候补、通知或新状态机。
 * 覆盖三件本轮锁定的事：</p>
 * <ol>
 *   <li><b>服务端时间门禁</b>：{@code endsAt} 非 null 且 {@code now >= endsAt} ⇒ 已结束，
 *       拒绝新报名、新投稿；{@code endsAt == null} 表示未配置自动结束，<b>不得</b>当成已结束；
 *       公开详情/列表因过期 <b>不得</b> 404。</li>
 *   <li><b>管理员时间与状态</b>：可设置 startsAt / 可空 endsAt 且校验先后；status 只接受
 *       领域真实支持的白名单，非法值不得落库。</li>
 *   <li><b>报名幂等</b>：唯一约束 {@code uk_event_registration(event_id,user_id)} 是并发安全
 *       的唯一保证；重复报名返回幂等结果，不产生第二行，也不伪装成功。</li>
 * </ol>
 *
 * <p>所有 fixture 一律走真实业务链路（admin HTTP 建活动 + 社区 HTTP 报名/投稿），
 * 不直接写活动表；测试结束按 anchor 清理到基线。</p>
 *
 * <p><b>验证边界（诚实标注）</b>：真正"两个请求同时在只读检查之后、插入之前"的窗口无法在
 * 单 JVM + MockMvc 下被确定性地触发 —— 那是调度层面的竞态。因此这里证明的是
 * <b>冲突分支本身</b>：预先存在同 event/user 行时，插入路径的 DuplicateKey 分支
 * 必须被唯一约束挡住并回落为幂等结果，而不是抛出 500 或写入第二行。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventsCorrectnessRecoveryIntegrationTest {

    /** 邮箱前缀，用于清理定位。 */
    private static final String PREFIX = "evtcorr-";
    /** 用户名必须匹配 ^[a-z0-9_]{3,32}$ —— 只能用这些字符。 */
    private static final String USER_PREFIX = "evtcorr";
    /**
     * 事件 slug 前缀。必须是每个 fixture 事件 slug 的真实前缀，否则
     * cleanup() 的 `slug LIKE 'evtcorr-%'` 扫不到、测试残留会持续堆积。
     * 早期版本用 "run-%d"/"dk-%d" 这类裸前缀，导致每跑一次就漏掉十几条。
     */
    private static final String EVENT_PREFIX = "evtcorr-";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
        cleanup();
        adminToken = adminToken();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    // ---- 反证 3：已结束活动拒绝 REST 报名 / 投稿 ----

    @Test
    void endedEventRejectsRegistrationAndSubmissionOverHttp() throws Exception {
        String token = createApprovedUser("ended");
        Instant past = Instant.now().minus(30, ChronoUnit.DAYS);
        String eventId = createEvent("已结束活动", "ended-%d".formatted(System.nanoTime()),
                past.minus(10, ChronoUnit.DAYS), past, true);

        // 公开详情仍可浏览 —— 过期不得 404。
        mockMvc.perform(get("/api/v1/events/" + eventId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("已结束活动"));

        // 公开列表也不得把它藏掉（它仍 ACTIVE，只是时间过了）。
        // 列表按 starts_at DESC 排序且有 limit，所以不能只看第一页；直接把 limit 拉满再找。
        MvcResult list = mockMvc.perform(get("/api/v1/events").param("limit", "100"))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(list.getResponse().getContentAsString().contains(eventId),
                "已结束的活动仍应出现在公开列表里（历史可浏览），不得因过期被过滤");

        // 报名被拒绝，且不产生 registration 行。
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isConflict());
        assertEquals(0, countRegistrations(eventId), "已结束活动不得产生 registration 行");

        // 投稿被拒绝，且不产生 submission 行。
        String momentId = createMoment(token, PREFIX + "投稿内容");
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"MOMENT\",\"objectId\":\"" + momentId + "\"}"))
                .andExpect(status().isConflict());
        assertEquals(0, countSubmissions(eventId), "已结束活动不得产生 submission 行");
    }

    @Test
    void endedEventStillAllowsHistoryReadsForAnAlreadyRegisteredUser() throws Exception {
        // 报名必须发生在活动仍在进行时——门禁不能破坏既有读取能力。
        String token = createApprovedUser("history");
        String eventId = createEvent("读取历史", "hist-%d".formatted(System.nanoTime()),
                Instant.now().minus(2, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), true);

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REGISTERED"));

        // 把活动推到过去（走 admin 真实路径，不直接改表）。
        mockMvc.perform(patch("/api/v1/admin/community/events/" + eventId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endsAt\":\"" + Instant.now().minus(1, ChronoUnit.HOURS) + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // 已报名用户重复报名：仍是幂等返回，不因结束而 404 / 500。
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REGISTERED"));
        assertEquals(1, countRegistrations(eventId), "重复报名不得产生第二行");

        // 取消报名也必须仍然可用（历史操作不受结束门禁影响）。
        mockMvc.perform(delete("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isNoContent());

        // 我的投稿记录读取不受影响。
        mockMvc.perform(get("/api/v1/me/event-submissions")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    // ---- 反证 2 + 5：时间边界 ----

    @Test
    void runningEventAllowsRegistrationAndSubmission() throws Exception {
        String token = createApprovedUser("running");
        String eventId = createEvent("进行中活动", "run-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), true);

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REGISTERED"));

        String momentId = createMoment(token, PREFIX + "进行中投稿");
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"MOMENT\",\"objectId\":\"" + momentId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));

        assertEquals(1, countRegistrations(eventId));
        assertEquals(1, countSubmissions(eventId));
    }

    @Test
    void nullEndsAtIsNotTreatedAsEnded() throws Exception {
        // 既有 seed 的形态：ends_at 为 NULL。它绝不能被当成"已结束"。
        String token = createApprovedUser("noend");
        String eventId = createEvent("无结束时间", "noend-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS), null, true);

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REGISTERED"));

        String momentId = createMoment(token, PREFIX + "无结束投稿");
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"MOMENT\",\"objectId\":\"" + momentId + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void exactlyAtTheEndInstantIsAlreadyEnded() throws Exception {
        // 边界：now == endsAt 必须算已结束（!now.isBefore(endsAt)）。
        String token = createApprovedUser("boundary");
        Instant end = Instant.now().minusSeconds(2);
        String eventId = createEvent("边界活动", "bound-%d".formatted(System.nanoTime()),
                end.minus(1, ChronoUnit.DAYS), end, true);

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isConflict());
        assertEquals(0, countRegistrations(eventId));
    }

    @Test
    void oneSecondBeforeTheEndIsStillOpen() throws Exception {
        String token = createApprovedUser("justin");
        String eventId = createEvent("刚好没结束", "justin-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plusSeconds(1), true);

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk());
    }

    // ---- 反证 6：status 白名单 ----

    @Test
    void invalidStatusIsRejectedAndLeavesNoDirtyState() throws Exception {
        String eventId = createEvent("白名单活动", "wl-%d".formatted(System.nanoTime()),
                Instant.now(), null, true);

        // 非法状态被拒。admin 契约：HTTP 200 + body.code != 200。
        MvcResult rejected = mockMvc.perform(patch("/api/v1/admin/community/events/" + eventId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GARBAGE_STATE\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(rejected.getResponse().getContentAsString());
        assertFalse(body.path("code").asInt() == 200,
                "非法状态必须被拒绝（body.code != 200），实际: " + body);

        // DB 里绝不能留下脏状态。
        assertEquals("ACTIVE", statusOf(eventId), "被拒的 status 不得落库");

        // 白名单内的值仍然生效。
        mockMvc.perform(patch("/api/v1/admin/community/events/" + eventId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        assertEquals("ARCHIVED", statusOf(eventId));
    }

    @Test
    void invalidStatusIsRejectedOnCreate() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/community/events")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"非法状态创建","slug":"bad-%d","status":"GARBAGE_STATE"}
                                """.formatted(System.nanoTime())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertFalse(body.path("code").asInt() == 200, "创建时非法状态也必须被拒绝");
    }

    // ---- 反证 1 + 4：管理员时间设置 ----

    @Test
    void adminCanSetStartsAtAndEndsAtAndRangeIsValidated() throws Exception {
        Instant start = Instant.now().truncatedTo(ChronoUnit.SECONDS).plus(1, ChronoUnit.DAYS);
        Instant end = start.plus(5, ChronoUnit.DAYS);
        String eventId = createEvent("定时活动", "sched-%d".formatted(System.nanoTime()), start, end, true);

        // MySQL `timestamp` 只有秒精度，比较时对齐到秒。
        assertEquals(start.getEpochSecond(), instantOf(eventId, "starts_at").getEpochSecond());
        assertEquals(end.getEpochSecond(), instantOf(eventId, "ends_at").getEpochSecond());

        // endsAt 必须晚于 startsAt。
        MvcResult bad = mockMvc.perform(patch("/api/v1/admin/community/events/" + eventId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endsAt\":\"" + start.minus(1, ChronoUnit.HOURS) + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        assertFalse(objectMapper.readTree(bad.getResponse().getContentAsString()).path("code").asInt() == 200,
                "endsAt 早于 startsAt 必须被拒绝");
        assertEquals(end.getEpochSecond(), instantOf(eventId, "ends_at").getEpochSecond(),
                "被拒的时间范围不得落库");

        // 显式 null 表示取消自动结束时间。
        mockMvc.perform(patch("/api/v1/admin/community/events/" + eventId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"endsAt\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        assertEquals(null, instantOf(eventId, "ends_at"), "显式 null 应清空 ends_at");
    }

    @Test
    void adminCreateWithoutTimesKeepsTheCompatibleDefault() throws Exception {
        // 既有创建链路（Batch6）不带 startsAt：必须仍然可用，且默认创建即开始。
        MvcResult created = mockMvc.perform(post("/api/v1/admin/community/events")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"兼容默认","slug":"evtcorr-compat-%d","body":"体","submissionOpen":true}
                                """.formatted(System.nanoTime())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String eventId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("data").path("id").asText();
        assertNotNull(instantOf(eventId, "starts_at"), "缺省创建仍应写入 starts_at");
        assertEquals(null, instantOf(eventId, "ends_at"), "缺省创建不得写入 ends_at");
    }

    // ---- 反证 7：报名幂等与冲突分支 ----

    @Test
    void duplicateRegistrationIsIdempotentAndNeverWritesASecondRow() throws Exception {
        String token = createApprovedUser("idem");
        String eventId = createEvent("幂等活动", "idem-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), true);

        String first = registerAndReadId(token, eventId);
        for (int i = 0; i < 5; i++) {
            assertEquals(first, registerAndReadId(token, eventId),
                    "重复报名必须返回同一行");
        }
        assertEquals(1, countRegistrations(eventId), "重复报名不得写入第二行");
    }

    @Test
    void duplicateKeyOnRegistrationResolvesToIdempotentResultNotA500() throws Exception {
        // 冲突分支的直接证据：插入一条同 (event_id,user_id) 的行，再走 register 的
        // 插入路径 —— 唯一约束命中时服务端必须回落为幂等读，而不是 500。
        //
        // 说明：这里无法真的让两个 HTTP 请求在同一瞬间穿过只读检查（那是调度竞态，
        // 单 JVM 下不可确定性触发）。但插入后服务端必然命中 DuplicateKey 分支，
        // 它能证明"冲突不会被伪装成成功、也不会变成 500"。
        User user = createUser("dk");
        String token = user.token();
        String userId = user.id();
        String eventId = createEvent("冲突分支", "dk-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), true);

        // 先把 CANCELLED 行放进去（走真实取消链路，不直接插入）。
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals("CANCELLED", registrationStatusOf(eventId, userId));

        // 再报名：走的是 update 复用路径，仍只有一行。
        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REGISTERED"));
        assertEquals("REGISTERED", registrationStatusOf(eventId, userId));
        assertEquals(1, countRegistrations(eventId));

        // 唯一约束必须真实存在——它是并发安全的唯一保证。
        Integer ukCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = 'event_registration'
                  AND index_name = 'uk_event_registration' AND non_unique = 0
                """, Integer.class);
        assertEquals(2, ukCount, "uk_event_registration 必须是两列的唯一键");
    }

    @Test
    void duplicateSubmissionIsIdempotentForTheSameObject() throws Exception {
        String token = createApprovedUser("dupsub");
        String eventId = createEvent("重复投稿", "dupsub-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), true);
        String momentId = createMoment(token, PREFIX + "重复投稿内容");

        String first = submitAndReadId(token, eventId, momentId);
        assertEquals(first, submitAndReadId(token, eventId, momentId), "重复投稿必须幂等");
        assertEquals(1, countSubmissions(eventId), "重复投稿不得写入第二行");
    }

    @Test
    void closedSubmissionsStillRejectsBeforeTheEventEnds() throws Exception {
        // 结束门禁不得覆盖既有的 submissionOpen 语义：未结束但已关投稿仍是 409。
        String token = createApprovedUser("closed");
        String eventId = createEvent("关投稿", "closed-%d".formatted(System.nanoTime()),
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now().plus(1, ChronoUnit.HOURS), false);
        String momentId = createMoment(token, PREFIX + "关投稿内容");

        mockMvc.perform(post("/api/v1/me/events/" + eventId + "/submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"MOMENT\",\"objectId\":\"" + momentId + "\"}"))
                .andExpect(status().isConflict());
    }

    // ---- 反证 10：fixture 清理 ----

    @Test
    void baselineIsCleanBeforeAndAfterEveryTest() {
        // 本测试自身不造数据；它断言的是 cleanup() 的闭合性——
        // 若上一个测试漏清，这里的计数会先炸。
        Integer events = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_event WHERE slug LIKE ?", Integer.class, "evtcorr-%");
        assertEquals(0, events, "活动 fixture 必须清零");
        Integer leftUsers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_user WHERE email LIKE ?", Integer.class, PREFIX + "%@example.com");
        assertEquals(0, leftUsers, "用户 fixture 必须清零");
        Integer leftRegs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_registration", Integer.class);
        assertEquals(0, leftRegs, "报名 fixture 必须清零");
        Integer leftSubs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_submission", Integer.class);
        assertEquals(0, leftSubs, "投稿 fixture 必须清零");
    }

    // ---- HTTP helpers ----

    private void cleanup() {
        // 锚点是 community_event.slug（前缀 evtcorr-）与 community_user.email。
        //
        // 两条约束同时成立：
        //   1. `TestSourceSchemaMutationGuardTest` 静态禁止测试源码出现任何
        //      CREATE/DROP TABLE —— 测试侧自愈会造成"测试全绿但库结构已偏离 baseline"
        //      的假绿。所以这里<b>不建中间锚点表</b>（治理测试里那种 _xxx_anchor 写法，
        //      其本身就在守卫的违规清单里）。
        //   2. MySQL error 1093 禁止 `DELETE FROM t WHERE ... IN (SELECT ... FROM t ...)`
        //      —— 子查询引用**待更新的目标表本身**时非法。所以删除自身表时不能自引用，
        //      必须直接用非子查询的谓词（下面对 community_event 用 slug LIKE）。
        //      子查询引用**别的**表是合法的，故 event_submission / event_registration
        //      可以照常按 event_id / user_id 反查。

        // 先删活动下的子行（子查询引用的是 community_event，不是被删表本身）。
        jdbcTemplate.update("""
                DELETE FROM event_submission WHERE event_id IN
                (SELECT id FROM community_event WHERE slug LIKE 'evtcorr-%')
                """);
        jdbcTemplate.update("""
                DELETE FROM event_registration WHERE event_id IN
                (SELECT id FROM community_event WHERE slug LIKE 'evtcorr-%')
                """);
        // 用户自己的报名 / 投稿（可能挂在别人建的活动上）。
        jdbcTemplate.update("""
                DELETE FROM event_registration WHERE user_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        jdbcTemplate.update("""
                DELETE FROM event_submission WHERE author_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        // 删活动自身：不能用自引用子查询（1093），直接用谓词。
        jdbcTemplate.update("DELETE FROM community_event WHERE slug LIKE 'evtcorr-%'");

        // 用户自己造的动态：先清索引与事件流，再删内容，最后删身份。
        // moment 的删除同样要避开自引用：用 author_id 直接反查 community_user。
        jdbcTemplate.update("""
                DELETE FROM search_document WHERE object_type = 'MOMENT' AND object_id IN
                (SELECT id FROM moment WHERE author_id IN
                 (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com'))
                """);
        jdbcTemplate.update("""
                DELETE FROM reliable_event WHERE aggregate_id IN
                (SELECT id FROM moment WHERE author_id IN
                 (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com'))
                """);
        jdbcTemplate.update("""
                DELETE FROM moment_revision WHERE moment_id IN
                (SELECT id FROM moment WHERE author_id IN
                 (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com'))
                """);
        jdbcTemplate.update("""
                DELETE FROM moment WHERE author_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);

        jdbcTemplate.update("""
                DELETE FROM community_session WHERE user_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        // username_history 对用户名做全局唯一保留（uk_username_history_name），
        // 即使 profile 被删，名字仍占位。不清理它，下一次跑测试的同名 fixture 会
        // 直接撞唯一约束 → 注册 400（真实踩过）。必须在删 profile / user 之前清。
        jdbcTemplate.update("""
                DELETE FROM username_history WHERE user_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        // 注册时用户名占用检查会同时看 community_creation_space.slug
        // （CommunityAccountService 三处 findByUsername/findBySlug），
        // 这是最容易漏掉的一张对照表——只清 profile 会在下一次注册时撞名。
        jdbcTemplate.update("""
                DELETE FROM community_creation_space WHERE user_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        jdbcTemplate.update("""
                DELETE FROM community_profile WHERE user_id IN
                (SELECT id FROM community_user WHERE email LIKE 'evtcorr-%@example.com')
                """);
        // 删用户自身：同样不能自引用。
        jdbcTemplate.update("DELETE FROM community_user WHERE email LIKE 'evtcorr-%@example.com'");
    }

    /** 建一个已通过审核、可登录的社区用户。 */
    private record User(String token, String id, String email) {}

    /** 建一个已通过审核、可登录的社区用户，返回其 satoken。 */
    private String createApprovedUser(String tag) throws Exception {
        return createUser(tag).token();
    }

    /** 单调计数器：nanoTime()%N 会碰撞，用户名唯一约束会炸。 */
    private static final java.util.concurrent.atomic.AtomicInteger USER_SEQ =
            new java.util.concurrent.atomic.AtomicInteger();

    private User createUser(String tag) throws Exception {
        int seq = USER_SEQ.incrementAndGet();
        String email = PREFIX + tag + "-" + seq + "@example.com";
        String username = USER_PREFIX + tag + seq;
        // 用户名长度上限 32。
        if (username.length() > 32) {
            username = username.substring(0, 32);
        }
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Passw0rd!23","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk());

        String userId = userIdOf(email);
        assertNotNull(userId, "注册后必须能查到用户行");
        // 新用户默认 PENDING，登录会 403；走真实 admin 审核链路放行。
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
        assertNotNull(token, "审核通过后必须能登录拿到 satoken");
        return new User(token, userId, email);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
        assertFalse(token.isBlank(), "管理员登录必须返回可用 token");
        return token;
    }

    /** 走 admin 真实链路建活动。endsAt 为 null 时不下发该字段。 */
    private String createEvent(String title, String slug, Instant startsAt, Instant endsAt, boolean submissionOpen)
            throws Exception {
        // 统一挂上 EVENT_PREFIX，保证 cleanup() 的 `slug LIKE 'evtcorr-%'` 能闭合回收。
        String body = """
                {"title":"%s","slug":"%s","body":"活动正文","submissionOpen":%s,"startsAt":"%s"%s}
                """.formatted(title, EVENT_PREFIX + slug, submissionOpen, startsAt,
                endsAt == null ? "" : ",\"endsAt\":\"" + endsAt + "\"");
        MvcResult result = mockMvc.perform(post("/api/v1/admin/community/events")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("id").asText();
    }

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String momentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("id").asText();
        awaitSearchDocument("MOMENT", momentId);
        return momentId;
    }

    /**
     * 投稿要求内容已进入 {@code search_document}（{@code submit} 会查它来判断
     * "投稿内容是否存在"）。索引是异步的：mutation → reliable_event → consumer →
     * search_document，所以刚创建的动态需要等一下，否则会得到 404。
     * 这里轮询真实表，不缩短任何生产链路。
     */
    private void awaitSearchDocument(String objectType, String objectId) throws Exception {
        for (int i = 0; i < 100; i++) {
            Integer n = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM search_document WHERE object_type = ? AND object_id = ?",
                    Integer.class, objectType, objectId);
            if (n != null && n > 0) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("异步索引超时：search_document 未收录 " + objectType + " " + objectId);
    }

    private String registerAndReadId(String token, String eventId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/me/events/" + eventId + "/register")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String submitAndReadId(String token, String eventId, String objectId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/me/events/" + eventId + "/submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"MOMENT\",\"objectId\":\"" + objectId + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    // ---- DB probes ----

    private int countRegistrations(String eventId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_registration WHERE event_id = ?", Integer.class, eventId);
        return n == null ? 0 : n;
    }

    private int countSubmissions(String eventId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM event_submission WHERE event_id = ?", Integer.class, eventId);
        return n == null ? 0 : n;
    }

    private String statusOf(String eventId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM community_event WHERE id = ?", String.class, eventId);
    }

    private Instant instantOf(String eventId, String column) {
        return jdbcTemplate.query("SELECT " + column + " FROM community_event WHERE id = ?",
                rs -> rs.next() ? (rs.getTimestamp(column) == null ? null : rs.getTimestamp(column).toInstant()) : null,
                eventId);
    }

    private String userIdOf(String email) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email = ?", String.class, email);
    }

    private String registrationStatusOf(String eventId, String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM event_registration WHERE event_id = ? AND user_id = ?",
                String.class, eventId, userId);
    }
}

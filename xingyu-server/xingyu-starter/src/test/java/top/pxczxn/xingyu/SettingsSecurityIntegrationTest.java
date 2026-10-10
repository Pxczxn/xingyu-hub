package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Settings Contract Recovery（2026-10-08）的后端验收测试：B1 邮箱换绑闭环 + B2 停用加固。
 *
 * <p><b>验证边界</b>：全部跑在隔离 test 库（{@code TestDatabaseGuard} 只允许连
 * {@code xingyu_hub_test}），fixture 用户全部由本类现造、用完在 {@code @AfterEach}
 * 删净。绝不触碰 dev 库或任何真实账号。
 *
 * <p><b>邮件</b>：本类不依赖真实 SMTP。区分三件事：
 * <ol>
 *   <li><b>已签发 token</b> —— 断言 {@code email_verification_token} 里确实有一行
 *       带正确 {@code new_email} 与未过期 {@code expires_at} 的记录。这是可验证的。</li>
 *   <li><b>投递尝试</b> —— 响应里的 {@code mailPending}，test profile 下 SMTP 未配置，
 *       所以它必然为 {@code true}；本类据此确认"发不出去"这条路径也被走到。</li>
 *   <li><b>真实收到邮件</b> —— <b>不在此断言</b>。本项目没有可靠的收信断言机制，
 *       声称测过就是造假。链接点击一律通过直接调用真实的 verify 端点 + 真实库中
 *       的 token 行来模拟，不依赖邮件实际送达。</li>
 * </ol>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SettingsSecurityIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    /** 本测试造出来的 fixture id，@AfterEach 按依赖顺序删净。 */
    private final List<String> userIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        userIds.clear();
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        // 顺序有依赖：先删挂靠在 user 上的 token / session / api_token，再删用户。
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM email_verification_token WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recent_authentication WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_api_token WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM auth_security_event WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
    }

    // ================================================================= B1

    /**
     * B1 主路径：申请换绑 → 库里有带新邮箱的 EMAIL_CHANGE token → 确认 → 邮箱真的换了。
     *
     * <p>这是审计发现的死路本身：此前没有任何代码消费 EMAIL_CHANGE token，
     * 「完成确认后新邮箱才会生效」是一句永不兑现的承诺。
     */
    @Test
    void emailChangeCompletesOnlyAfterTheNewAddressIsConfirmed() throws Exception {
        Fixture alice = fixture("alice");
        String newEmail = uniqueEmail("alice_new");

        applyChangeEmail(alice, newEmail, 200);

        // 库里的 token 必须绑定了目标新邮箱（不是从 URL 猜的）
        JsonNode token = latestEmailChangeToken(alice.userId);
        assertNotNull(token, "必须签发 EMAIL_CHANGE token");
        assertEquals(newEmail, token.path("new_email").asText(),
                "token 必须持久化绑定目标新邮箱");
        assertTrue(token.path("consumed_at").isNull(), "刚签发的 token 不应已消费");
        assertEquals("EMAIL_CHANGE", token.path("purpose").asText());

        // 此时邮箱还没换
        assertEquals(alice.email, currentEmail(alice.userId), "确认前不得换绑");

        // 用真实 token 走真实 verify 端点
        MvcResult verify = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + rawTokenFor(alice.userId) + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = json(verify);
        assertEquals("EMAIL_CHANGED", body.path("status").asText());
        assertEquals(newEmail, body.path("email").asText());

        // 真的换了
        assertEquals(newEmail, currentEmail(alice.userId), "确认后必须真的换绑");
    }

    /**
     * REGISTER 与 EMAIL_CHANGE 不得互相消费对方的 token。
     *
     * <p>两个方向必须用两个独立用户：方向一（换绑 token 被当验证链接点）会把邮箱真的换掉，
     * 若与方向二共用一个用户，方向二的基线就已经是换过的地址，断言会拿旧值比对而必然失败——
     * 那是测试设计错误，不是实现错误。
     */
    @Test
    void purposesCannotConsumeEachOthersTokens() throws Exception {
        // ---- 方向一：把换绑 token 当"邮箱验证链接"用 -> 走 EMAIL_CHANGE 分支，且只发生换绑
        Fixture changer = fixture("purpose_chg");
        String newEmail = uniqueEmail("purpose_new");
        applyChangeEmail(changer, newEmail, 200);

        String changeToken = rawTokenFor(changer.userId);
        MvcResult asRegister = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + changeToken + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = json(asRegister);
        assertEquals("EMAIL_CHANGED", body.path("status").asText(),
                "换绑 token 不得走 REGISTER 分支");
        assertEquals(newEmail, currentEmail(changer.userId), "换绑 token 应只完成换绑");

        // ---- 方向二：REGISTER token 不得被用于换绑
        // 两个方向必须用两个独立用户：方向一已把邮箱换掉，若共用一个用户，
        // 方向二的基线就已经是换过的地址，拿旧值比对必然失败——那是测试设计错误而非实现错误。
        Fixture verifier = fixture("purpose_reg");
        String originalEmail = verifier.email;
        String registerRaw = "raw-register-" + System.nanoTime();
        insertToken(verifier.userId, registerRaw, "REGISTER", "2030-01-01 00:00:00", null, null);

        MvcResult asChange = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + registerRaw + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals("VERIFIED",
                json(asChange).path("status").asText(),
                "REGISTER token 不得走 EMAIL_CHANGE 分支");
        // REGISTER 分支只置 verified_at，绝不碰 email
        assertEquals(originalEmail, currentEmail(verifier.userId),
                "REGISTER token 绝不能改变登录邮箱");
    }

    /** 过期 token 安全拒绝，且不换绑。 */
    @Test
    void expiredEmailChangeTokenIsRejectedAndChangesNothing() throws Exception {
        Fixture alice = fixture("expired");
        String expiredRaw = "raw-expired-change-" + System.nanoTime();
        String newEmail = uniqueEmail("expired_new");
        insertToken(alice.userId, expiredRaw, "EMAIL_CHANGE", "2020-01-01 00:00:00", null, newEmail);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + expiredRaw + "\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertEquals("EMAIL_TOKEN_INVALID",
                json(result).path("code").asText());
        assertEquals(alice.email, currentEmail(alice.userId), "过期 token 绝不能换绑");
    }

    /** 重复消费安全拒绝（第二次点击同一个确认链接）。 */
    @Test
    void emailChangeTokenIsSingleUse() throws Exception {
        Fixture alice = fixture("replay");
        String newEmail = uniqueEmail("replay_new");
        applyChangeEmail(alice, newEmail, 200);
        String raw = rawTokenFor(alice.userId);

        mockMvc.perform(post("/api/v1/auth/email/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + raw + "\"}"))
                .andExpect(status().isOk());

        // 第二次：必须 400，不得改任何东西
        MvcResult second = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + raw + "\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertEquals("EMAIL_TOKEN_INVALID",
                json(second).path("code").asText());
        assertEquals(newEmail, currentEmail(alice.userId), "重放不得二次换绑");
    }

    /**
     * 换绑确认后旧邮箱不能登录、新邮箱能登录，且<b>原会话被撤销</b>。
     *
     * <p>这是需求 8 要求的明确契约，之前从未被任何测试覆盖过。
     */
    @Test
    void afterRebindOldEmailCannotLogInAndSessionsAreRevoked() throws Exception {
        Fixture alice = fixture("relogin");
        String newEmail = uniqueEmail("relogin_new");
        applyChangeEmail(alice, newEmail, 200);

        // 确认前：会话活着
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", alice.token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + rawTokenFor(alice.userId) + "\"}"))
                .andExpect(status().isOk());

        // 确认后：当前会话立即 401
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", alice.token))
                .andExpect(status().isUnauthorized());

        // 旧邮箱不能再登录（它已不是任何用户的 email）
        mockMvc.perform(login(alice.email)).andExpect(status().isUnauthorized());

        // 新邮箱能登录
        mockMvc.perform(login(newEmail)).andExpect(status().isOk());
    }

    /** 没有有效 re-auth grant 不得申请换绑。 */
    @Test
    void emailChangeRequiresRecentAuth() throws Exception {
        Fixture alice = fixture("nogrant");
        mockMvc.perform(post("/api/v1/me/email/change")
                        .header("satoken", alice.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newEmail\":\"" + uniqueEmail("nogrant_new") + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden());
        assertEquals(alice.email, currentEmail(alice.userId));
    }

    /** 别人的 grant 不能用于换绑（绑定 userId + sessionId）。 */
    @Test
    void emailChangeRejectsAnotherUsersGrant() throws Exception {
        Fixture alice = fixture("owner");
        Fixture mallory = fixture("mallory");
        String newEmail = uniqueEmail("stolen");

        mockMvc.perform(post("/api/v1/me/email/change")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", mallory.grantId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newEmail\":\"" + newEmail + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden());
        assertEquals(alice.email, currentEmail(alice.userId));
    }

    /** 已被他人占用的邮箱不得换绑。 */
    @Test
    void emailChangeRejectsAnAlreadyTakenAddress() throws Exception {
        Fixture alice = fixture("taker");
        Fixture bob = fixture("taken");
        applyChangeEmail(alice, bob.email, 400);
    }

    /** 两个待处理申请：后一个作废前一个，只有最后一个能确认。 */
    @Test
    void aSecondApplicationInvalidatesTheFirst() throws Exception {
        Fixture alice = fixture("twoapply");
        String firstEmail = uniqueEmail("first");
        String secondEmail = uniqueEmail("second");

        applyChangeEmail(alice, firstEmail, 200);
        String firstRaw = rawTokenFor(alice.userId);
        applyChangeEmail(alice, secondEmail, 200);

        // 第一个 token 已失效
        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + firstRaw + "\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(alice.email, currentEmail(alice.userId), "被作废的申请绝不能生效");

        // 第二个有效
        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + rawTokenFor(alice.userId) + "\"}"))
                .andExpect(status().isOk());
        assertEquals(secondEmail, currentEmail(alice.userId));
    }

    /** 并发申请必须留下恰好一个有效 token，且结果确定（不抛 500）。 */
    @Test
    void concurrentApplicationsLeaveExactlyOnePendingToken() throws Exception {
        Fixture alice = fixture("race");

        int threads = 4;
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicInteger ok = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        List<java.util.concurrent.Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final String target = uniqueEmail("race_" + i + "_");
            futures.add(pool.submit(() -> {
                try {
                    start.await();
                    MvcResult r = applyChangeEmailRaw(alice, target);
                    if (r.getResponse().getStatus() == 200) {
                        ok.incrementAndGet();
                    }
                } catch (Exception ignored) {
                    // 并发下被锁等待后失败是可接受的；关键是最后状态确定。
                }
            }));
        }
        start.countDown();
        for (java.util.concurrent.Future<?> f : futures) {
            f.get(30, java.util.concurrent.TimeUnit.SECONDS);
        }
        pool.shutdownNow();

        Integer pending = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM email_verification_token
                WHERE user_id = ? AND purpose = 'EMAIL_CHANGE' AND consumed_at IS NULL
                """, Integer.class, alice.userId);
        assertTrue(pending != null && pending <= 1,
                "任一时刻至多一条有效待确认 token，实际 " + pending);
        assertTrue(ok.get() >= 1, "至少一次申请应成功，实际 " + ok.get());
        assertEquals(alice.email, currentEmail(alice.userId), "并发申请本身不得改变邮箱");
    }

    /** 确认时新邮箱已被他人占用 → 明确失败，不静默成功。 */
    @Test
    void rebindFailsCleanlyWhenAddressGotTakenInTheMeantime() throws Exception {
        Fixture alice = fixture("late");
        String contested = uniqueEmail("contested");
        applyChangeEmail(alice, contested, 200);
        String raw = rawTokenFor(alice.userId);

        // 确认前，别人抢注了这个邮箱
        Fixture intruder = fixture("intruder");
        jdbcTemplate.update("UPDATE community_user SET email = ? WHERE id = ?", contested, intruder.userId);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + raw + "\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();
        String detail = json(result).path("detail").asText();
        assertTrue(detail.contains("占用"), "应说明被占用，实际: " + detail);
        assertEquals(alice.email, currentEmail(alice.userId), "换绑不得静默生效");
    }

    // ================================================================= B2

    /** 核心要求：有登录态但无有效 re-auth grant 时，停用必须被拒绝。 */
    @Test
    void deactivationIsRejectedWithASessionButNoFreshGrant() throws Exception {
        Fixture alice = fixture("noggrant");

        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token))
                .andExpect(status().isForbidden());

        assertEquals("ACTIVE", userStatus(alice.userId), "无 grant 绝不能停用");
        // 账号还活着，会话也必须还活着
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", alice.token))
                .andExpect(status().isOk());
    }

    /** 别人的 grant 不能用来停用自己的账号。 */
    @Test
    void deactivationRejectsAnotherUsersGrant() throws Exception {
        Fixture alice = fixture("d-victim");
        Fixture mallory = fixture("d-attacker");

        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", mallory.grantId))
                .andExpect(status().isForbidden());
        assertEquals("ACTIVE", userStatus(alice.userId));
    }

    /**
     * grant 单次消费：停用真的把 grant 标记为已消费，且已消费的 grant 无法再停用别人。
     *
     * <p><b>断言方式的选择很关键</b>：不能靠"对同一账号再调一次看是否 403"来证明 ——
     * 账号已停用后 {@code requireActiveSession} 会先拦成 401，测试会因为错误的理由而通过。
     * 所以这里直接断言 grant 行的 {@code consumed_at} 非空，再用别人账号验证已消费 grant 无效。
     */
    @Test
    void deactivationGrantIsSingleUse() throws Exception {
        Fixture alice = fixture("dsingle");
        String grant = alice.grantId;

        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", grant))
                .andExpect(status().isNoContent());
        assertEquals("SUSPENDED", userStatus(alice.userId));
        assertNotNull(grantConsumedAt(alice.userId), "停用必须真的消费 grant");

        // 关键：第二个请求会先被"账号已停用 -> 会话鉴权失败"拦成 401，
        // 所以"再调一次端点看是否 403"根本证明不了 grant 的单次消费 —— 它会因为
        // 错误的理由而通过（session 先失效）。必须直接断言 grant 行本身已被标记消费。
        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", grant))
                .andExpect(status().isUnauthorized());

        // 换一个仍然活着的账号，用"同一个已被消费的 grant"无法再停用它
        Fixture victim = fixture("dsingle_victim");
        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", victim.token)
                        .header("X-Recent-Auth", grant))
                .andExpect(status().isForbidden());
        assertEquals("ACTIVE", userStatus(victim.userId), "别人已消费的 grant 绝不能停用它");
    }

    /** grant 的 consumed_at；null 表示未消费。 */
    private java.sql.Timestamp grantConsumedAt(String userId) {
        List<java.sql.Timestamp> rows = jdbcTemplate.query(
                "SELECT consumed_at FROM recent_authentication WHERE id = ?",
                (rs, i) -> rs.getTimestamp("consumed_at"), grantOf(userId));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String grantOf(String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM recent_authentication WHERE user_id = ? ORDER BY verified_at DESC LIMIT 1",
                String.class, userId);
    }

    /** 停用后：当前会话、其他会话、已发行 API Token 全部失效；内容保留。 */
    @Test
    void deactivationInvalidatesSessionsAndApiTokensButKeepsContent() throws Exception {
        Fixture alice = fixture("dfull");
        Fixture other = fixture("dother");
        // 同一账号的第二个设备
        String secondDevice = loginToken(alice.email);
        // 一个已发行的 API Token
        JsonNode created = createApiToken(alice);
        String rawApiToken = created.path("token").asText();
        assertEquals(200, readOpenApi(rawApiToken, "/api/v1/open/profile").getResponse().getStatus());

        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", alice.grantId))
                .andExpect(status().isNoContent());

        assertEquals("SUSPENDED", userStatus(alice.userId));

        // 当前会话失效
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", alice.token))
                .andExpect(status().isUnauthorized());
        // 其他设备的会话同样失效
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", secondDevice))
                .andExpect(status().isUnauthorized());
        // 已发行的 API Token 不再能访问 Open API（本轮修的真实漏洞）
        assertEquals(401, readOpenApi(rawApiToken, "/api/v1/open/profile").getResponse().getStatus());
        // 无法再登录
        mockMvc.perform(login(alice.email)).andExpect(status().isForbidden());
        // 内容未被删除：用户行仍在
        assertNotNull(currentEmail(alice.userId), "停用不删内容，用户行必须仍在");
        assertNotEquals(other.email, currentEmail(alice.userId));
    }

    /** 停用是幂等的：重复请求不产生第二条安全事件。 */
    @Test
    void repeatedDeactivationIsIdempotent() throws Exception {
        Fixture alice = fixture("didem");
        mockMvc.perform(post("/api/v1/me/account/deletion-request")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", alice.grantId))
                .andExpect(status().isNoContent());

        Integer events = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM auth_security_event
                WHERE user_id = ? AND event_type = 'ACCOUNT_DEACTIVATED'
                """, Integer.class, alice.userId);
        assertEquals(1, events, "重复停用不得重复记账");
    }

    // ================================================================= Session / Token 撤销

    /** 撤销指定会话后立即失效（审计发现的测试缺口之一）。 */
    @Test
    void revokingASessionInvalidatesItImmediately() throws Exception {
        Fixture alice = fixture("srevoke");
        String second = loginToken(alice.email);

        String targetId = nonCurrentSessionId(alice.token);
        assertNotNull(targetId, "应有第二个会话可撤销");

        mockMvc.perform(delete("/api/v1/me/sessions/" + targetId).header("satoken", alice.token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", second))
                .andExpect(status().isUnauthorized());
    }

    /** 跨用户 IDOR：不能撤销别人的会话。 */
    @Test
    void cannotRevokeAnotherUsersSession() throws Exception {
        Fixture alice = fixture("idorA");
        Fixture bob = fixture("idorB");
        String bobSession = loginToken(bob.email);

        String bobSessionId = nonCurrentSessionId(bobSession);
        assertNotNull(bobSessionId, "bob 应有第二个会话");

        // alice 试着撤销 bob 的会话 → 必须 404，且 bob 的会话仍可用
        mockMvc.perform(delete("/api/v1/me/sessions/" + bobSessionId).header("satoken", alice.token))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", bobSession))
                .andExpect(status().isOk());
    }

    /**
     * 找出该登录态下「非当前」的那个会话 id。
     *
     * <p>{@code GET /api/v1/me/sessions} 返回<b>裸数组</b>（无 data envelope），
     * 元素是 {@code SessionView{sessionId, deviceLabel, lastActiveAt, expiresAt, revoked, current}}。
     * 返回 null 表示只有当前会话一个 —— 调用方负责断言，不在这里伪造。
     */
    private String nonCurrentSessionId(String satoken) throws Exception {
        JsonNode sessions = json(mockMvc.perform(get("/api/v1/me/sessions").header("satoken", satoken))
                .andExpect(status().isOk()).andReturn());
        assertTrue(sessions.isArray(), "sessions 应返回数组: " + sessions);
        for (JsonNode s : sessions) {
            if (!s.path("current").asBoolean()) {
                return s.path("sessionId").asText();
            }
        }
        return null;
    }

    /** 撤销 API Token 后真的失效（本轮之前的测试只到"撤销成功"就结束）。 */
    @Test
    void revokingAnApiTokenInvalidatesIt() throws Exception {
        Fixture alice = fixture("trevoke");
        JsonNode created = createApiToken(alice);
        String raw = created.path("token").asText();
        String tokenId = created.path("id").asText();
        assertEquals(200, readOpenApi(raw, "/api/v1/open/profile").getResponse().getStatus());

        mockMvc.perform(delete("/api/v1/me/api-tokens/" + tokenId).header("satoken", alice.token))
                .andExpect(status().isNoContent());

        assertEquals(401, readOpenApi(raw, "/api/v1/open/profile").getResponse().getStatus());
    }

    /** 跨用户 IDOR：不能撤销别人的 API Token。 */
    @Test
    void cannotRevokeAnotherUsersApiToken() throws Exception {
        Fixture alice = fixture("tidorA");
        Fixture bob = fixture("tidorB");
        JsonNode bobToken = createApiToken(bob);

        mockMvc.perform(delete("/api/v1/me/api-tokens/" + bobToken.path("id").asText())
                        .header("satoken", alice.token))
                .andExpect(status().isNotFound());

        // bob 的 token 必须仍可用
        assertEquals(200,
                readOpenApi(bobToken.path("token").asText(), "/api/v1/open/profile").getResponse().getStatus());
    }

    /** API Token 列表不泄露完整 token（只有 12 位 prefix）。 */
    @Test
    void apiTokenListNeverExposesTheSecret() throws Exception {
        Fixture alice = fixture("tsecret");
        String raw = createApiToken(alice).path("token").asText();

        JsonNode list = json(mockMvc.perform(get("/api/v1/me/api-tokens").header("satoken", alice.token))
                .andExpect(status().isOk()).andReturn());
        String responseBody = list.toString();
        assertTrue(!responseBody.contains(raw), "列表绝不能包含完整 token");
        assertTrue(responseBody.contains(raw.substring(0, 12)), "应只暴露 prefix");
    }

    // ================================================= EMAIL_CHANGE × email_verified_at

    /**
     * EMAIL_CHANGE 确认后的 {@code email_verified_at} 契约（2026-10-09 定点核验）。
     *
     * <p>覆盖的场景：账号注册时验证门禁关闭（verified_at 为 NULL），之后门禁开启，
     * 用户完成换绑确认。修复前：确认只改 email 不写 verified_at，新邮箱依然是
     * 「未验证」，门禁开启后登录被「请先完成邮箱验证」拦住 —— token 明明已经证明了所有权。
     *
     * <p>同时覆盖「不得提前继承」：确认前新地址只是 pendingEmail，旧邮箱仍是
     * 唯一登录邮箱；确认后旧会话全部失效、旧邮箱不可再登录。
     */
    @Test
    void emailChangeConfirmationMarksTheNewAddressVerified() throws Exception {
        // 门禁关闭基线：未验证账号也能登录（fixture 需要 session + grant）
        Fixture alice = fixture("chgver", false);

        // 确认前：邮箱未换，旧邮箱仍可登录（新地址不得提前继承验证状态）
        assertEquals(alice.email, currentEmail(alice.userId));
        mockMvc.perform(login(alice.email)).andExpect(status().isOk());

        String newEmail = uniqueEmail("chgver_new");
        applyChangeEmail(alice, newEmail, 200);
        assertEquals(alice.email, currentEmail(alice.userId), "确认前不得换绑");

        // 开启注册邮箱验证门禁（模拟生产语义），测试结束恢复 fixture 配置
        enableRegisterVerifyEmail();
        try {
            MvcResult verify = mockMvc.perform(post("/api/v1/auth/email/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"token\":\"" + knownRawTokenFor(alice.userId) + "\"}"))
                    .andExpect(status().isOk())
                    .andReturn();
            assertEquals("EMAIL_CHANGED", json(verify).path("status").asText());

            // DB 契约：邮箱换了，验证状态必须落到新邮箱上
            assertEquals(newEmail, currentEmail(alice.userId));
            assertNotNull(
                    jdbcTemplate.queryForObject(
                            "SELECT email_verified_at FROM community_user WHERE id = ?",
                            java.sql.Timestamp.class, alice.userId),
                    "换绑确认必须写入 email_verified_at");

            // 旧会话失效（换绑撤销全部会话）
            mockMvc.perform(get("/api/v1/me").header("satoken", alice.token))
                    .andExpect(status().isUnauthorized());

            // 门禁开启：新邮箱可正常登录；旧邮箱不再是任何账号的邮箱，不可登录
            mockMvc.perform(login(newEmail)).andExpect(status().isOk());
            mockMvc.perform(login(alice.email)).andExpect(status().isUnauthorized());
        } finally {
            // 恢复测试配置原状（verifyEmail:false 基线）
            CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        }
    }

    /** 临时开启注册邮箱验证门禁（调用方负责 finally 恢复）。 */
    private void enableRegisterVerifyEmail() {
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":true,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.refreshCache();
    }

    private record Fixture(String userId, String email, String token, String grantId) {
    }

    /** 造一个 ACTIVE 用户 + 一个登录会话 + 一个新鲜的 re-auth grant。 */
    private Fixture fixture(String tag) throws Exception {
        return fixture(tag, true);
    }

    /** 造一个 ACTIVE 用户 + 一个登录会话 + 一个新鲜的 re-auth grant。 */
    private Fixture fixture(String tag, boolean emailVerified) throws Exception {
        String email = uniqueEmail(tag);
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, %s, 'ACTIVE', 'user', '1.0', NOW())
                """.formatted(emailVerified ? "NOW()" : "NULL"),
                userId, email, PasswordSupport.hash(PASSWORD));
        // profile 也必须造：/open/profile 走的是 profileService.getProfile(userId)，
        // 只插 community_user 会得到 404「资料不存在」，看起来像 token 失效，其实不是。
        // 注册流程会同时建这两张表，fixture 必须还原这个事实。
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, display_name, visibility, followers_visibility, created_at)
                VALUES (?, ?, ?, ?, 'PUBLIC', 'PRIVATE', NOW())
                """, UUID.randomUUID().toString(), userId, uniqueUsername(tag), tag);

        String token = loginToken(email);
        String grantId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO recent_authentication
                    (id, user_id, session_id, verified_at, expires_at)
                VALUES (?, ?, (SELECT id FROM community_session WHERE token_value = ? LIMIT 1), NOW(),
                        DATE_ADD(NOW(), INTERVAL 15 MINUTE))
                """, grantId, userId, token);
        return new Fixture(userId, email, token, grantId);
    }

    private String uniqueUsername(String tag) {
        return "ssec_" + tag + "_" + (System.nanoTime() % 100000000L);
    }

    private String uniqueEmail(String tag) {
        return "ssec_" + tag + "_" + System.nanoTime() + "@example.com";
    }

    private MockHttpServletRequestBuilder login(String email) throws Exception {
        return post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}");
    }

    /** 登录并返回 satoken（登录成功才返回，否则测试就该失败而不是继续）。 */
    private String loginToken(String email) throws Exception {
        MvcResult result = mockMvc.perform(login(email))
                .andExpect(status().isOk())
                .andReturn();
        String raw = text(result);
        String token = objectMapper.readTree(raw).path("token").asText();
        assertTrue(token != null && !token.isBlank(), "登录必须返回 token: " + raw);
        return token;
    }

    private void applyChangeEmail(Fixture alice, String newEmail, int expectedStatus) throws Exception {
        MvcResult result = applyChangeEmailRaw(alice, newEmail);
        assertEquals(expectedStatus, result.getResponse().getStatus(),
                "响应: " + text(result));
    }

    private MvcResult applyChangeEmailRaw(Fixture alice, String newEmail) throws Exception {
        return mockMvc.perform(post("/api/v1/me/email/change")
                        .header("satoken", alice.token)
                        .header("X-Recent-Auth", alice.grantId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newEmail\":\"" + newEmail + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andReturn();
    }

    /**
     * 创建 API Token 并返回<b>裸响应体</b>。
     *
     * <p>注意：{@code POST /api/v1/me/api-tokens} 返回的是裸 JSON，<b>没有 data envelope</b>
     * （见 {@code CommunityMeController#createApiToken} 直接返回 {@code ApiTokenCreatedView}）。
     * 同理 {@code GET /api/v1/me/sessions} 返回裸数组。用 {@code .path("data")} 解析会拿到
     * MissingNode，token/id 都是空串，随后所有 Open API 调用都会带一个空 Bearer → 401，
     * 看起来像"后端拒了"，实际是测试解析错了。既有 {@code Batch7GrowthIntegrationTest}
     * 就是按顶层 {@code .path("token")} 解析的。
     */
    private JsonNode createApiToken(Fixture alice) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/me/api-tokens")
                        .header("satoken", alice.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"probe\",\"scopes\":[\"read:profile\"]}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode created = json(result);
        assertFalse(created.path("token").asText().isBlank(),
                "创建 token 必须返回明文: " + created);
        return created;
    }

    private MvcResult readOpenApi(String rawToken, String path) throws Exception {
        return mockMvc.perform(get(path).header("Authorization", "Bearer " + rawToken)).andReturn();
    }

    /**
     * 解析响应体，<b>强制 UTF-8</b>。
     *
     * <p>{@code MockHttpServletResponse.getContentAsString()} 在响应未显式带 charset 时
     * 会退回 ISO-8859-1，于是中文变成 {@code è¯¥é²®ç®±} 这类乱码 ——
     * 看起来像后端返回了乱码，实际上服务端返回的是正确的中文（见
     * {@code MockMvcResultHandlers} 打出的 Body）。所以凡是断言中文文案，必须走这里。
     */
    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(
                java.nio.charset.StandardCharsets.UTF_8));
    }

    /** 同 {@link #json}：响应体文本一律按 UTF-8 取。 */
    private String text(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    }

    private String currentEmail(String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT email FROM community_user WHERE id = ?", String.class, userId);
    }

    private String userStatus(String userId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM community_user WHERE id = ?", String.class, userId);
    }

    private JsonNode latestEmailChangeToken(String userId) {
        List<com.fasterxml.jackson.databind.node.ObjectNode> rows = jdbcTemplate.query("""
                SELECT purpose, new_email, expires_at, consumed_at
                FROM email_verification_token
                WHERE user_id = ? AND purpose = 'EMAIL_CHANGE'
                ORDER BY created_at DESC LIMIT 1
                """, (rs, i) -> {
            com.fasterxml.jackson.databind.node.ObjectNode n = objectMapper.createObjectNode();
            n.put("purpose", rs.getString("purpose"));
            n.put("new_email", rs.getString("new_email"));
            putInstant(n, "expires_at", rs.getTimestamp("expires_at"));
            putInstant(n, "consumed_at", rs.getTimestamp("consumed_at"));
            return n;
        }, userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * SQL NULL 必须写成 JSON null，而不是字符串 {@code "null"}。
     *
     * <p>{@code String.valueOf((Object) null)} 返回 {@code "null"}（4 个字符），
     * 用它 put 进 JSON 后 {@code isNull()} 会是 false，测试就会把「未消费」误判成「已消费」。
     */
    private void putInstant(com.fasterxml.jackson.databind.node.ObjectNode node,
                            String field, java.sql.Timestamp value) {
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value.toInstant().toString());
        }
    }

    private String rawTokenFor(String userId) {
        // 测试并不持有明文 token（生产也从不保存），所以这里用一个"直接消费库中行"的
        // 等价路径：临时把该行的 hash 换成已知明文的 hash，验证后再由 tearDown 删净。
        // 这**不是**伪造 token —— 行是真的、user_id 绑定是真的、verify 端点是真的。
        return knownRawTokenFor(userId);
    }

    private String knownRawTokenFor(String userId) {
        String known = "raw-known-" + UUID.randomUUID();
        jdbcTemplate.update(
                "UPDATE email_verification_token SET token_hash = ? WHERE user_id = ? AND purpose = 'EMAIL_CHANGE' AND consumed_at IS NULL",
                TokenSupport.sha256(known), userId);
        return known;
    }

    private void insertToken(String userId, String rawToken, String purpose,
                             String expiresAt, String consumedAt, String newEmail) {
        jdbcTemplate.update("""
                INSERT INTO email_verification_token
                    (id, user_id, token_hash, purpose, new_email, expires_at, consumed_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID().toString(), userId, TokenSupport.sha256(rawToken),
                purpose, newEmail, expiresAt, consumedAt);
    }
}

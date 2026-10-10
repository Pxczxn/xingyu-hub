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
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Authentication Contract Recovery（2026-10-08）的 HTTP 层验收测试。
 *
 * <p>覆盖 C-1（空/非法 token 不再 500）、C-2（注册幂等 REPLAYED / CONFLICT 与副作用）、
 * H-1（空 login 不进入 Redis 重试计数）。
 *
 * <p>全部走真实 HTTP + 真实数据库副作用断言，不 mock service。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AuthenticationContractRecoveryIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private org.springframework.data.redis.core.StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    // ---------------------------------------------------------------- C-1

    @Test
    void emailVerifyWithMissingTokenReturns400NotShell() throws Exception {
        assertEmailTokenInvalid("{\"token\":null}");
        assertEmailTokenInvalid("{}");
        assertEmailTokenInvalid("{\"token\":\"\"}");
        assertEmailTokenInvalid("{\"token\":\"   \"}");
        assertEmailTokenInvalid("{\"token\":\"not-a-real-token\"}");
    }

    @Test
    void passwordResetWithMissingTokenReturns400NotShell() throws Exception {
        // 先用合规密码，确保不是被密码策略拦下，而是真正走到 token 校验
        assertResetTokenInvalid("{\"token\":null,\"password\":\"Abcd1234!\"}");
        assertResetTokenInvalid("{\"password\":\"Abcd1234!\"}");
        assertResetTokenInvalid("{\"token\":\"\",\"password\":\"Abcd1234!\"}");
        assertResetTokenInvalid("{\"token\":\"   \",\"password\":\"Abcd1234!\"}");
        assertResetTokenInvalid("{\"token\":\"garbage\",\"password\":\"Abcd1234!\"}");
    }

    /**
     * C-1 全矩阵补齐：真实存在的「已过期」「已使用」token 必须是同一条领域 400，
     * 而不是 500，也不能被伪装成别的错误。
     *
     * <p>这两条不靠编造 token 文本，而是在库中插入真实行后走真实 HTTP 链路，
     * 断言 400 + EMAIL_TOKEN_INVALID，并覆盖 verify / reset 两个入口。
     */
    @Test
    void expiredAndConsumedTokensShareTheSameDomainError() throws Exception {
        String userId = seedActiveUser("expired_consumed");
        String rawExpired = "raw-expired-" + System.nanoTime();
        String rawConsumed = "raw-consumed-" + System.nanoTime();

        insertToken(userId, rawExpired, "REGISTER", "2020-01-01 00:00:00", null);
        insertToken(userId, rawConsumed, "REGISTER", "2030-01-01 00:00:00", "2020-01-01 00:00:00");
        insertToken(userId, rawExpired, "PASSWORD_RESET", "2020-01-01 00:00:00", null);
        insertToken(userId, rawConsumed, "PASSWORD_RESET", "2030-01-01 00:00:00", "2020-01-01 00:00:00");

        // 已过期 / 已使用：verify 与 reset 都必须是 400 EMAIL_TOKEN_INVALID
        assertEmailTokenInvalid("{\"token\":\"" + rawExpired + "\"}");
        assertEmailTokenInvalid("{\"token\":\"" + rawConsumed + "\"}");
        assertResetTokenInvalid("{\"token\":\"" + rawExpired + "\",\"password\":\"Abcd1234!\"}");
        assertResetTokenInvalid("{\"token\":\"" + rawConsumed + "\",\"password\":\"Abcd1234!\"}");

        jdbcTemplate.update("DELETE FROM email_verification_token WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
    }

    /**
     * 无效 token 一律为领域定义的 400 EMAIL_TOKEN_INVALID，且响应体不得泄漏异常堆栈。
     */
    private void assertEmailTokenInvalid(String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/email/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertTokenInvalidProblem(result);
    }

    private void assertResetTokenInvalid(String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/password-reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andReturn();
        assertTokenInvalidProblem(result);
    }

    private void assertTokenInvalidProblem(MvcResult result) throws Exception {
        String raw = result.getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(raw);
        assertEquals("EMAIL_TOKEN_INVALID", json.path("code").asText(), "响应体: " + raw);
        assertEquals(400, json.path("status").asInt(), "响应体: " + raw);
        // 不泄漏异常堆栈 / 内部类名
        String lower = raw.toLowerCase();
        assertTrue(!lower.contains("exception"), "响应体不得包含异常字样: " + raw);
        assertTrue(!lower.contains("java.lang"), "响应体不得包含类名: " + raw);
        assertTrue(!lower.contains("npe"), "响应体不得包含 NPE 线索: " + raw);
    }

    // ---------------------------------------------------------------- C-2

    @Test
    void sameKeySamePayloadReplaysWithoutExtraSideEffects() throws Exception {
        long nonce = System.nanoTime();
        String email = "idem_same_" + nonce + "@example.com";
        String username = "idemsame" + (nonce % 1_000_000_000L);
        String key = "contract-same-" + nonce;
        String body = registerBody(email, username);

        JsonNode first = registerJson(key, body, 200);
        JsonNode second = registerJson(key, body, 200);

        // 同 Key + 同 Payload → 原响应重放（含同一 userId）
        assertEquals(first.path("userId").asText(), second.path("userId").asText(),
                "重放必须返回同一 userId");

        // 不得产生额外 user / profile / space
        assertEquals(1, countUsers(email), "不得重复创建用户");
        assertEquals(1, countProfiles(username), "不得重复创建 profile");
        assertEquals(1, countSpaces(username), "不得重复创建 creation space");
        assertEquals(1, countIdempotency("register:" + key), "幂等记录数必须为 1");
    }

    @Test
    void sameKeyDifferentPayloadConflicts() throws Exception {
        long nonce = System.nanoTime();
        String email = "idem_conf_" + nonce + "@example.com";
        String username = "idemconf" + (nonce % 1_000_000_000L);
        String key = "contract-conflict-" + nonce;

        register(key, registerBody(email, username)).andExpect(status().isOk());
        // 同 Key + 不同 Payload（换邮箱）→ 409 IDEMPOTENCY_CONFLICT
        MvcResult conflict = register(key, registerBody("other_" + email, username))
                .andExpect(status().isConflict())
                .andReturn();
        JsonNode problem = objectMapper.readTree(conflict.getResponse().getContentAsString());
        assertEquals("IDEMPOTENCY_CONFLICT", problem.path("code").asText());

        // 冲突不得产生任何新用户
        assertEquals(0, countUsers("other_" + email), "冲突请求不得创建用户");
        assertEquals(1, countUsers(email), "原用户仍在且唯一");
    }

    @Test
    void differentKeysFollowNormalRegistrationAndAntiEnumeration() throws Exception {
        long nonce = System.nanoTime();
        String email = "idem_diff_" + nonce + "@example.com";
        String username = "idemdiff" + (nonce % 1_000_000_000L);

        JsonNode first = registerJson("contract-diff-a-" + nonce, registerBody(email, username), 200);

        // 不同 Key + 同一邮箱（新用户名）→ 走反枚举，返回既有账号响应
        String otherName = "idemdiffB" + (nonce % 1_000_000_000L);
        JsonNode second = registerJson("contract-diff-b-" + nonce, registerBody(email, otherName), 200);

        assertEquals(first.path("userId").asText(), second.path("userId").asText(),
                "换 Key 但同邮箱必须命中反枚举既有账号");
        assertEquals(1, countUsers(email), "反枚举不得创建第二个用户");
        assertEquals(0, countProfiles(otherName), "反枚举不得创建第二个 profile");
    }

    @Test
    void concurrentSameKeyDoesNotDoubleRegister() throws Exception {
        long nonce = System.nanoTime();
        String email = "idem_race_" + nonce + "@example.com";
        String username = "idemrace" + (nonce % 1_000_000_000L);
        String key = "contract-race-" + nonce;
        String body = registerBody(email, username);

        int threads = 6;
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.atomic.AtomicInteger ok = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger conflict = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger unexpected = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        java.util.List<java.util.concurrent.Future<?>> futures = new java.util.ArrayList<>();

        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                try {
                    start.await();
                    int status = mockMvc.perform(post("/api/v1/auth/register")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .header("Idempotency-Key", key)
                                    .content(body))
                            .andReturn().getResponse().getStatus();
                    if (status == 200) {
                        ok.incrementAndGet();
                    } else if (status == 409) {
                        conflict.incrementAndGet();
                    } else {
                        unexpected.incrementAndGet();
                    }
                } catch (Exception ex) {
                    unexpected.incrementAndGet();
                }
            }));
        }
        start.countDown();
        for (java.util.concurrent.Future<?> f : futures) {
            f.get();
        }
        pool.shutdown();

        assertEquals(0, unexpected.get(), "并发注册出现非 200/409 状态，说明有未预期异常");
        assertTrue(ok.get() >= 1, "至少一个请求成功");
        assertEquals(1, countUsers(email), "并发同 Key 不得产生重复用户");
        assertEquals(1, countProfiles(username), "并发同 Key 不得产生重复 profile");
        assertEquals(1, countSpaces(username), "并发同 Key 不得产生重复 space");
        assertEquals(1, countIdempotency("register:" + key), "幂等记录数必须为 1");
    }

    // ---------------------------------------------------------------- H-1

    @Test
    void blankLoginRejectedBeforeRetryCounter() throws Exception {
        int before = retryKeyCount();
        for (int i = 0; i < 8; i++) {
            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"login\":\"\",\"password\":\"whatever\"}"))
                    .andExpect(status().isBadRequest());
        }
        // 空 login 不得创建任何 community:login:retry: 键
        assertEquals(before, retryKeyCount(), "空 login 不得进入 Redis 重试计数");
    }

    // ---------------------------------------------------------------- helpers

    private String registerBody(String email, String username) {
        return """
                {"email":"%s","username":"%s","password":"Abcd1234!","termsVersion":"1.0"}
                """.formatted(email, username);
    }

    private org.springframework.test.web.servlet.ResultActions register(String key, String body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Idempotency-Key", key)
                .content(body));
    }

    private JsonNode registerJson(String key, String body, int expectedStatus) throws Exception {
        MvcResult result = register(key, body)
                .andExpect(status().is(expectedStatus))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private int countUsers(String email) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_user WHERE email = ?", Integer.class, email);
        return n == null ? 0 : n;
    }

    private int countProfiles(String username) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_profile WHERE username = ?", Integer.class, username);
        return n == null ? 0 : n;
    }

    private int countSpaces(String slug) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM community_creation_space WHERE slug = ?", Integer.class, slug);
        return n == null ? 0 : n;
    }

    private int countIdempotency(String qualifiedKey) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM registration_idempotency WHERE qualified_key = ?",
                Integer.class, qualifiedKey);
        return n == null ? 0 : n;
    }

    /** 直接在库里造一个 ACTIVE 用户，供 token 契约测试挂靠（不改 schema，仅数据行）。 */
    private String seedActiveUser(String tag) {
        String id = java.util.UUID.randomUUID().toString();
        jdbcTemplate.update("""
                        INSERT INTO community_user
                            (id, email, password_hash, status, role, terms_version, created_at)
                        VALUES (?, ?, ?, 'ACTIVE', 'user', '1.0', NOW())
                        """,
                id, tag + "_" + System.nanoTime() + "@example.com",
                top.pxczxn.xingyu.community.support.PasswordSupport.hash("Abcd1234!"));
        return id;
    }

    /** 插入一条真实 token 行；token_hash 与生产一致，用同一 sha256 算法。 */
    private void insertToken(String userId, String rawToken, String purpose,
                             String expiresAt, String consumedAt) {
        jdbcTemplate.update("""
                        INSERT INTO email_verification_token
                            (id, user_id, token_hash, purpose, expires_at, consumed_at, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                        """,
                java.util.UUID.randomUUID().toString(), userId,
                top.pxczxn.xingyu.community.support.TokenSupport.sha256(rawToken),
                purpose, expiresAt, consumedAt);
    }

    /** 统计 Redis 里社区登录重试键数量（H-1 断言用）。 */
    private int retryKeyCount() {
        java.util.Set<String> keys = redisTemplate.keys("community:login:retry:*");
        return keys == null ? 0 : keys.size();
    }
}

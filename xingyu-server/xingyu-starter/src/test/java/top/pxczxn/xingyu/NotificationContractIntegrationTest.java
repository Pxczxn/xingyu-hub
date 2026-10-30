package top.pxczxn.xingyu;

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

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 通知契约恢复（V044 + NotificationView.actor）的集成验证。
 *
 * <p><b>这是 fixture 级验证，不是真实多账号业务验证</b>：账号由测试自己注册，关注链路
 * 通过真实 HTTP 端点走通（注册 → 登录 → 关注 → 读通知），因此它证明的是「代码 + 迁移 +
 * 真实 MySQL」这条链路成立，而不是「线上某个真实用户真的收到了通知」。两者不要混为一谈。
 *
 * <p>覆盖的契约点：
 * <ul>
 *   <li>FOLLOW 通知落库时写入稳定 actor 身份（user_id），而不是把 username 固化进文本；
 *   <li>读取时按 actor_user_id 现查 community_profile，得到当前 canonical username；
 *   <li>actor 改名后，历史通知的 actor.username 跟着变（因此导航仍指向当前主页）；
 *   <li>created_at 相同时排序仍确定（created_at DESC, id DESC）；
 *   <li>limit 兜底 50 / 上限 100；
 *   <li>markRead 的归属校验（别人的通知 = 404，不是泄露）；
 *   <li>read-all 作用于账户全部通知，未读数因此归零；
 *   <li>没有 actor 的历史/系统类行仍可读，actor 为 null。
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationContractIntegrationTest {

    private static final String PASSWORD = "Test1234!@#ab";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** 每个用例自己造账号（nonce 隔离），互不干扰。 */
    private long nonce;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        nonce = System.nanoTime();
    }

    // ---------------------------------------------------------------- FOLLOW actor

    @Test
    void followNotificationCarriesStableActorAndResolvesCurrentUsername() throws Exception {
        Account follower = registerAndLogin("nca");
        Account followee = registerAndLogin("ncb");

        follow(follower, followee.username);

        String followerUserId = userIdOf(follower.username);
        mockMvc.perform(get("/api/v1/notifications").header("satoken", followee.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("FOLLOW"))
                // 稳定身份：写入的是 user_id，读出来还是同一个 user_id。
                .andExpect(jsonPath("$[0].actor.userId").value(followerUserId))
                // 当前 canonical username：用于拼 /u/{username}。
                .andExpect(jsonPath("$[0].actor.username").value(follower.username))
                // 单行文案：title 表达完整语义，body 不再重复说第二遍。
                .andExpect(jsonPath("$[0].title", endsWith("关注了你")))
                .andExpect(jsonPath("$[0].body").value(nullValue()));
    }

    /**
     * 反证（本轮明确要求）：actor 改名后，历史通知还能不能导航。
     *
     * <p>导航能力等价于「actor.userId 不变 + actor.username 变成新值」，因为前端用的是
     * {@code /u/{actor.username}}。这里直接断言这两点：如果实现把 username 固化进通知，
     * 第二条断言就会失败。
     */
    @Test
    void renamingTheActorStillPointsAtTheirCurrentProfile() throws Exception {
        Account follower = registerAndLogin("ncra");
        Account followee = registerAndLogin("ncrb");

        follow(follower, followee.username);

        String stableUserId = userIdOf(follower.username);
        String renamed = follower.username + "x";

        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", follower.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + renamed + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/notifications").header("satoken", followee.token))
                .andExpect(status().isOk())
                // 身份不变……
                .andExpect(jsonPath("$[0].actor.userId").value(stableUserId))
                // ……用户名解析到改名后的当前值。
                .andExpect(jsonPath("$[0].actor.username").value(renamed));
    }

    /**
     * V044 之前写入的行没有 actor 身份（历史 FOLLOW 行就是这样）。它们必须仍然可读，
     * 只是 {@code actor} 为 null —— 前端据此不渲染跳转，而不是崩掉或给出死链。
     */
    @Test
    void aLegacyRowWithoutAnActorStillRendersWithNullActor() throws Exception {
        Account user = registerAndLogin("ncn");

        insertNotification(userIdOf(user.username), null, "FOLLOW", "有人关注了你", Timestamp.from(Instant.now()));

        mockMvc.perform(get("/api/v1/notifications").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("FOLLOW"))
                .andExpect(jsonPath("$[0].actor").value(nullValue()));
    }

    /**
     * 反证（本轮明确要求）：FOLLOW 被取消后，历史通知是否仍有合理目标。
     *
     * <p>通知行与关注关系是两件事：取消关注只删 {@code user_follow}，通知行和 actor 的
     * community_profile 都还在，因此历史通知仍然指向 actor 的当前主页。如果实现把目标
     * 建在关注关系上（或不存在的对象上），这条断言就会失败或变成死链。
     */
    @Test
    void unfollowingKeepsTheHistoricalNotificationNavigable() throws Exception {
        Account follower = registerAndLogin("ncu");
        Account followee = registerAndLogin("ncu2");

        follow(follower, followee.username);
        mockMvc.perform(get("/api/v1/notifications").header("satoken", followee.token))
                .andExpect(jsonPath("$[0].actor.username").value(follower.username));

        mockMvc.perform(delete("/api/v1/users/" + followee.username + "/follow")
                        .header("satoken", follower.token))
                .andExpect(status().isNoContent());

        // 通知没被删，actor 仍解析得到 —— 目标依旧可达。
        mockMvc.perform(get("/api/v1/notifications").header("satoken", followee.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("FOLLOW"))
                .andExpect(jsonPath("$[0].actor.username").value(follower.username));

        // Default registration is PRIVATE now; this test is about the notification
        // target staying navigable, so make the actor's profile public explicitly.
        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", follower.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"PUBLIC\",\"lockVersion\":0}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/" + follower.username))
                .andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- ordering

    /**
     * 反证（本轮明确要求）：相同 createdAt 是否稳定。
     *
     * <p>{@code notification.created_at} 是秒精度的 timestamp，同一秒内产生的多条通知只靠
     * created_at 无法定序。补了 id tie-breaker 之后，两次读取必须给出**同一个**顺序，且该
     * 顺序就是 id DESC。注意 id 是随机 UUID —— 它提供稳定但不提供时序，这里断言的是稳定。
     */
    @Test
    void identicalCreatedAtIsOrderedDeterministically() throws Exception {
        Account user = registerAndLogin("nco");
        String userId = userIdOf(user.username);

        Timestamp sameInstant = Timestamp.from(Instant.now());
        // id 里带上本次运行的 nonce：测试库是长期存在的，固定 id 会在第二次运行时撞主键。
        // 三个 id 只有末位不同，因此 `id DESC` 的期望顺序是确定的。
        String base = "ord" + nonce;
        List<String> ids = List.of(base + "-a", base + "-b", base + "-c");
        for (String id : ids) {
            jdbcTemplate.update(
                    "INSERT INTO notification (id, user_id, category, title, body, read_at, created_at) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    id, userId, "FOLLOW", "同一秒 " + id, null, null, sameInstant);
        }

        List<String> first = listIds(user.token);
        List<String> second = listIds(user.token);

        assertThat(first).isEqualTo(second);
        assertThat(first).containsExactly(base + "-c", base + "-b", base + "-a");
    }

    // ---------------------------------------------------------------- limit

    @Test
    void limitDefaultsToFiftyAndIsCappedAtOneHundred() throws Exception {
        Account user = registerAndLogin("ncl");
        String userId = userIdOf(user.username);

        Timestamp base = Timestamp.from(Instant.now());
        String idPrefix = "lim" + nonce;
        List<Object[]> batch = new ArrayList<>();
        for (int index = 0; index < 101; index++) {
            batch.add(new Object[] {
                    String.format("%s-%08d", idPrefix, index),
                    userId,
                    "FOLLOW",
                    "第 " + index + " 条",
                    null,
                    base});
        }
        jdbcTemplate.batchUpdate(
                "INSERT INTO notification (id, user_id, category, title, body, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                batch);

        mockMvc.perform(get("/api/v1/notifications").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(50));

        mockMvc.perform(get("/api/v1/notifications?limit=0").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(50));

        mockMvc.perform(get("/api/v1/notifications?limit=100000").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(100));
    }

    // ---------------------------------------------------------------- read state

    @Test
    void markingSomebodyElsesNotificationReadIsNotFound() throws Exception {
        Account follower = registerAndLogin("ncma");
        Account followee = registerAndLogin("ncmb");
        follow(follower, followee.username);

        String foreignId = firstNotificationId(followee.token);

        mockMvc.perform(patch("/api/v1/notifications/" + foreignId + "/read")
                        .header("satoken", follower.token))
                .andExpect(status().isNotFound());

        // 没有被误改：接收者读到的仍然是未读。
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("satoken", followee.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1));
    }

    /**
     * 反证（本轮明确要求）：全部已读后页面 / Header / 数据库是否一致。
     *
     * <p>Header 一致性在服务端这一侧等价于「read-all 之后 unread-count 为 0」，而页面把
     * 这个 0 广播给 Header。所以这里同时断言接口读数和数据库真实状态。
     */
    @Test
    void readAllIsAccountWideAndZeroesTheUnreadCount() throws Exception {
        Account user = registerAndLogin("ncra2");
        String userId = userIdOf(user.username);

        Timestamp now = Timestamp.from(Instant.now());
        insertNotification(userId, null, "FOLLOW", "一条", now);
        insertNotification(userId, null, "FOLLOW", "两条", now);
        insertNotification(userId, null, "FOLLOW", "三条", now);

        mockMvc.perform(get("/api/v1/notifications/unread-count").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(3));

        mockMvc.perform(post("/api/v1/notifications/read-all").header("satoken", user.token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/notifications/unread-count").header("satoken", user.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(0));

        Integer stillUnread = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notification WHERE user_id = ? AND read_at IS NULL",
                Integer.class,
                userId);
        assertThat(stillUnread).isZero();
    }

    @Test
    void unreadCountRequiresASession() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/unread-count"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- helpers

    /** 注册 + 登录，拿到 satoken 与 username。 */
    private Account registerAndLogin(String prefix) throws Exception {
        String suffix = Long.toString(nonce, 36) + Math.abs(prefix.hashCode() % 1000);
        String email = prefix + suffix + "@example.com";
        // 用户名规则：^[a-z0-9_]{3,32}$ —— 前缀 + base36 尾缀足够唯一，只做长度兜底。
        String raw = (prefix + suffix).toLowerCase(java.util.Locale.ROOT);
        String username = raw.length() > 32 ? raw.substring(0, 32) : raw;

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, PASSWORD)))
                .andExpect(status().isOk());

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();

        return new Account(username, loginResult.getResponse().getHeader("satoken"));
    }

    private void follow(Account follower, String followeeUsername) throws Exception {
        mockMvc.perform(post("/api/v1/users/" + followeeUsername + "/follow")
                        .header("satoken", follower.token))
                .andExpect(status().isNoContent());
    }

    private String userIdOf(String username) {
        return jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = ?", String.class, username);
    }

    private void insertNotification(
            String userId, String actorUserId, String category, String title, Timestamp createdAt) {
        jdbcTemplate.update(
                "INSERT INTO notification (id, actor_user_id, user_id, category, title, body, "
                        + "read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                java.util.UUID.randomUUID().toString(),
                actorUserId,
                userId,
                category,
                title,
                null,
                null,
                createdAt);
    }

    private List<String> listIds(String token) throws Exception {
        String json = mockMvc.perform(get("/api/v1/notifications").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        List<String> ids = new ArrayList<>();
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("\"id\":\"([^\"]+)\"").matcher(json);
        while (matcher.find()) {
            ids.add(matcher.group(1));
        }
        return ids;
    }

    private String firstNotificationId(String token) throws Exception {
        String json = mockMvc.perform(get("/api/v1/notifications").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("\"id\":\"([^\"]+)\"").matcher(json);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private record Account(String username, String token) {
    }
}

package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
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
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列乐观锁并发回归（2026-10-10 P0-B）。
 *
 * <p>背景：SeriesService.update 旧实现是「先读后写」（内存比较 lockVersion +
 * updateById 全字段写），与 ArticleService D0 缺陷同型——两个客户端基于同一版本并发
 * 保存会双双通过、后写静默覆盖、版本号不变。修复后检查-写入在同一条件 UPDATE 内原子
 * 完成。本测试以<b>真实并发 HTTP 请求</b>（非 Mock）竞争同一版本：恰好一胜一 409、
 * 落库版本恰好推进一位、败者以新版本重试成功。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SeriesConcurrencyIntegrationTest {

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

    private String token;
    private String seriesId;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = seedCommunityUser();
        seriesId = seedSeries();
    }

    @AfterAll
    void tearDown() {
        for (String sid : seriesIds) {
            jdbcTemplate.update("DELETE FROM series_chapter WHERE series_id = ?", sid);
            jdbcTemplate.update("DELETE FROM series WHERE id = ?", sid);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        seriesIds.clear();
    }

    // ---- 竞争写入 ----

    @Test
    @Order(1)
    void concurrentUpdatesOnSameVersionProduceExactlyOneWinner() throws Exception {
        // 两个真实并发请求都携带 lockVersion=0：无论交错顺序如何，
        // 条件 UPDATE 必须保证恰好一个 200、一个 409，且落库版本恰好是 1。
        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final String title = "并发写入-" + i;
            results.add(pool.submit((Callable<Integer>) () -> {
                ready.countDown();
                start.await();
                MvcResult result = mockMvc.perform(
                                put("/api/v1/me/series/" + seriesId)
                                        .header("satoken", token)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"title\":\"" + title + "\",\"lockVersion\":0}"))
                        .andReturn();
                return result.getResponse().getStatus();
            }));
        }
        assertTrue(ready.await(10, TimeUnit.SECONDS));
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> f : results) {
            statuses.add(f.get(30, TimeUnit.SECONDS));
        }
        pool.shutdown();

        long wins = statuses.stream().filter(s -> s == 200).count();
        long conflicts = statuses.stream().filter(s -> s == 409).count();
        assertEquals(1, wins, "同一版本并发更新必须恰好一个成功，statuses=" + statuses);
        assertEquals(1, conflicts, "另一路必须 409，statuses=" + statuses);

        Long dbVersion = jdbcTemplate.queryForObject(
                "SELECT lock_version FROM series WHERE id = ?", Long.class, seriesId);
        assertEquals(1L, dbVersion, "两个并发写之后版本必须恰好推进到 1（旧实现两次都写 0+1 不变）");
    }

    @Test
    @Order(2)
    void loserRetryingWithFreshVersionSucceeds() throws Exception {
        // 上一个用例后版本=1：用旧版本 0 仍然 409（快速失败路径），新版本 1 成功。
        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"过期写入\",\"lockVersion\":0}"))
                .andExpect(status().isConflict());

        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"新鲜写入\",\"lockVersion\":1}"))
                .andExpect(status().isOk());

        String title = jdbcTemplate.queryForObject(
                "SELECT title FROM series WHERE id = ?", String.class, seriesId);
        assertEquals("新鲜写入", title);
        Long version = jdbcTemplate.queryForObject(
                "SELECT lock_version FROM series WHERE id = ?", Long.class, seriesId);
        assertEquals(2L, version);
    }

    @Test
    @Order(3)
    void staleVersionCannotSilentlyOverwriteNewerContent() throws Exception {
        // 基于旧快照的写入（拿版本 1 的内容但带版本 1 提交，当前库已是 2）必须被拒，
        // 且库内标题保持新鲜写入的结果——旧版本不得静默覆盖新版本。
        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"旧快照覆盖\",\"lockVersion\":1}"))
                .andExpect(status().isConflict());

        String title = jdbcTemplate.queryForObject(
                "SELECT title FROM series WHERE id = ?", String.class, seriesId);
        assertEquals("新鲜写入", title, "旧版本写入不得改变库内内容");
    }

    @Test
    @Order(4)
    void responseMatchesPersistedState() throws Exception {
        MvcResult result = mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"响应一致\",\"lockVersion\":2}"))
                .andExpect(status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals("响应一致", body.path("title").asText(),
                "响应必须反映真实持久化结果（从 DB 重读）");
        assertEquals(3L, body.path("lockVersion").asLong(),
                "响应的 lockVersion 必须等于持久化后的版本");
        Long dbVersion = jdbcTemplate.queryForObject(
                "SELECT lock_version FROM series WHERE id = ?", Long.class, seriesId);
        assertEquals(3L, dbVersion);
    }

    // ---- helpers ----

    private String seedCommunityUser() throws Exception {
        String email = "seriesconc" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                "sc-space-" + (System.nanoTime() % 100000000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String seedSeries() throws Exception {
        String slug = "sc-" + (System.nanoTime() % 100000000L);
        MvcResult created = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"并发回归系列\",\"slug\":\"" + slug + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String id = objectMapper.readTree(created.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("id").asText();
        assertTrue(!id.isBlank(), "create series must return id");
        seriesIds.add(id);
        return id;
    }
}

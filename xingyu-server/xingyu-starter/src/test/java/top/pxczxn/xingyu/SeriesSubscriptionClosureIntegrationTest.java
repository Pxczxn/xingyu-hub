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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列订阅闭环回归（2026-10-10 Series Subscription Closure）。
 *
 * <p>契约：GET /series/{id} 现在回报 viewer-scoped hasSubscribed（登录 true/false，
 * 游客 null）；subscribe 要求系列 ACTIVE；unsubscribe 幂等且<b>无状态门槛</b>——
 * 系列归档后既有订阅者仍能取消（详情页 404 只是浏览入口，不影响 API 语义）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SeriesSubscriptionClosureIntegrationTest {

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
    private String otherToken;
    private String seriesId;
    private String ownerId;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        // 系列作者（另一用户，保证订阅者≠作者）
        List<String> author = seedUser("sebsub-author");
        ownerId = author.get(0);
        List<String> reader = seedUser("sebsub-reader");
        token = reader.get(1);
        List<String> other = seedUser("sebsub-other");
        otherToken = other.get(1);
        seriesId = seedSeries(ownerId);
    }

    @AfterAll
    void tearDown() {
        for (String sid : seriesIds) {
            jdbcTemplate.update("DELETE FROM series_subscription WHERE series_id = ?", sid);
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

    // ---- 验收矩阵 ----

    @Test
    @Order(1)
    void guestGetsNullHasSubscribed() throws Exception {
        mockMvc.perform(get("/api/v1/series/" + seriesId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSubscribed").doesNotExist());
    }

    @Test
    @Order(2)
    void signedInViewerStartsFalseThenSubscribesAndStaysTrueAfterRefresh() throws Exception {
        assertEquals(false, hasSubscribed(), "未订阅时应回报 false");
        mockMvc.perform(post("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals(true, hasSubscribed(), "订阅后刷新详情必须回报 true（状态持久）");
    }

    @Test
    @Order(3)
    void repeatedSubscribeIsIdempotent() throws Exception {
        mockMvc.perform(post("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", token))
                .andExpect(status().isNoContent());
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_subscription WHERE user_id = ? AND series_id = ?",
                Integer.class, userIds.get(1), seriesId);
        assertEquals(1, rows, "重复订阅不得产生第二行");
    }

    @Test
    @Order(4)
    void unsubscribeKeepsWorkingAfterSeriesArchived() throws Exception {
        // 归档系列：详情 404（浏览入口关闭），但既有订阅者仍能取消（unsubscribe 无状态门槛）
        jdbcTemplate.update("UPDATE series SET status = 'ARCHIVED' WHERE id = ?", seriesId);
        mockMvc.perform(get("/api/v1/series/" + seriesId).header("satoken", token))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", token))
                .andExpect(status().isNoContent());
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM series_subscription WHERE user_id = ? AND series_id = ?",
                Integer.class, userIds.get(1), seriesId);
        assertEquals(0, rows, "归档后既有订阅者必须仍能取消订阅");
    }

    @Test
    @Order(5)
    void archivedSeriesRejectsNewSubscription() throws Exception {
        // 前一用例已归档：新订阅必须被拒（NOT_FOUND）
        mockMvc.perform(post("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", otherToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(6)
    void repeatedUnsubscribeAndUnauthenticatedAreWellFormed() throws Exception {
        // 恢复 ACTIVE 走一遍幂等取消 + 未登录 401
        jdbcTemplate.update("UPDATE series SET status = 'ACTIVE' WHERE id = ?", seriesId);
        mockMvc.perform(post("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", otherToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", otherToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/me/series/" + seriesId + "/subscribe").header("satoken", otherToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/me/series/" + seriesId + "/subscribe"))
                .andExpect(status().isUnauthorized());
    }

    // ---- helpers ----

    private boolean hasSubscribed() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/series/" + seriesId).header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        var node = body.path("hasSubscribed");
        assertNotNull(node, "登录视图必须回报 hasSubscribed");
        return node.asBoolean();
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
        // 公开系列详情 requirePublicProfile 依赖 community_profile
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + (System.nanoTime() % 1_000_000_000L));
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
        return List.of(userId, login.getResponse().getHeader("satoken"));
    }

    private String seedSeries(String ownerId) throws Exception {
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO series (id, owner_id, space_id, title, slug, status, lock_version, created_at, updated_at)
                VALUES (?, ?, ?, '订阅闭环回归系列', ?, 'ACTIVE', 0, NOW(), NOW())
                """, id, ownerId, spaceId, "sebsub-" + (System.nanoTime() % 100000000L));
        seriesIds.add(id);
        return id;
    }
}

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 话题关注闭环回归（2026-10-10 P0-A）。
 *
 * <p>背景：SocialService.followTopic 硬编码 {@code status == "ENABLED"}，而 TopicService
 * 的唯一可信状态机是 ACTIVE（topic 表实际只写 ACTIVE，ENABLED 在 update 中被归一），
 * 导致所有正常话题的关注请求 404。修复后 followTopic 复用 TopicService.requireEnabledById。
 * 本测试钉死关注/取消/幂等/未登录/无效/禁用/刷新状态全链路，防止回退。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TopicFollowIntegrationTest {

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
    private final List<String> topicIds = new ArrayList<>();

    private String token;
    private String activeTopicId;
    private String activeTopicSlug;
    private String disabledTopicId;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = seedCommunityUser();
        activeTopicSlug = "tf-active-" + (System.nanoTime() % 100000000L);
        activeTopicId = seedTopic("ACTIVE");
        disabledTopicId = seedTopic("DISABLED");
    }

    @AfterAll
    void tearDown() {
        for (String topicId : topicIds) {
            jdbcTemplate.update("DELETE FROM topic_follow WHERE topic_id = ?", topicId);
            jdbcTemplate.update("DELETE FROM topic WHERE id = ?", topicId);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM topic_follow WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        topicIds.clear();
    }

    // ---- 验收矩阵 ----

    @Test
    @Order(1)
    void followActiveTopicSucceedsAndPersists() throws Exception {
        mockMvc.perform(post("/api/v1/follows/topics/" + activeTopicId).header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals(1, followCount(), "关注后 topic_follow 必须有且只有一行");
    }

    @Test
    @Order(2)
    void repeatedFollowIsIdempotent() throws Exception {
        mockMvc.perform(post("/api/v1/follows/topics/" + activeTopicId).header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals(1, followCount(), "重复关注不得产生第二行（幂等）");
    }

    @Test
    @Order(3)
    void refreshedTopicViewReportsFollowing() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/topics/" + activeTopicSlug)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        // /topics/{slug} 为裸 JSON（无 envelope）
        assertEquals(true, body.path("following").asBoolean(false),
                "刷新后话题详情必须回报 following=true, body=" + body);
    }

    @Test
    @Order(4)
    void unfollowRemovesRowAndRepeatedUnfollowIsIdempotent() throws Exception {
        mockMvc.perform(delete("/api/v1/follows/topics/" + activeTopicId).header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals(0, followCount(), "取消关注后必须无行");

        mockMvc.perform(delete("/api/v1/follows/topics/" + activeTopicId).header("satoken", token))
                .andExpect(status().isNoContent());
        assertEquals(0, followCount(), "重复取消关注必须幂等且无行");
    }

    @Test
    @Order(5)
    void unauthenticatedFollowIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/follows/topics/" + activeTopicId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(6)
    void nonexistentTopicIsNotFound() throws Exception {
        mockMvc.perform(post("/api/v1/follows/topics/tf-no-such-topic")
                        .header("satoken", token))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(7)
    void disabledTopicIsNotFound() throws Exception {
        mockMvc.perform(post("/api/v1/follows/topics/" + disabledTopicId)
                        .header("satoken", token))
                .andExpect(status().isNotFound());
    }

    // ---- helpers ----

    private int followCount() {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM topic_follow WHERE user_id = ? AND topic_id = ?",
                Integer.class, userIds.get(0), activeTopicId);
        return n == null ? 0 : n;
    }

    private String seedTopic(String status) {
        String id = UUID.randomUUID().toString();
        String suffix = String.valueOf(System.nanoTime() % 100000000L);
        String slug = "ACTIVE".equals(status) ? activeTopicSlug : "tf-disabled-" + suffix;
        jdbcTemplate.update("""
                INSERT INTO topic (id, seed_key, slug, name, status)
                VALUES (?, ?, ?, ?, ?)
                """, id, "tf-seed-" + suffix, slug, "话题关注回归-" + status, status);
        topicIds.add(id);
        return id;
    }

    private String seedCommunityUser() throws Exception {
        String email = "topicfollow" + System.nanoTime() + "@example.com";
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
                "tf-space-" + (System.nanoTime() % 100000000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }
}

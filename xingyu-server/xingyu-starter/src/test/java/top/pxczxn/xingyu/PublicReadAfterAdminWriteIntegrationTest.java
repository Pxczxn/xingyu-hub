package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
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
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端归档、停用和合并之后，社区公开读要跟着变。
 * 数据都由本类创建，结束时只删这些行。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublicReadAfterAdminWriteIntegrationTest {

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

    private final List<String> eventIds = new ArrayList<>();
    private final List<String> topicIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();
    private final List<String> spaceIds = new ArrayList<>();
    private final List<String> userIds = new ArrayList<>();

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

    @AfterEach
    void deleteOwnRows() {
        if (!topicIds.isEmpty()) {
            String topics = placeholders(topicIds.size());
            jdbcTemplate.update("DELETE FROM article_topic WHERE topic_id IN (" + topics + ")", topicIds.toArray());
            jdbcTemplate.update("DELETE FROM topic_follow WHERE topic_id IN (" + topics + ")", topicIds.toArray());
            jdbcTemplate.update(
                    "DELETE FROM topic_merge_record WHERE source_topic_id IN (" + topics + ") OR target_topic_id IN (" + topics + ")",
                    concat(topicIds, topicIds));
            jdbcTemplate.update("DELETE FROM topic_alias WHERE topic_id IN (" + topics + ")", topicIds.toArray());
            jdbcTemplate.update("DELETE FROM topic WHERE id IN (" + topics + ")", topicIds.toArray());
        }
        if (!articleIds.isEmpty()) {
            jdbcTemplate.update("DELETE FROM article WHERE id IN (" + placeholders(articleIds.size()) + ")", articleIds.toArray());
        }
        if (!spaceIds.isEmpty()) {
            jdbcTemplate.update(
                    "DELETE FROM community_creation_space WHERE id IN (" + placeholders(spaceIds.size()) + ")",
                    spaceIds.toArray());
        }
        if (!userIds.isEmpty()) {
            jdbcTemplate.update(
                    "DELETE FROM community_user WHERE id IN (" + placeholders(userIds.size()) + ")",
                    userIds.toArray());
        }
        if (!eventIds.isEmpty()) {
            jdbcTemplate.update(
                    "DELETE FROM community_event WHERE id IN (" + placeholders(eventIds.size()) + ")",
                    eventIds.toArray());
        }
    }

    @Test
    @DisplayName("归档后公开列表和详情不再返回该活动，其他活动仍在")
    void archivingRemovesOnlyThatEventFromPublicRead() throws Exception {
        String token = adminToken();
        String keepId = createEvent(token, "e37c-keep-" + System.nanoTime(), "2037-06-02T00:00:00Z");
        String archivedId = createEvent(token, "e37c-gone-" + System.nanoTime(), "2037-06-01T00:00:00Z");

        String before = publicEvents();
        assertTrue(before.contains(keepId));
        assertTrue(before.contains(archivedId));
        mockMvc.perform(get("/api/v1/events/" + archivedId)).andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/admin/community/events/" + archivedId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));

        String after = publicEvents();
        assertTrue(after.contains(keepId));
        assertFalse(after.contains(archivedId));
        mockMvc.perform(get("/api/v1/events/" + archivedId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/v1/events/" + keepId)).andExpect(status().isOk());

        String adminList = mockMvc.perform(get("/api/v1/admin/community/events").param("limit", "50")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(adminList.contains(archivedId));
        assertTrue(adminList.contains("ARCHIVED"));
    }

    @Test
    @DisplayName("停用话题后公开列表和详情不再把它当成可用话题")
    void disablingTopicHidesItWithoutTouchingTheArticle() throws Exception {
        String token = adminToken();
        String disabledSlug = "p37c-off-" + System.nanoTime();
        String otherSlug = "p37c-on-" + System.nanoTime();
        String disabledId = createTopic(token, disabledSlug, "停用探针");
        String otherId = createTopic(token, otherSlug, "仍可用探针");
        String articleId = insertArticle();
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, UTC_TIMESTAMP())",
                articleId, disabledId);

        assertTrue(publicTopics(disabledSlug).contains(disabledId));
        mockMvc.perform(get("/api/v1/topics/" + disabledSlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(disabledId));

        mockMvc.perform(patch("/api/v1/admin/topics/" + disabledId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        assertFalse(publicTopics(disabledSlug).contains(disabledId));
        assertTrue(publicTopics(otherSlug).contains(otherId));
        mockMvc.perform(get("/api/v1/topics/" + disabledSlug))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/v1/topics/" + otherSlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(otherId));

        String admin = mockMvc.perform(get("/api/v1/admin/topics")
                        .param("keyword", disabledSlug)
                        .param("status", "DISABLED")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(admin.contains(disabledId));
        assertEquals("PUBLISHED", articleColumn(articleId, "status"));
        assertEquals("ACTIVE", articleColumn(articleId, "lifecycle_status"));
        assertEquals("NORMAL", articleColumn(articleId, "moderation_status"));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM article_topic WHERE article_id = ? AND topic_id = ?",
                articleId, disabledId));
    }

    @Test
    @DisplayName("合并后源话题不再公开，文章关联转到目标话题")
    void mergingTopicMovesLinksAndStopsPublicSource() throws Exception {
        String token = adminToken();
        String sourceSlug = "p37c-src-" + System.nanoTime();
        String targetSlug = "p37c-dst-" + System.nanoTime();
        String sourceId = createTopic(token, sourceSlug, "源话题");
        String targetId = createTopic(token, targetSlug, "目标话题");
        String sourceArticle = insertArticle();
        String targetArticle = insertArticle();
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, UTC_TIMESTAMP())",
                sourceArticle, sourceId);
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, UTC_TIMESTAMP())",
                targetArticle, targetId);
        String keptFollower = UUID.randomUUID().toString();
        String movedFollower = UUID.randomUUID().toString();
        jdbcTemplate.update(
                "INSERT INTO topic_follow (id, user_id, topic_id, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
                UUID.randomUUID().toString(), keptFollower, targetId);
        jdbcTemplate.update(
                "INSERT INTO topic_follow (id, user_id, topic_id, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
                UUID.randomUUID().toString(), movedFollower, sourceId);

        mockMvc.perform(post("/api/v1/admin/topics/" + sourceId + "/merge")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetTopicId\":\"" + targetId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.sourceTopicId").value(sourceId))
                .andExpect(jsonPath("$.data.targetTopicId").value(targetId));

        assertFalse(publicTopics(sourceSlug).contains(sourceId));
        assertTrue(publicTopics(targetSlug).contains(targetId));
        mockMvc.perform(get("/api/v1/topics/" + sourceSlug))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/v1/topics/" + targetSlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(targetId))
                .andExpect(jsonPath("$.slug").value(targetSlug));

        assertEquals(0, count(
                "SELECT COUNT(*) FROM article_topic WHERE article_id = ? AND topic_id = ?",
                sourceArticle, sourceId));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM article_topic WHERE article_id = ? AND topic_id = ?",
                sourceArticle, targetId));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM article_topic WHERE article_id = ? AND topic_id = ?",
                targetArticle, targetId));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM topic_follow WHERE user_id = ? AND topic_id = ?",
                keptFollower, targetId));
        assertEquals(1, count(
                "SELECT COUNT(*) FROM topic_follow WHERE user_id = ? AND topic_id = ?",
                movedFollower, targetId));
        assertEquals(0, count(
                "SELECT COUNT(*) FROM topic_follow WHERE topic_id = ?",
                sourceId));
        assertEquals("MERGED", jdbcTemplate.queryForObject(
                "SELECT status FROM topic WHERE id = ?", String.class, sourceId));
        assertEquals("PUBLISHED", articleColumn(sourceArticle, "status"));
        assertEquals("PUBLISHED", articleColumn(targetArticle, "status"));
        assertEquals(0, count("SELECT COUNT(*) FROM topic_alias WHERE alias_slug = ?", sourceSlug));
    }

    private String publicEvents() throws Exception {
        return mockMvc.perform(get("/api/v1/events").param("limit", "5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private String publicTopics(String keyword) throws Exception {
        return mockMvc.perform(get("/api/v1/topics").param("keyword", keyword))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private String createEvent(String token, String slug, String startsAt) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/community/events")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"公开读探针","slug":"%s","body":"正文","status":"ACTIVE","startsAt":"%s"}
                                """.formatted(slug, startsAt)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String id = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asText();
        eventIds.add(id);
        return id;
    }

    private String createTopic(String token, String slug, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/topics")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","name":"%s","seedKey":"%s"}
                                """.formatted(slug, name, slug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        String id = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asText();
        topicIds.add(id);
        return id;
    }

    private String insertArticle() {
        String userId = UUID.randomUUID().toString();
        String spaceId = UUID.randomUUID().toString();
        String articleId = UUID.randomUUID().toString();
        userIds.add(userId);
        spaceIds.add(spaceId);
        articleIds.add(articleId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, status, role, terms_version, created_at)
                VALUES (?, ?, 'hash', 'ACTIVE', 'user', '1.0', UTC_TIMESTAMP())
                """, userId, userId + "@example.com");
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, created_at)
                VALUES (?, ?, ?, UTC_TIMESTAMP())
                """, spaceId, userId, spaceId.replace("-", ""));
        jdbcTemplate.update("""
                INSERT INTO article
                    (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, 'PUBLISHED', 'ACTIVE', 'NORMAL', UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, articleId, userId, spaceId);
        return articleId;
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

    private String articleColumn(String articleId, String column) {
        return jdbcTemplate.queryForObject(
                "SELECT " + column + " FROM article WHERE id = ?", String.class, articleId);
    }

    private int count(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    private static String placeholders(int size) {
        return String.join(",", java.util.Collections.nCopies(size, "?"));
    }

    private static Object[] concat(List<String> left, List<String> right) {
        Object[] values = new Object[left.size() + right.size()];
        int index = 0;
        for (String value : left) {
            values[index++] = value;
        }
        for (String value : right) {
            values[index++] = value;
        }
        return values;
    }
}

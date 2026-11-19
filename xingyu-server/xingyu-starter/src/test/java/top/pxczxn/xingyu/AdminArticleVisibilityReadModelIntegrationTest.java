package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
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
 * 文章运营读模型与匿名详情条件一致，并且不重新打开状态写入。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminArticleVisibilityReadModelIntegrationTest {

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

    private final List<String> articleIds = new ArrayList<>();

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
    void deleteFixtures() {
        if (articleIds.isEmpty()) {
            return;
        }
        String articles = String.join(",", articleIds.stream().map(id -> "?").toList());
        jdbcTemplate.update("DELETE FROM published_revision WHERE article_id IN (" + articles + ")", articleIds.toArray());
        jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (" + articles + ")", articleIds.toArray());
        jdbcTemplate.update("DELETE FROM working_draft WHERE article_id IN (" + articles + ")", articleIds.toArray());
        jdbcTemplate.update("DELETE FROM article WHERE id IN (" + articles + ")", articleIds.toArray());
        articleIds.clear();
    }

    @Test
    @DisplayName("列表和详情按独立维度展示匿名可读性")
    void listAndDetailExposeIndependentVisibility() throws Exception {
        String token = adminToken();
        String ownerId = registerOwner("p33art");

        String publicId = seed(ownerId, "p33-public", "PUBLISHED", "ACTIVE", "NORMAL", "PUBLIC");
        assertReadable(token, publicId, "p33-public", "PUBLISHED", "ACTIVE", "NORMAL", "PUBLIC", true);

        String hiddenId = seed(ownerId, "p33-hidden", "PUBLISHED", "ACTIVE", "HIDDEN", "PUBLIC");
        assertReadable(token, hiddenId, "p33-hidden", "PUBLISHED", "ACTIVE", "HIDDEN", "PUBLIC", false);

        String trashedId = seed(ownerId, "p33-trashed", "PUBLISHED", "TRASHED", "NORMAL", "PUBLIC");
        assertReadable(token, trashedId, "p33-trashed", "PUBLISHED", "TRASHED", "NORMAL", "PUBLIC", false);

        String privateId = seed(ownerId, "p33-private", "PUBLISHED", "ACTIVE", "NORMAL", "PRIVATE");
        assertReadable(token, privateId, "p33-private", "PUBLISHED", "ACTIVE", "NORMAL", "PRIVATE", false);

        String unlistedId = seed(ownerId, "p33-unlisted", "PUBLISHED", "ACTIVE", "NORMAL", "UNLISTED");
        assertReadable(token, unlistedId, "p33-unlisted", "PUBLISHED", "ACTIVE", "NORMAL", "UNLISTED", true);

        String reviewId = seed(ownerId, "p33-review", "IN_REVIEW", "ACTIVE", "NORMAL", "PUBLIC");
        assertReadable(token, reviewId, "p33-review", "IN_REVIEW", "ACTIVE", "NORMAL", "PUBLIC", true);

        String frozenId = seed(ownerId, "p33-frozen", "PUBLISHED", "ACTIVE", "FROZEN", "PUBLIC");
        assertReadable(token, frozenId, "p33-frozen", "PUBLISHED", "ACTIVE", "FROZEN", "PUBLIC", true);

        String draftId = seedWithoutPublication(ownerId, "p33-draft", "DRAFT", "ACTIVE", "NORMAL");
        assertReadable(token, draftId, "p33-draft", "DRAFT", "ACTIVE", "NORMAL", null, false);

        String firstReviewId = seedWithoutPublication(ownerId, "p33-first-review", "IN_REVIEW", "ACTIVE", "NORMAL");
        assertReadable(token, firstReviewId, "p33-first-review", "IN_REVIEW", "ACTIVE", "NORMAL", null, false);

        String unknownId = seed(ownerId, "p33-unknown", "PUBLISHED", "ACTIVE", "NORMAL", "CUSTOM");
        assertReadable(token, unknownId, "p33-unknown", "PUBLISHED", "ACTIVE", "NORMAL", "CUSTOM", false);
    }

    @Test
    @DisplayName("文章运营状态写入仍然关闭")
    void articleStatusWriteStaysClosed() throws Exception {
        String token = adminToken();
        String ownerId = registerOwner("p33write");
        String articleId = seedWithoutPublication(ownerId, "不能改状态", "DRAFT", "ACTIVE", "NORMAL");

        mockMvc.perform(patch("/api/v1/admin/operations/content/" + articleId + "/status")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"ARTICLE\",\"status\":\"PUBLISHED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(422))
                .andExpect(jsonPath("$.message").value("内容类型或状态无效"));

        assertEquals("DRAFT", jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId));
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM published_revision WHERE article_id = ?", Integer.class, articleId));
    }

    private void assertReadable(String token, String articleId, String title, String editorial, String lifecycle,
                                String moderation, String visibility, boolean anonymous) throws Exception {
        JsonNode detail = detail(token, articleId);
        assertEquals(title, detail.path("title").asText());
        JsonNode listed = listItem(token, title, articleId);
        for (JsonNode node : List.of(detail, listed)) {
            assertEquals("ARTICLE", node.path("type").asText());
            assertEquals(editorial, node.path("status").asText());
            assertEquals(lifecycle, node.path("lifecycleStatus").asText());
            assertEquals(moderation, node.path("moderationStatus").asText());
            assertEquals(visibility != null, node.path("hasPublishedRevision").asBoolean());
            if (visibility == null) {
                assertTrue(node.path("visibility").isNull());
            } else {
                assertEquals(visibility, node.path("visibility").asText());
            }
            assertEquals(anonymous, node.path("anonymousReadable").asBoolean());
        }
    }

    private JsonNode listItem(String token, String title, String articleId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/operations/content")
                        .header("satoken", token)
                        .param("type", "ARTICLE")
                        .param("keyword", title)
                        .param("pageSize", "20"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode records = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("records");
        for (JsonNode record : records) {
            if (articleId.equals(record.path("id").asText())) {
                return record;
            }
        }
        throw new AssertionError("列表里没有文章 " + articleId + " title=" + title
                + " body=" + result.getResponse().getContentAsString());
    }

    private JsonNode detail(String token, String articleId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/operations/content/" + articleId)
                        .header("satoken", token)
                        .param("type", "ARTICLE"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String seed(String ownerId, String title, String editorial, String lifecycle,
                        String moderation, String visibility) {
        String articleId = seedWithoutPublication(ownerId, title, editorial, lifecycle, moderation);
        String revisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, summary, body_mode, body, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, ?, '摘要', 'MARKDOWN', '正文', ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, revisionId, articleId, title, visibility);
        jdbcTemplate.update("""
                INSERT INTO published_revision (id, article_id, formal_revision_id, published_at, publication_event_id)
                VALUES (?, ?, ?, UTC_TIMESTAMP(), ?)
                """, UUID.randomUUID().toString(), articleId, revisionId, UUID.randomUUID().toString());
        return articleId;
    }

    private String seedWithoutPublication(String ownerId, String title, String editorial,
                                          String lifecycle, String moderation) {
        String articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                SELECT ?, ?, cs.id, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP()
                FROM community_creation_space cs WHERE cs.user_id = ?
                """, articleId, ownerId, editorial, lifecycle, moderation, ownerId);
        jdbcTemplate.update("""
                INSERT INTO working_draft
                    (id, article_id, title, summary, body_mode, body, visibility, lock_version, created_at, updated_at)
                VALUES (?, ?, ?, '摘要', 'MARKDOWN', '草稿正文', 'PRIVATE', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, UUID.randomUUID().toString(), articleId, title);
        articleIds.add(articleId);
        return articleId;
    }

    private String registerOwner(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
        String email = username + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk());
        return jdbcTemplate.queryForObject("SELECT id FROM community_user WHERE email = ?", String.class, email);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
        assertFalse(token.isBlank());
        return token;
    }
}

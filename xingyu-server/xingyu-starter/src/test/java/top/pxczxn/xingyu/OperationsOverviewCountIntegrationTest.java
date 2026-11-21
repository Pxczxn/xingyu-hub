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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 总览计数按业务对象分开。共享测试库只比较插入前后的差值，结束时删掉本测试插入的行。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OperationsOverviewCountIntegrationTest {

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
    private final List<String> reportIds = new ArrayList<>();

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.requireIsolatedTargets(
                configGroupService, jdbcTemplate, dataSource, redisConnectionFactory);
    }

    @AfterEach
    void deleteFixtures() {
        if (!reportIds.isEmpty()) {
            String reports = String.join(",", reportIds.stream().map(id -> "?").toList());
            jdbcTemplate.update("DELETE FROM moderation_case WHERE report_id IN (" + reports + ")", reportIds.toArray());
            jdbcTemplate.update("DELETE FROM report WHERE id IN (" + reports + ")", reportIds.toArray());
            reportIds.clear();
        }
        if (!articleIds.isEmpty()) {
            String articles = String.join(",", articleIds.stream().map(id -> "?").toList());
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id IN (" + articles + ")", articleIds.toArray());
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (" + articles + ")", articleIds.toArray());
            jdbcTemplate.update("DELETE FROM article WHERE id IN (" + articles + ")", articleIds.toArray());
            articleIds.clear();
        }
    }

    @Test
    @DisplayName("公开文章按匿名详情可读条件计数，草稿、待审、隐藏和回收不计入")
    void publishedCountFollowsAnonymousReadableArticles() throws Exception {
        String token = adminToken();
        JsonNode before = overview(token);
        String ownerId = registerOwner("p32art");

        seedReadable(ownerId, "PUBLISHED", "ACTIVE", "NORMAL", "PUBLIC");
        JsonNode published = overview(token);
        assertEquals(before.path("publishedArticleCount").asLong() + 1, published.path("publishedArticleCount").asLong());
        assertEquals(before.path("pendingReviewCount").asLong(), published.path("pendingReviewCount").asLong());
        assertEquals(before.path("activeEventCount").asLong(), published.path("activeEventCount").asLong());
        assertEquals(before.path("openCaseCount").asLong(), published.path("openCaseCount").asLong());
        assertEquals(before.path("openReportCount").asLong(), published.path("openReportCount").asLong());
        assertTrue(published.path("activeContentCount").isNull());

        seedReadable(ownerId, "IN_REVIEW", "ACTIVE", "NORMAL", "PUBLIC");
        assertEquals(published.path("publishedArticleCount").asLong() + 1,
                overview(token).path("publishedArticleCount").asLong(), "已有公开版本的待审修订仍可读");

        long readable = overview(token).path("publishedArticleCount").asLong();
        seedReadable(ownerId, "PUBLISHED", "ACTIVE", "NORMAL", "UNLISTED");
        seedReadable(ownerId, "PUBLISHED", "ACTIVE", "FROZEN", "PUBLIC");
        assertEquals(readable + 2, overview(token).path("publishedArticleCount").asLong());

        long unchanged = overview(token).path("publishedArticleCount").asLong();
        seedReadable(ownerId, "PUBLISHED", "ACTIVE", "NORMAL", "PRIVATE");
        seedReadable(ownerId, "PUBLISHED", "ACTIVE", "HIDDEN", "PUBLIC");
        seedReadable(ownerId, "PUBLISHED", "TRASHED", "NORMAL", "PUBLIC");
        seedArticleOnly(ownerId, "DRAFT", "ACTIVE", "NORMAL");
        seedArticleOnly(ownerId, "IN_REVIEW", "ACTIVE", "NORMAL");
        seedArticleOnly(ownerId, "PUBLISHED", "ACTIVE", "NORMAL");
        JsonNode after = overview(token);
        assertEquals(unchanged, after.path("publishedArticleCount").asLong());
        assertEquals(before.path("pendingReviewCount").asLong(), after.path("pendingReviewCount").asLong());
        assertEquals(before.path("activeEventCount").asLong(), after.path("activeEventCount").asLong());
        assertTrue(after.path("activeContentCount").isNull());
    }

    @Test
    @DisplayName("未结举报和未结案件分开计数")
    void openReportsAreNotOpenCases() throws Exception {
        String token = adminToken();
        JsonNode before = overview(token);
        String reporterId = registerOwner("p32rpt");

        seedReport(reporterId, "SUBMITTED", "OPEN");
        JsonNode bothOpen = overview(token);
        assertEquals(before.path("openReportCount").asLong() + 1, bothOpen.path("openReportCount").asLong());
        assertEquals(before.path("openCaseCount").asLong() + 1, bothOpen.path("openCaseCount").asLong());

        seedReport(reporterId, "TRIAGED", "CLOSED");
        JsonNode reportOnly = overview(token);
        assertEquals(bothOpen.path("openReportCount").asLong() + 1, reportOnly.path("openReportCount").asLong());
        assertEquals(bothOpen.path("openCaseCount").asLong(), reportOnly.path("openCaseCount").asLong());

        seedReport(reporterId, "CLOSED", "OPEN");
        JsonNode caseOnly = overview(token);
        assertEquals(reportOnly.path("openReportCount").asLong(), caseOnly.path("openReportCount").asLong());
        assertEquals(reportOnly.path("openCaseCount").asLong() + 1, caseOnly.path("openCaseCount").asLong());
        assertEquals(before.path("pendingReviewCount").asLong(), caseOnly.path("pendingReviewCount").asLong());
        assertEquals(before.path("activeEventCount").asLong(), caseOnly.path("activeEventCount").asLong());
        assertEquals(before.path("publishedArticleCount").asLong(), caseOnly.path("publishedArticleCount").asLong());
        assertTrue(caseOnly.path("activeContentCount").isNull());
    }

    private void seedReadable(String ownerId, String editorial, String lifecycle, String moderation, String visibility) {
        String articleId = seedArticleOnly(ownerId, editorial, lifecycle, moderation);
        String revisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, summary, body_mode, body, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, '总览探针', '摘要', 'MARKDOWN', '正文', ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, revisionId, articleId, visibility);
        jdbcTemplate.update("""
                INSERT INTO published_revision (id, article_id, formal_revision_id, published_at, publication_event_id)
                VALUES (?, ?, ?, UTC_TIMESTAMP(), ?)
                """, UUID.randomUUID().toString(), articleId, revisionId, UUID.randomUUID().toString());
    }

    private String seedArticleOnly(String ownerId, String editorial, String lifecycle, String moderation) {
        String articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                SELECT ?, ?, cs.id, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP()
                FROM community_creation_space cs WHERE cs.user_id = ?
                """, articleId, ownerId, editorial, lifecycle, moderation, ownerId);
        articleIds.add(articleId);
        return articleId;
    }

    private void seedReport(String reporterId, String reportStatus, String caseStatus) {
        String reportId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO report (id, reporter_id, object_type, object_id, reason, status, created_at)
                VALUES (?, ?, 'MOMENT', ?, '总览探针', ?, UTC_TIMESTAMP())
                """, reportId, reporterId, UUID.randomUUID().toString(), reportStatus);
        jdbcTemplate.update("""
                INSERT INTO moderation_case (id, report_id, status, created_at, updated_at)
                VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, UUID.randomUUID().toString(), reportId, caseStatus);
        reportIds.add(reportId);
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

    private JsonNode overview(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/operations/overview").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText();
        assertFalse(token.isBlank());
        return token;
    }
}

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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminContentAssetListIntegrationTest {

    private static final String MARKER = "a542-";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> seriesIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();
    private final List<String> momentIds = new ArrayList<>();
    private String ownerId;
    private String spaceId;
    private String token;

    @BeforeEach
    void seed() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = adminToken();
        ownerId = registerOwner("a542own");
        spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
    }

    @AfterEach
    void cleanup() {
        if (!seriesIds.isEmpty()) {
            String in = placeholders(seriesIds.size());
            jdbcTemplate.update("DELETE FROM series_chapter WHERE series_id IN (" + in + ")", seriesIds.toArray());
            jdbcTemplate.update("DELETE FROM series WHERE id IN (" + in + ")", seriesIds.toArray());
        }
        if (!articleIds.isEmpty()) {
            String in = placeholders(articleIds.size());
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id IN (" + in + ")", articleIds.toArray());
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id IN (" + in + ")", articleIds.toArray());
            jdbcTemplate.update("DELETE FROM working_draft WHERE article_id IN (" + in + ")", articleIds.toArray());
            jdbcTemplate.update("DELETE FROM article WHERE id IN (" + in + ")", articleIds.toArray());
        }
        if (!momentIds.isEmpty()) {
            String in = placeholders(momentIds.size());
            jdbcTemplate.update("DELETE FROM moment_revision WHERE moment_id IN (" + in + ")", momentIds.toArray());
            jdbcTemplate.update("DELETE FROM moment WHERE id IN (" + in + ")", momentIds.toArray());
        }
        seriesIds.clear();
        articleIds.clear();
        momentIds.clear();
    }

    @Test
    void seriesPagesAreDatabaseSlicesWithStableTotals() throws Exception {
        for (int index = 0; index < 5; index++) {
            insertSeries(MARKER + "s" + index, "ACTIVE", index == 0 ? 2 : 0);
        }
        insertSeries(MARKER + "archived", "ARCHIVED", 1);

        JsonNode first = list("SERIES", MARKER, null, 1, 2);
        JsonNode second = list("SERIES", MARKER, null, 2, 2);
        JsonNode last = list("SERIES", MARKER, null, 3, 2);
        assertEquals(6, first.path("total").asInt());
        assertEquals(6, second.path("total").asInt());
        assertEquals(2, first.path("records").size());
        assertEquals(2, second.path("records").size());
        assertEquals(2, last.path("records").size());
        assertEquals(first.path("records").get(0).path("id").asText(),
                list("SERIES", MARKER, null, 1, 5).path("records").get(0).path("id").asText());
        int chapterHits = 0;
        for (JsonNode record : list("SERIES", MARKER, null, 1, 20).path("records")) {
            if (record.path("chapterCount").asInt() == 2) {
                chapterHits++;
            }
        }
        assertEquals(1, chapterHits);
        JsonNode archivedOnly = list("SERIES", MARKER, "ARCHIVED", 1, 20);
        assertEquals(1, archivedOnly.path("total").asInt());
        JsonNode empty = list("SERIES", "no-such-a542-keyword", null, 1, 20);
        assertEquals(0, empty.path("total").asInt());
        assertEquals(0, empty.path("records").size());
        for (JsonNode record : first.path("records")) {
            assertFalse(record.has("body"));
        }
    }

    @Test
    void articleListOmitsBodyAndKeepsDetailBodyAndMissingRelations() throws Exception {
        String titled = insertArticle("a542-draft-title", true, false);
        String noDraft = insertArticleWithoutDraft();
        JsonNode listed = list("ARTICLE", "a542-draft-title", null, 1, 20);
        assertEquals(1, listed.path("total").asInt());
        JsonNode row = listed.path("records").get(0);
        assertEquals(titled, row.path("id").asText());
        assertFalse(row.has("body"));
        assertEquals("a542-draft-title", row.path("title").asText());
        assertEquals(false, row.path("hasPublishedRevision").asBoolean());

        JsonNode detail = objectMapper.readTree(mockMvc.perform(get("/api/v1/admin/operations/content/" + titled)
                        .header("satoken", token)
                        .param("type", "ARTICLE"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()).path("data");
        assertEquals("draft-body", detail.path("body").asText());

        JsonNode orphan = objectMapper.readTree(mockMvc.perform(get("/api/v1/admin/operations/content/" + noDraft)
                        .header("satoken", token)
                        .param("type", "ARTICLE"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()).path("data");
        assertTrue(orphan.path("title").isNull() || orphan.path("title").asText().isEmpty());
        assertFalse(orphan.has("body") && !orphan.path("body").isNull() && !orphan.path("body").asText().isEmpty());
    }

    @Test
    void momentKeywordDoesNotDuplicateAndListOmitsBody() throws Exception {
        String momentId = insertMoment("visible-body-keyword-xyz");
        JsonNode listed = list("MOMENT", "keyword-xyz", "PUBLISHED", 1, 20);
        int hits = 0;
        for (JsonNode record : listed.path("records")) {
            if (momentId.equals(record.path("id").asText())) {
                hits++;
                assertFalse(record.has("body"));
                assertTrue(record.path("title").asText().contains("visible-body"));
            }
        }
        assertEquals(1, hits);
        JsonNode detail = objectMapper.readTree(mockMvc.perform(get("/api/v1/admin/operations/content/" + momentId)
                        .header("satoken", token)
                        .param("type", "MOMENT"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString()).path("data");
        assertEquals("visible-body-keyword-xyz", detail.path("body").asText());
    }

    private JsonNode list(String type, String keyword, String status, int page, int pageSize) throws Exception {
        var request = get("/api/v1/admin/operations/content")
                .header("satoken", token)
                .param("type", type)
                .param("page", String.valueOf(page))
                .param("pageSize", String.valueOf(pageSize));
        if (keyword != null) {
            request.param("keyword", keyword);
        }
        if (status != null) {
            request.param("status", status);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
    }

    private void insertSeries(String title, String status, int chapters) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO series (id, owner_id, space_id, title, slug, description, status, lock_version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, id, ownerId, spaceId, title, id.substring(0, 8), title, status);
        for (int index = 0; index < chapters; index++) {
            jdbcTemplate.update("""
                    INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
                    VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
                    """, UUID.randomUUID().toString(), id, UUID.randomUUID().toString(), index + 1);
        }
        seriesIds.add(id);
    }

    private String insertArticle(String title, boolean withDraft, boolean published) {
        String articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, 'DRAFT', 'ACTIVE', 'NORMAL', UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, articleId, ownerId, spaceId);
        if (withDraft) {
            jdbcTemplate.update("""
                    INSERT INTO working_draft
                        (id, article_id, title, summary, body_mode, body, visibility, lock_version, created_at, updated_at)
                    VALUES (?, ?, ?, 'summary', 'MARKDOWN', 'draft-body', 'PRIVATE', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                    """, UUID.randomUUID().toString(), articleId, title);
        }
        articleIds.add(articleId);
        return articleId;
    }

    private String insertArticleWithoutDraft() {
        return insertArticle("无草稿", false, false);
    }

    private String insertMoment(String body) {
        String momentId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO moment (id, author_id, status, created_at, updated_at)
                VALUES (?, ?, 'PUBLISHED', UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, momentId, ownerId);
        jdbcTemplate.update("""
                INSERT INTO moment_revision (id, moment_id, body, revision_number, created_at)
                VALUES (?, ?, ?, 1, UTC_TIMESTAMP())
                """, UUID.randomUUID().toString(), momentId, body);
        jdbcTemplate.update("""
                INSERT INTO moment_revision (id, moment_id, body, revision_number, created_at)
                VALUES (?, ?, ?, 2, UTC_TIMESTAMP())
                """, UUID.randomUUID().toString(), momentId, body);
        momentIds.add(momentId);
        return momentId;
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
        String tokenValue = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
        assertFalse(tokenValue.isBlank());
        return tokenValue;
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }
}

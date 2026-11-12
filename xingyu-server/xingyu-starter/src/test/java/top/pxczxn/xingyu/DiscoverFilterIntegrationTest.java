package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DiscoverFilterIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired SysConfigGroupService configGroupService;

    @BeforeEach
    void openRegistration() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void topicAndTypeAreAppliedBeforePagingAndHiddenContentIsExcluded() throws Exception {
        String topicId = UUID.randomUUID().toString();
        String slug = "filter-" + topicId;
        jdbc.update("INSERT INTO topic (id, seed_key, slug, name, status) VALUES (?, ?, ?, '筛选测试', 'ACTIVE')", topicId, slug, slug);
        String ownerId = UUID.randomUUID().toString();
        String spaceId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO community_creation_space (id, user_id, slug, created_at) VALUES (?, ?, ?, NOW())",
                spaceId, ownerId, spaceId.replace("-", ""));
        List<String> ids = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            String id = UUID.randomUUID().toString();
            jdbc.update("""
                    INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                    VALUES (?, ?, ?, 'PUBLISHED', 'ACTIVE', 'NORMAL', NOW(), NOW())
                    """, id, ownerId, spaceId);
            jdbc.update("""
                    INSERT INTO search_document (id, object_type, object_id, title, discovery_version, indexed_at, removed_at)
                    VALUES (?, 'ARTICLE', ?, '筛选探针', 1, ?, ?)
                    """, UUID.randomUUID().toString(), id, Instant.parse("2026-10-15T00:00:00Z").plusSeconds(index),
                    index == 3 ? Instant.now() : null);
            // index 3 is hidden; index 4 belongs to no topic.
            if (index < 4) jdbc.update("INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, NOW())", id, topicId);
            if (index < 3) ids.add(id);
        }
        JsonNode first = fetch(slug, "ARTICLE", null);
        assertEquals(2, first.path("items").size());
        assertEquals(ids.get(2), first.path("items").get(0).path("id").asText());
        assertEquals(ids.get(1), first.path("items").get(1).path("id").asText());
        assertFalse(first.path("nextCursor").isNull());
        JsonNode second = fetch(slug, "ARTICLE", first.path("nextCursor").asText());
        assertEquals(1, second.path("items").size());
        assertEquals(ids.getFirst(), second.path("items").get(0).path("id").asText());
        assertTrue(second.path("nextCursor").isNull());
        assertEquals(0, fetch(slug, "SERIES", null).path("items").size());
        String disabledId = UUID.randomUUID().toString();
        String disabledSlug = "disabled-" + disabledId;
        jdbc.update("INSERT INTO topic (id, seed_key, slug, name, status) VALUES (?, ?, ?, '停用话题', 'DISABLED')",
                disabledId, disabledSlug, disabledSlug);
        mvc.perform(get("/api/v1/discover").param("topic", disabledSlug)).andExpect(status().isNotFound());
    }

    @Test
    void invalidTypeReturnsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/discover").param("type", "INVALID")).andExpect(status().isBadRequest());
    }

    @Test
    void featuredSortPagesLiveEditorialPicksAndRejectsHot() throws Exception {
        String removedId = insertIndexed("removed-pick");
        String archivedId = insertIndexed("archived-pick");
        String thirdId = insertIndexed("third-pick");
        String secondId = insertIndexed("second-pick");
        String firstId = insertIndexed("first-pick");
        insertFeatured(removedId, 0, "ACTIVE", Instant.now());
        jdbc.update("UPDATE search_document SET removed_at = NOW() WHERE object_id = ?", removedId);
        insertFeatured(archivedId, 0, "ARCHIVED", Instant.now());
        insertFeatured(thirdId, 2, "ACTIVE", Instant.now());
        insertFeatured(secondId, 1, "ACTIVE", Instant.now());
        insertFeatured(firstId, 0, "ACTIVE", Instant.now());

        List<String> ours = List.of(firstId, secondId, thirdId);
        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 30; page++) {
            JsonNode body = featuredPage(cursor);
            for (String id : idsOf(body)) {
                assertNotEquals(removedId, id);
                assertNotEquals(archivedId, id);
                if (ours.contains(id)) {
                    seen.add(id);
                }
            }
            if (body.path("nextCursor").isNull() || body.path("nextCursor").asText().isBlank()) {
                break;
            }
            cursor = body.path("nextCursor").asText();
        }
        assertEquals(ours, seen);

        mvc.perform(get("/api/v1/discover").param("sort", "hot")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/discover").param("sort", "latest").param("limit", "50"))
                .andExpect(status().isOk());
    }

    @Test
    void interestSortRequiresLoginAndReturnsOnlyTaggedArticles() throws Exception {
        mvc.perform(get("/api/v1/discover").param("sort", "interest")).andExpect(status().isUnauthorized());

        String email = "interest" + System.nanoTime() + "@example.com";
        String token = register(email);
        String userId = jdbc.queryForObject("SELECT id FROM community_user WHERE email = ?", String.class, email);
        String domainId = "01910000-0000-7000-8000-000000000001";
        String tagId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO content_tag (id, slug, name, normalized_name)
                VALUES (?, ?, '兴趣探针', 'interest-probe')
                """, tagId, "interest-" + tagId);
        jdbc.update("INSERT INTO domain_tag_relation (domain_id, tag_id) VALUES (?, ?)", domainId, tagId);
        jdbc.update("""
                INSERT INTO user_explore_domain (id, user_id, domain_id, sort_order, created_at)
                VALUES (?, ?, ?, 0, NOW())
                """, UUID.randomUUID().toString(), userId, domainId);

        String matched = insertIndexed("interest-match");
        String other = insertIndexed("interest-other");
        String hidden = insertIndexed("interest-hidden");
        jdbc.update("INSERT INTO article_tag (article_id, tag_id, source) VALUES (?, ?, 'AUTHOR')", matched, tagId);
        jdbc.update("INSERT INTO article_tag (article_id, tag_id, source) VALUES (?, ?, 'AUTHOR')", hidden, tagId);
        jdbc.update("UPDATE search_document SET removed_at = NOW() WHERE object_id = ?", hidden);

        JsonNode body = json.readTree(mvc.perform(get("/api/v1/discover")
                        .header("satoken", token)
                        .param("sort", "interest")
                        .param("limit", "50"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        List<String> ids = idsOf(body);
        assertTrue(ids.contains(matched));
        assertFalse(ids.contains(other));
        assertFalse(ids.contains(hidden));

        String emptyEmail = "empty" + System.nanoTime() + "@example.com";
        String emptyToken = register(emptyEmail);
        JsonNode empty = json.readTree(mvc.perform(get("/api/v1/discover")
                        .header("satoken", emptyToken)
                        .param("sort", "interest")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals(0, empty.path("items").size());
    }

    private String register(String email) throws Exception {
        String username = "i" + (System.nanoTime() % 1_000_000_000L);
        String password = "Test1234!@#ab";
        mvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    @Test
    void momentTypeIsAcceptedAndFiltered() throws Exception {
        String momentId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO search_document (id, object_type, object_id, title, discovery_version, indexed_at)
                VALUES (?, 'MOMENT', ?, '动态筛选探针', 1, NOW())
                """, UUID.randomUUID().toString(), momentId);
        var response = mvc.perform(get("/api/v1/discover").param("type", "MOMENT").param("limit", "50"))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        JsonNode items = json.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("items");
        assertTrue(items.size() > 0, "至少应返回刚插入的动态");
        boolean found = false;
        for (JsonNode item : items) {
            assertEquals("MOMENT", item.path("objectType").asText(), "type=MOMENT 不能混入其它类型");
            if (momentId.equals(item.path("id").asText())) {
                found = true;
            }
        }
        assertTrue(found, "刚插入的动态必须出现在 type=MOMENT 结果里");
    }

    private String insertIndexed(String title) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO search_document (id, object_type, object_id, title, discovery_version, indexed_at)
                VALUES (?, 'ARTICLE', ?, ?, 1, NOW())
                """, UUID.randomUUID().toString(), id, title);
        return id;
    }

    private void insertFeatured(String objectId, int sortOrder, String status, Instant createdAt) {
        jdbc.update("""
                INSERT INTO featured_content (id, object_type, object_id, sort_order, status, created_at)
                VALUES (?, 'ARTICLE', ?, ?, ?, ?)
                """, UUID.randomUUID().toString(), objectId, sortOrder, status, createdAt);
    }

    private JsonNode featuredPage(String cursor) throws Exception {
        var request = get("/api/v1/discover").param("sort", "featured").param("limit", "2");
        if (cursor != null) {
            request.param("cursor", cursor);
        }
        var response = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    private List<String> idsOf(JsonNode page) {
        List<String> ids = new ArrayList<>();
        for (JsonNode item : page.path("items")) {
            ids.add(item.path("id").asText());
        }
        return ids;
    }

    private JsonNode fetch(String topic, String type, String cursor) throws Exception {
        var request = get("/api/v1/discover").param("limit", "2").param("topic", topic).param("type", type);
        if (cursor != null) request.param("cursor", cursor);
        var response = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
}

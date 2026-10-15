package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DiscoverFilterIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

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

    private JsonNode fetch(String topic, String type, String cursor) throws Exception {
        var request = get("/api/v1/discover").param("limit", "2").param("topic", topic).param("type", type);
        if (cursor != null) request.param("cursor", cursor);
        var response = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();
        return json.readTree(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
}

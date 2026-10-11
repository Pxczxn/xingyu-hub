package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Topic 内容卡作者验收（Phase 6 Phase B，2026-10-11）。
 *
 * <p>调查结论：话题内容契约只含 ARTICLE（article_topic 表设计即文章挂载，
 * listLatestContent 硬编码 object_type='ARTICLE'）——审计中"SERIES/MOMENT
 * 卡缺 authorName"的推定不成立，那些类型根本不进话题流。本测试钉死
 * ARTICLE 卡的 authorName（listContent 已统一走批量富化通道）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TopicContentEnrichmentIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String topicSlug;
    private String ownerId;
    private String articleId;
    private String seriesId;
    private String momentId;

    @BeforeAll
    void seed() {
        ownerId = UUID.randomUUID().toString();
        String spaceId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_user (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, 'topic-enrich@example.com', '$2a$10$abcdefghijklmnopqrstuv', NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, ownerId);
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, 'topic-enrich-space', '话题富化探针', NOW())
                """, spaceId, ownerId);
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, 'topic_enrich_author', 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), ownerId);

        topicSlug = "enrich-" + (System.nanoTime() % 100000000L);
        jdbcTemplate.update("""
                INSERT INTO topic (id, seed_key, slug, name, description, status)
                VALUES (?, ?, ?, '富化探针话题', NULL, 'ACTIVE')
                """, UUID.randomUUID().toString(), topicSlug, topicSlug);

        articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, 'PUBLISHED', 'PUBLISHED', 'NORMAL', NOW(), NOW())
                """, articleId, ownerId, spaceId);
        // 活文档：话题内容契约只含 ARTICLE（article_topic 设计即文章挂载，
        // listLatestContent 硬编码 object_type='ARTICLE'——SERIES/MOMENT 不进话题流）
        Object[][] docs = {
                {"ARTICLE", articleId, "富化文章", "文章摘要"}};
        for (Object[] doc : docs) {
            jdbcTemplate.update("""
                    INSERT INTO search_document
                        (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                    VALUES (?, ?, ?, ?, ?, 1, NOW())
                    """, UUID.randomUUID().toString(), doc[0], doc[1], doc[2], doc[3]);
        }
        // 话题挂载
        Object[][] binds = {{articleId, "ARTICLE"}};
        for (Object[] bind : binds) {
            jdbcTemplate.update("""
                    INSERT INTO article_topic (topic_id, article_id, created_at)
                    VALUES (?, ?, NOW())
                    """, jdbcTemplate.queryForObject(
                    "SELECT id FROM topic WHERE slug = ?", String.class, topicSlug), bind[0]);
        }
    }

    @AfterAll
    void cleanup() {
        jdbcTemplate.update("""
                DELETE at FROM article_topic at JOIN topic t ON t.id = at.topic_id WHERE t.slug = ?
                """, topicSlug);
        jdbcTemplate.update("DELETE FROM topic WHERE slug = ?", topicSlug);
        jdbcTemplate.update(
                "DELETE FROM search_document WHERE object_id = ?", articleId);
        jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", ownerId);
        jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", ownerId);
        jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", ownerId);
        jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", ownerId);
    }

    @Test
    void allThreeContentTypesCarryAuthorName() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/topics/" + topicSlug + "/content"))
                .andExpect(status().isOk())
                .andReturn();
        // 契约：/topics/{slug}/content 返回裸 ContentCardView 数组（无 PageResult 包装）
        var items = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        System.out.println("[PROBE] topicRows=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM topic WHERE slug = ?", Integer.class, topicSlug));
        System.out.println("[PROBE] atRows=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article_topic at JOIN topic t ON t.id = at.topic_id WHERE t.slug = ?",
                Integer.class, topicSlug));
        System.out.println("[PROBE] docRows=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE title LIKE '富化%'", Integer.class));
        System.out.println("[PROBE] articleRows=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM article a JOIN community_profile p ON p.user_id = a.owner_id "
                        + "WHERE p.username = 'topic_enrich_author' AND a.status = 'PUBLISHED'", Integer.class));
        assertEquals(1, items.size(), "话题内容契约 = 文章挂载");
        var card = items.get(0);
        assertEquals("ARTICLE", card.path("objectType").asText());
        // ARTICLE 卡作者现在走批量富化统一通道（此前逐条解析，语义等价）
        assertEquals("topic_enrich_author", card.path("authorName").asText(),
                "ARTICLE 卡必须带作者");
        assertTrue(card.path("title").asText().startsWith("富化"), "卡必须有标题");
    }
}

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
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 发现页 keyset 翻页契约（Phase 5，2026-10-11）。
 *
 * <p>钉死：排序稳定（indexed_at DESC, object_id DESC）、跨页不重不漏、
 * nextCursor 耗尽为 null、非法 cursor 回退首页而非 500、治理隐藏内容
 * 不出现在任何页。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DiscoverCursorIntegrationTest {

    private static final int SEED = 7;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<String> docIds = new ArrayList<>();
    private final List<String> articleIds = new ArrayList<>();

    @BeforeAll
    void seed() {
        // 7 篇活文档 + 1 篇被治理隐藏（removed_at），indexed_at 递增可断言排序
        for (int i = 0; i < SEED + 1; i++) {
            String articleId = "dcur-art-" + i;
            String docId = "dcur-doc-" + i;
            boolean hidden = i == SEED; // 最后一篇隐藏
            jdbcTemplate.update("""
                    INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                    SELECT ?, 'seed-owner', cs.id, 'PUBLISHED', 'PUBLISHED', 'NORMAL', NOW(), NOW()
                    FROM community_creation_space cs LIMIT 1
                    """, articleId);
            jdbcTemplate.update("""
                    INSERT INTO search_document
                        (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
                    VALUES (?, 'ARTICLE', ?, ?, ?, 1, ?, ?)
                    """, docId, articleId, "发现页探针 " + i, "摘要 " + i,
                    Instant.now().minusSeconds(3600L * (SEED - i)), hidden ? Instant.now() : null);
            if (!hidden) {
                docIds.add(docId);
                articleIds.add(articleId);
            }
        }
    }

    @AfterAll
    void cleanup() {
        for (String docId : docIds) {
            jdbcTemplate.update("DELETE FROM search_document WHERE id = ?", docId);
        }
        jdbcTemplate.update(
                "DELETE FROM search_document WHERE object_type = 'ARTICLE' AND object_id LIKE 'dcur-art-%'");
        for (String articleId : articleIds) {
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        }
        jdbcTemplate.update("DELETE FROM article WHERE id LIKE 'dcur-art-%'");
    }

    /** 一页 discover 的 (id, nextCursor)。 */
    private record Page(List<String> ids, String nextCursor) {
    }

    private Page fetch(String cursor) throws Exception {
        String uri = cursor == null ? "/api/v1/discover?limit=3"
                : "/api/v1/discover?limit=3&cursor=" + cursor;
        MvcResult result = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        List<String> ids = new ArrayList<>();
        body.path("items").forEach(item -> ids.add(item.path("id").asText()));
        return new Page(ids, body.path("nextCursor").isNull() ? null : body.path("nextCursor").asText());
    }

    /** 只保留本轮探针的 id（card.id = search_document.object_id = articleId）。 */
    private List<String> probeIds(Page page) {
        return page.ids().stream().filter(id -> id.startsWith("dcur-art-")).toList();
    }

    @Test
    void keysetPaginationCoversAllLiveContentWithoutDuplication() throws Exception {
        Set<String> seen = new HashSet<>();
        List<String> ordered = new ArrayList<>();
        String cursor = null;
        int rounds = 0;
        while (rounds < 10) {
            Page page = fetch(cursor);
            List<String> probes = probeIds(page);
            for (String id : probes) {
                assertTrue(seen.add(id), "跨页不得重复：" + id);
                ordered.add(id);
            }
            rounds++;
            if (page.nextCursor() == null) {
                break;
            }
            cursor = page.nextCursor();
        }
        // 所有活探针文档都可达（治理隐藏的 doc 不在其中——docIds 只含活文档）
        assertEquals(docIds.size(), ordered.size(), "全部活文档必须跨页可达且不重复");
        // 排序稳定：探针内部保持 indexed_at DESC 相对顺序
        // （库中可能有其它活文档交错，因此只断言探针之间的相对次序）
        List<Integer> seq = ordered.stream()
                .filter(id -> id.startsWith("dcur-art-"))
                .map(id -> Integer.parseInt(id.substring("dcur-art-".length())))
                .toList();
        List<Integer> sorted = new ArrayList<>(seq);
        sorted.sort((a, b) -> b - a);
        assertEquals(sorted, seq, "探针内部必须保持 indexed_at DESC 相对顺序");
    }

    @Test
    void invalidCursorIsAnExplicitClientError() throws Exception {
        // Phase 5.1：非法 cursor = 明确 400 客户端错误（不再静默回首页）
        mockMvc.perform(get("/api/v1/discover?limit=3&cursor=%25%25%25bad"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").isNotEmpty());
    }

    @Test
    void sameObjectIdAcrossObjectTypesIsNotSkipped() throws Exception {
        // Phase 5.1 边界：object_id 相同但 objectType 不同 = 两条独立文档，
        // keyset 三元组必须让两者都可达（二元组会跳过同 id 的其它类型）。
        String sharedId = "dcur-art-0";
        jdbcTemplate.update("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
                VALUES ('dcur-doc-series-0', 'SERIES', ?, '同名系列探针', '同 id 不同类型', 1,
                        (SELECT indexed_at FROM (SELECT indexed_at FROM search_document
                          WHERE object_type='ARTICLE' AND object_id=?) x), NULL)
                """, sharedId, sharedId);
        try {
            Set<String> seen = new HashSet<>();
            String cursor = null;
            boolean sawArticle = false;
            boolean sawSeries = false;
            int rounds = 0;
            while (rounds < 10) {
                String uri = cursor == null ? "/api/v1/discover?limit=3"
                        : "/api/v1/discover?limit=3&cursor=" + cursor;
                MvcResult result = mockMvc.perform(get(uri)).andExpect(status().isOk()).andReturn();
                var body = objectMapper.readTree(result.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
                for (var item : body.path("items")) {
                    String key = item.path("objectType").asText() + ":" + item.path("id").asText();
                    assertTrue(seen.add(key), "跨页不得重复：" + key);
                    if (key.equals("ARTICLE:" + sharedId)) sawArticle = true;
                    if (key.equals("SERIES:" + sharedId)) sawSeries = true;
                }
                cursor = body.path("nextCursor").isNull() ? null : body.path("nextCursor").asText();
                if (cursor == null || ++rounds >= 10) break;
            }
            assertTrue(sawArticle && sawSeries, "同 object_id 的 ARTICLE 与 SERIES 都必须可达");
        } finally {
            jdbcTemplate.update("DELETE FROM search_document WHERE id = 'dcur-doc-series-0'");
        }
    }
}

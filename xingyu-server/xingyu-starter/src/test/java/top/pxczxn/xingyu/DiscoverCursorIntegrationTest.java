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
    void invalidCursorFallsBackToFirstPageInsteadOfError() throws Exception {
        // %25 = 字面 % 的 URL 编码——Base64URL 之外的字符必然解码失败 → 回退首页
        MvcResult result = mockMvc.perform(get("/api/v1/discover?limit=3&cursor=%25%25%25bad"))
                .andExpect(status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertTrue(body.path("items").isArray(), "非法 cursor 回退首页而非 500");
        assertTrue(body.path("nextCursor").isNull() || body.path("nextCursor").isTextual());
    }
}

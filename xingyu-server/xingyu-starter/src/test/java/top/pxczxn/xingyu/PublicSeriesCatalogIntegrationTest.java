package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
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

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 系列广场目录契约（2026-10-18）：{@code GET /api/v1/series/search}。
 *
 * <p>被替换的实现有三处真实缺陷，本测试逐条固定新契约：
 * <ol>
 *   <li>旧端点只有 {@code limit}，前端只能靠"把 limit 从 24 加到 48"继续翻，
 *       超过首个窗口的系列在按钮消失后不可达；现在由 keyset cursor 决定是否还有下一页。</li>
 *   <li>旧的公开列表<b>先</b>取 limit 条、<b>再</b>丢弃没有档案的作者，返回可能少于 limit，
 *       让"还有下一页"的探针失真；现在可见性在 SQL 内完成。</li>
 *   <li>搜索只在前端已取到的窗口里过滤；现在 q 在整个公开集合上匹配。</li>
 * </ol>
 *
 * <p>断言用本测试自带的唯一前缀限定范围，因此不依赖测试库里其它数据的总数；
 * 30 条数据刻意多于旧实现的 24 条窗口。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PublicSeriesCatalogIntegrationTest {

    private static final int SEEDED = 26;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final String run = UUID.randomUUID().toString().substring(0, 8);
    private final String titleMarker = "目录回归" + run;
    private final String descriptionToken = "深海书房" + run;
    private final String authorA = "cat-a-" + run;
    private final String authorB = "cat-b-" + run;
    private final String displayNameB = "乙作者" + run;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> seriesIds = new ArrayList<>();

    @BeforeAll
    void setUp() {
        String ownerA = seedUser(authorA, null);
        String ownerB = seedUser(authorB, displayNameB);
        String ownerWithoutProfile = seedUser("cat-noprofile-" + run, null);
        // seedUser 对 authorB 建了档案；这里删掉一次，验证"无档案不公开"在 SQL 里生效。
        jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", ownerWithoutProfile);

        for (int index = 0; index < SEEDED; index++) {
            String owner = index % 2 == 0 ? ownerA : ownerB;
            String description = index == 3 ? descriptionToken : "用于目录分页校验的简介 " + index;
            seedSeries(owner, String.format("%s 系列 %02d", titleMarker, index),
                    description, "ACTIVE", index + 10);
        }
        // 不该出现在公开目录里的两条。
        seedSeries(ownerA, titleMarker + " 已归档", "归档系列", "ARCHIVED", 1);
        seedSeries(ownerWithoutProfile, titleMarker + " 无档案", "作者没有公开档案", "ACTIVE", 2);
    }

    @AfterAll
    void tearDown() {
        for (String seriesId : seriesIds) {
            jdbcTemplate.update("DELETE FROM series_subscription WHERE series_id = ?", seriesId);
            jdbcTemplate.update("DELETE FROM series_chapter WHERE series_id = ?", seriesId);
            jdbcTemplate.update("DELETE FROM series WHERE id = ?", seriesId);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        seriesIds.clear();
    }

    @Test
    void firstPageReportsNextCursorAndRealTotal() throws Exception {
        JsonNode page = fetch(Map.of("q", titleMarker, "limit", "8"));

        assertEquals(8, page.path("items").size(), "一页条数由 limit 决定");
        assertEquals(SEEDED, page.path("total").asInt(), "total 是过滤后的真实总数，不是本页条数");
        assertFalse(page.path("nextCursor").isNull(), "还有 18 条时必须给出下一页游标");
        assertEquals(titleMarker + " 系列 00", page.path("items").get(0).path("title").asText(),
                "按最近更新倒序");
    }

    @Test
    void cursorWalksTheWholeCollectionWithoutGapsOrDuplicates() throws Exception {
        Set<String> seenIds = new HashSet<>();
        List<String> seenTitles = new ArrayList<>();
        String cursor = null;
        int requests = 0;

        do {
            JsonNode page = cursor == null
                    ? fetch(Map.of("q", titleMarker, "limit", "8"))
                    : fetch(Map.of("q", titleMarker, "limit", "8", "cursor", cursor));
            requests++;
            for (JsonNode item : page.path("items")) {
                assertTrue(seenIds.add(item.path("id").asText()), "跨页不得重复返回同一个系列");
                seenTitles.add(item.path("title").asText());
            }
            cursor = page.path("nextCursor").isNull() ? null : page.path("nextCursor").asText();
            assertTrue(requests < 10, "游标必须收敛，不能无限续页");
        } while (cursor != null);

        assertEquals(SEEDED, seenIds.size(), "26 条必须全部可达（旧实现卡在 24 条窗口）");
        assertEquals(SEEDED, seenTitles.size());
        assertEquals(titleMarker + " 系列 00", seenTitles.get(0));
        assertEquals(titleMarker + " 系列 25", seenTitles.get(SEEDED - 1));
    }

    @Test
    void archivedAndProfilelessSeriesStayOutOfTheCatalogue() throws Exception {
        JsonNode page = fetch(Map.of("q", titleMarker, "limit", "50"));

        List<String> titles = new ArrayList<>();
        page.path("items").forEach(item -> titles.add(item.path("title").asText()));
        assertEquals(SEEDED, titles.size());
        assertFalse(titles.stream().anyMatch(title -> title.contains("已归档")));
        assertFalse(titles.stream().anyMatch(title -> title.contains("无档案")));
        assertTrue(page.path("nextCursor").isNull(), "全部返回后不应再给游标");
    }

    @Test
    void keywordMatchesTheWholeCollectionIncludingAuthorAndDescription() throws Exception {
        // 作者用户名：只有 authorA 的名下系列命中，且结果跨页可用。
        JsonNode byAuthor = fetch(Map.of("q", authorA, "limit", "50"));
        assertEquals(SEEDED / 2, byAuthor.path("items").size());
        byAuthor.path("items").forEach(item ->
                assertEquals(authorA, item.path("author").path("username").asText()));

        // 作者显示名。
        JsonNode byDisplayName = fetch(Map.of("q", displayNameB, "limit", "50"));
        assertEquals(SEEDED / 2, byDisplayName.path("items").size());

        // 简介：只有一条带这个 token。
        JsonNode byDescription = fetch(Map.of("q", descriptionToken, "limit", "50"));
        assertEquals(1, byDescription.path("items").size());
        assertEquals(1, byDescription.path("total").asInt());
    }

    @Test
    void keywordThatMatchesNothingReturnsAnEmptyPageWithoutACursor() throws Exception {
        JsonNode page = fetch(Map.of("q", "不存在的关键词" + run, "limit", "8"));

        assertEquals(0, page.path("items").size());
        assertEquals(0, page.path("total").asInt());
        assertTrue(page.path("nextCursor").isNull());
    }

    @Test
    void malformedCursorIsAClientErrorNotASilentReset() throws Exception {
        mockMvc.perform(get("/api/v1/series/search").param("cursor", "not-a-real-cursor"))
                .andExpect(status().isBadRequest());
    }

    // ---- helpers ----

    /**
     * Query parameters go through `.param(...)`, not the URL string: MockMvc does
     * not percent-decode a query string passed to {@code get(url)}, so an encoded
     * keyword would reach the mapper as literal {@code %E7...}.
     */
    private JsonNode fetch(Map<String, String> params) throws Exception {
        var request = get("/api/v1/series/search");
        params.forEach(request::param);
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String seedUser(String username, String displayName) {
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, 'not-used', NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, username + "@example.test");
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, display_name, visibility, lock_version, created_at)
                VALUES (?, ?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId, username, displayName);
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'catalogue-space', NOW())
                """, UUID.randomUUID().toString(), userId, username + "-space");
        return userId;
    }

    private void seedSeries(String ownerId, String title, String description, String status,
                           int secondsAgo) {
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, ownerId);
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO series
                    (id, owner_id, space_id, title, slug, description, status, lock_version,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0,
                        DATE_SUB(NOW(), INTERVAL ? SECOND), DATE_SUB(NOW(), INTERVAL ? SECOND))
                """, id, ownerId, spaceId, title, "cat-" + UUID.randomUUID().toString().substring(0, 12),
                description, status, secondsAgo, secondsAgo);
        seriesIds.add(id);
    }
}

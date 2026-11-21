package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 发现页整页边界矩阵（Phase 5.1-F，2026-10-11）。
 *
 * <p>limit=20 时验证 N=19/20/21/40/41 五个边界。发现页按全部活文档做 keyset 分页，
 * 单页上限就是请求的 limit（默认 20），不是把结果截成 10。探针 indexed_at 必须新于
 * 库内其它活文档，这样第一页从探针开始；库内既有文档只出现在探针之后。
 * <ul>
 *   <li>N=19：第一页含全部 19 条探针；若还有更旧活文档则 nextCursor 非空。</li>
 *   <li>N=20：第一页恰好 20 条探针；有后续活文档时 nextCursor 非空。</li>
 *   <li>N=21：第一页 20 条探针且 nextCursor 非空，后续页含第 21 条。</li>
 *   <li>N=40：前两页各 20 条探针。</li>
 *   <li>N=41：前两页各 20 条，第三页含最后 1 条探针。</li>
 * </ul>
 * 全程跨页不重、不漏、保持 indexed_at DESC 排序；有 nextCursor 的页必须满 limit。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DiscoverEdgeBoundaryIntegrationTest {

    private static final String PREFIX = "dedge-";
    private static final String FILLER_PREFIX = "dfill-";
    private static final int LIMIT = 20;
    private static final int FILLER_COUNT = 15;
    private static final int MAX_ROUNDS = 40;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private Connection adminConn;

    @BeforeAll
    void openAdmin() throws Exception {
        Properties db = new Properties();
        Path envFile = Path.of("../../scripts/local-test-db.env").toAbsolutePath().normalize();
        if (Files.exists(envFile)) {
            for (String line : Files.readAllLines(envFile)) {
                if (line.contains("=") && !line.trim().startsWith("#")) {
                    String key = line.substring(0, line.indexOf('=')).trim();
                    String value = line.substring(line.indexOf('=') + 1).replace("'", "").trim();
                    db.setProperty(key, value);
                }
            }
        }
        String adminUser = System.getenv("TEST_DB_ADMIN_USER");
        if (adminUser == null || adminUser.isBlank()) {
            adminUser = db.getProperty("TEST_DB_ADMIN_USER");
        }
        String adminPassword = System.getenv("TEST_DB_ADMIN_PASSWORD");
        if (adminPassword == null || adminPassword.isBlank()) {
            adminPassword = db.getProperty("TEST_DB_ADMIN_PASSWORD");
        }
        adminConn = DriverManager.getConnection(
                "jdbc:mysql://127.0.0.1:3306/xingyu_hub_test?allowMultiQueries=true&useUnicode=true"
                        + "&characterEncoding=utf8&serverTimezone=GMT%2B8",
                adminUser, adminPassword);
        seedFillers();
    }

    @AfterAll
    void cleanup() throws Exception {
        // 只清理本类前缀的探针与对照填充行，不触碰其它数据
        deleteByObjectPrefix(PREFIX);
        deleteByObjectPrefix(FILLER_PREFIX);
        adminConn.close();
    }

    /** 插入更旧的对照活文档，证明分页走全库而不是只看本类探针、也不会截成 10 条。 */
    private void seedFillers() throws Exception {
        deleteByObjectPrefix(FILLER_PREFIX);
        try (PreparedStatement ps = adminConn.prepareStatement("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'ARTICLE', ?, ?, NULL, 1, ?)
                """)) {
            Instant base = Instant.now().minusSeconds(86_400L);
            for (int i = 1; i <= FILLER_COUNT; i++) {
                ps.setString(1, FILLER_PREFIX + "doc-" + i);
                ps.setString(2, FILLER_PREFIX + i);
                ps.setString(3, "对照填充 " + i);
                ps.setObject(4, base.minusSeconds(i));
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private void deleteByObjectPrefix(String prefix) throws Exception {
        try (PreparedStatement ps = adminConn.prepareStatement(
                "DELETE FROM search_document WHERE object_id LIKE ?")) {
            ps.setString(1, prefix + "%");
            ps.executeUpdate();
        }
    }

    /** 清掉旧探针后插入 N 篇活探针文档（indexed_at 在未来递增，尾号越大越新）。 */
    private void seedProbes(int n) throws Exception {
        deleteByObjectPrefix(PREFIX);
        try (PreparedStatement ps = adminConn.prepareStatement("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'ARTICLE', ?, ?, NULL, 1, ?)
                """)) {
            Instant base = Instant.now().plusSeconds(3_600L);
            for (int i = 1; i <= n; i++) {
                String objectId = PREFIX + i;
                ps.setString(1, PREFIX + "doc-" + i);
                ps.setString(2, objectId);
                ps.setString(3, "边界探针 " + i);
                ps.setObject(4, base.plusSeconds(i));
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    /** 沿 nextCursor 翻页，返回探针序列、每页 nextCursor 与每页探针数量。 */
    private record Journey(List<Integer> order, List<String> cursors, List<Integer> probeCounts) {
    }

    private Journey journey() throws Exception {
        List<Integer> order = new ArrayList<>();
        List<String> cursors = new ArrayList<>();
        List<Integer> probeCounts = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String cursor = null;
        int rounds = 0;
        while (rounds < MAX_ROUNDS) {
            var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .get("/api/v1/discover")
                    .param("limit", String.valueOf(LIMIT));
            if (cursor != null) {
                request.param("cursor", cursor);
            }
            MvcResult result = mockMvc.perform(request)
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                    .andReturn();
            var body = objectMapper.readTree(result.getResponse()
                    .getContentAsString(StandardCharsets.UTF_8));
            int itemsInPage = body.path("items").size();
            int probesInPage = 0;
            for (var item : body.path("items")) {
                String id = item.path("id").asText();
                if (id.startsWith(PREFIX)) {
                    assertTrue(seen.add(id), "跨页不得重复：" + id);
                    order.add(Integer.parseInt(id.substring(PREFIX.length())));
                    probesInPage++;
                }
            }
            probeCounts.add(probesInPage);
            boolean hasNext = !body.path("nextCursor").isNull() && !body.path("nextCursor").asText().isBlank();
            cursors.add(hasNext ? "Y" : "N");
            assertTrue(itemsInPage <= LIMIT, "单页不得超过 limit，实际=" + itemsInPage);
            if (hasNext) {
                assertEquals(LIMIT, itemsInPage, "有 nextCursor 时当前页必须满 limit，实际=" + itemsInPage);
            }
            cursor = hasNext ? body.path("nextCursor").asText() : null;
            rounds++;
            if (!hasNext) {
                break;
            }
        }
        return new Journey(order, cursors, probeCounts);
    }

    @ParameterizedTest
    @ValueSource(ints = {19, 20, 21, 40, 41})
    void edgeBoundaryMatrix(int n) throws Exception {
        seedProbes(n);
        Journey journey = journey();

        // 不漏：N 条探针全部可达
        assertEquals(n, journey.order().size(), "N=" + n + " 必须全部可达");
        // 不重：降序全序列
        List<Integer> expected = new ArrayList<>();
        for (int i = n; i >= 1; i--) {
            expected.add(i);
        }
        assertEquals(expected, journey.order(), "N=" + n + " 必须保持 indexed_at DESC 排序");
        assertEquals(Math.min(n, LIMIT), journey.probeCounts().getFirst(),
                "N=" + n + " 第一页必须从最新探针开始，探针条数=" + Math.min(n, LIMIT));
        if (n > LIMIT) {
            assertEquals("Y", journey.cursors().getFirst(),
                    "N=" + n + " 超过单页时第一页 nextCursor 必须存在");
            int remaining = n - LIMIT;
            int page = 1;
            while (remaining > 0) {
                assertTrue(page < journey.probeCounts().size(),
                        "N=" + n + " 剩余探针必须出现在后续页");
                int expectedOnPage = Math.min(remaining, LIMIT);
                assertEquals(expectedOnPage, journey.probeCounts().get(page),
                        "N=" + n + " 第" + (page + 1) + "页探针数量");
                remaining -= expectedOnPage;
                page++;
            }
        }
    }
}

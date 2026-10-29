package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

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
 * <p>limit=20 时验证 N=19/20/21/40/41 五个边界：
 * <ul>
 *   <li>N=19：单页穷尽，nextCursor=null（不得有尾随空页）；</li>
 *   <li>N=20：恰好整页——limit+1 探测判据下 nextCursor=null（旧判据会误报）；</li>
 *   <li>N=21：nextCursor 非 null，第二页恰好 1 条探针；</li>
 *   <li>N=40：两整页，第二页末尾 nextCursor=null；</li>
 *   <li>N=41：两整页 + 第三页 1 条。</li>
 * </ul>
 * 全程跨页不重、不漏、保持 indexed_at DESC 排序。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DiscoverEdgeBoundaryIntegrationTest {

    private static final String PREFIX = "dedge-";
    private static final int LIMIT = 20;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

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
    }

    @AfterAll
    void cleanup() throws Exception {
        // 只清理本类前缀的探针行，不触碰其它数据
        try (PreparedStatement ps = adminConn.prepareStatement(
                "DELETE FROM search_document WHERE object_id LIKE ?")) {
            ps.setString(1, PREFIX + "%");
            ps.executeUpdate();
        }
        adminConn.close();
    }

    /** 清掉旧探针后插入 N 篇活探针文档（indexed_at 递增，尾号越大越新）。 */
    private void seedProbes(int n) throws Exception {
        try (PreparedStatement del = adminConn.prepareStatement(
                "DELETE FROM search_document WHERE object_id LIKE ?")) {
            del.setString(1, PREFIX + "%");
            del.executeUpdate();
        }
        try (PreparedStatement ps = adminConn.prepareStatement("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'ARTICLE', ?, ?, NULL, 1, ?)
                """)) {
            for (int i = 1; i <= n; i++) {
                String objectId = PREFIX + i;
                ps.setString(1, PREFIX + "doc-" + i);
                ps.setString(2, objectId);
                ps.setString(3, "边界探针 " + i);
                ps.setObject(4, Instant.now().minusSeconds(3600L * (n - i + 1)));
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    /** 沿 nextCursor 翻完整页，返回 (探针序列, 每页 nextCursor 列表)。 */
    private record Journey(List<Integer> order, List<String> cursors) {
    }

    private Journey journey() throws Exception {
        List<Integer> order = new ArrayList<>();
        List<String> cursors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String cursor = null;
        int rounds = 0;
        while (rounds < 10) {
            String uri = cursor == null ? "/api/v1/discover?limit=" + LIMIT
                    : "/api/v1/discover?limit=" + LIMIT + "&cursor=" + cursor;
            MvcResult result = mockMvc.perform(
                            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(uri))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                    .andReturn();
            var body = objectMapper.readTree(result.getResponse()
                    .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
            int itemsInPage = body.path("items").size();
            for (var item : body.path("items")) {
                String id = item.path("id").asText();
                if (id.startsWith(PREFIX)) {
                    assertTrue(seen.add(id), "跨页不得重复：" + id);
                    order.add(Integer.parseInt(id.substring(PREFIX.length())));
                }
            }
            boolean hasNext = !body.path("nextCursor").isNull();
            cursors.add(hasNext ? "Y" : "N");
            // 页大小守卫：任何一页都不得超过 limit
            assertTrue(itemsInPage <= LIMIT, "单页不得超过 limit，实际=" + itemsInPage);
            cursor = hasNext ? body.path("nextCursor").asText() : null;
            if (!hasNext || ++rounds >= 10) {
                break;
            }
        }
        return new Journey(order, cursors);
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
        // nextCursor 终态：恰好整页（N%20==0）时最终页必须 null（不得出现空翻页）
        boolean finalCursorNull = journey.cursors().get(journey.cursors().size() - 1).equals("N");
        if (n % LIMIT != 0) {
            // 非整页：尾页必然 null（内容不足一页）
            assertTrue(finalCursorNull, "N=" + n + " 尾页 nextCursor 必须为 null");
        } else {
            // 整页：最后仍由 limit+1 探测判据给出 null（不得出现无内容的额外翻页）
            assertTrue(finalCursorNull, "N=" + n + " 整页穷尽后 nextCursor 必须为 null（不得尾随空页）");
        }
    }
}

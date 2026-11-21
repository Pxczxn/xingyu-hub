package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.service.SearchIndexService;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端系列归档和恢复只改状态、时间和乐观锁，并与事件、搜索索引同一事务提交。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminSeriesStatusIndexConsistencyIntegrationTest {

    private static final int MAX_DRAIN_ROUNDS = 20;

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
    @Autowired
    private ReliableEventConsumer eventConsumer;

    @SpyBean
    private SearchIndexService searchIndexService;

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.requireIsolatedTargets(
                configGroupService, jdbcTemplate, dataSource, redisConnectionFactory);
    }

    @Test
    @DisplayName("归档后详情和搜索同时消失，恢复后同时回来，重复操作不推进版本")
    void archiveAndRestoreStayConsistentWithSearch() throws Exception {
        String author = registerAndLogin("p1cauthor");
        String seriesId = createSeries(author, "p1c-live", "原始简介");
        drainReliableEvents();
        assertTrue(isIndexed(seriesId));
        assertEquals(200, publicStatus(seriesId));
        long version = lockVersion(seriesId);
        String updatedAt = updatedAt(seriesId);
        int events = eventCount(seriesId);

        String admin = adminToken();
        Thread.sleep(1100);
        changeStatus(admin, seriesId, "ARCHIVED");
        assertEquals("ARCHIVED", seriesStatus(seriesId));
        assertEquals(version + 1, lockVersion(seriesId));
        assertFalse(updatedAt.equals(updatedAt(seriesId)), "归档应写入新的 updated_at");
        assertEquals(404, publicStatus(seriesId));
        assertFalse(isIndexed(seriesId));
        assertEquals(events + 1, eventCount(seriesId));

        long archivedVersion = lockVersion(seriesId);
        String archivedAt = updatedAt(seriesId);
        int eventsAfterArchive = eventCount(seriesId);
        Thread.sleep(1100);
        changeStatus(admin, seriesId, "ARCHIVED");
        assertEquals("ARCHIVED", seriesStatus(seriesId));
        assertEquals(archivedVersion, lockVersion(seriesId));
        assertEquals(archivedAt, updatedAt(seriesId));
        assertEquals(eventsAfterArchive, eventCount(seriesId));
        assertFalse(isIndexed(seriesId));

        changeStatus(admin, seriesId, "ACTIVE");
        assertEquals("ACTIVE", seriesStatus(seriesId));
        assertEquals(archivedVersion + 1, lockVersion(seriesId));
        assertEquals(200, publicStatus(seriesId));
        assertTrue(isIndexed(seriesId));

        long restoredVersion = lockVersion(seriesId);
        int eventsAfterRestore = eventCount(seriesId);
        changeStatus(admin, seriesId, "ACTIVE");
        assertEquals(restoredVersion, lockVersion(seriesId));
        assertEquals(eventsAfterRestore, eventCount(seriesId));
        assertTrue(isIndexed(seriesId));
        assertEquals("原始简介", description(seriesId));
    }

    @Test
    @DisplayName("不存在的系列返回内容不存在，非法状态不写库")
    void missingAndIllegalStatusesDoNotWrite() throws Exception {
        String admin = adminToken();
        mockMvc.perform(patch("/api/v1/admin/operations/content/missing-series-p1c/status")
                        .header("satoken", admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"SERIES\",\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value("内容不存在"));
        assertEquals(0, eventCount("missing-series-p1c"));
        assertFalse(isIndexed("missing-series-p1c"));

        String author = registerAndLogin("p1cillegal");
        String seriesId = createSeries(author, "p1c-illegal", "保持简介");
        long version = lockVersion(seriesId);
        int events = eventCount(seriesId);
        for (String requested : new String[] {"DRAFT", "IN_REVIEW", "PUBLISHED"}) {
            mockMvc.perform(patch("/api/v1/admin/operations/content/" + seriesId + "/status")
                            .header("satoken", admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"type\":\"SERIES\",\"status\":\"" + requested + "\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(422))
                    .andExpect(jsonPath("$.message").value("内容类型或状态无效"));
            assertEquals("ACTIVE", seriesStatus(seriesId));
            assertEquals(version, lockVersion(seriesId));
            assertEquals(events, eventCount(seriesId));
        }
    }

    @Test
    @DisplayName("索引刷新失败时状态、版本和事件一起回滚")
    void indexFailureRollsBackStatusVersionAndEvent() throws Exception {
        String author = registerAndLogin("p1cfail");
        String seriesId = createSeries(author, "p1c-fail", "失败前简介");
        drainReliableEvents();
        assertTrue(isIndexed(seriesId));
        long version = lockVersion(seriesId);
        int events = eventCount(seriesId);
        String admin = adminToken();

        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("index refresh failed");
        }).when(searchIndexService).refresh(eq(SearchIndexService.SERIES), eq(seriesId));
        try {
            mockMvc.perform(patch("/api/v1/admin/operations/content/" + seriesId + "/status")
                            .header("satoken", admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"type\":\"SERIES\",\"status\":\"ARCHIVED\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(500))
                    .andExpect(jsonPath("$.message").value("index refresh failed"));
        } finally {
            doCallRealMethod().when(searchIndexService)
                    .refresh(eq(SearchIndexService.SERIES), eq(seriesId));
        }

        assertEquals("ACTIVE", seriesStatus(seriesId));
        assertEquals(version, lockVersion(seriesId));
        assertEquals(events, eventCount(seriesId));
        assertTrue(isIndexed(seriesId));
        assertEquals(200, publicStatus(seriesId));
    }

    @Test
    @DisplayName("管理端归档不覆盖作者已经提交的标题")
    void archiveDoesNotOverwriteAuthorTitle() throws Exception {
        String author = registerAndLogin("p1crace");
        String seriesId = createSeries(author, "p1c-race", "原始简介");
        String title1 = "author-kept-" + System.nanoTime();
        updateSeries(author, seriesId, title1, null, lockVersion(seriesId));
        assertEquals(title1, title(seriesId));

        String title2 = "author-raced-" + System.nanoTime();
        String admin = adminToken();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Future<Integer> authorCall = pool.submit(() -> {
                start.await();
                return updateSeries(author, seriesId, title2, null, lockVersion(seriesId));
            });
            Future<Integer> adminCall = pool.submit(() -> {
                start.await();
                changeStatus(admin, seriesId, "ARCHIVED");
                return 200;
            });
            start.countDown();
            int authorStatus = authorCall.get(20, TimeUnit.SECONDS);
            adminCall.get(20, TimeUnit.SECONDS);
            assertEquals("ARCHIVED", seriesStatus(seriesId));
            assertEquals("原始简介", description(seriesId));
            if (authorStatus == 200) {
                assertEquals(title2, title(seriesId));
            } else {
                assertEquals(409, authorStatus);
                assertEquals(title1, title(seriesId));
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private void changeStatus(String adminToken, String seriesId, String status) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/operations/content/" + seriesId + "/status")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"SERIES\",\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    private String createSeries(String token, String slugPrefix, String description) throws Exception {
        String slug = (slugPrefix + System.nanoTime()).toLowerCase();
        MvcResult created = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + slugPrefix + "\",\"slug\":\"" + slug
                                + "\",\"description\":\"" + description + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(created.getResponse().getContentAsString()).path("id").asText();
    }

    private int updateSeries(String token, String seriesId, String title, String description, long version)
            throws Exception {
        String body = description == null
                ? "{\"title\":\"" + title + "\",\"lockVersion\":" + version + "}"
                : "{\"title\":\"" + title + "\",\"description\":\"" + description
                + "\",\"lockVersion\":" + version + "}";
        MvcResult result = mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn();
        return result.getResponse().getStatus();
    }

    private int publicStatus(String seriesId) throws Exception {
        return mockMvc.perform(get("/api/v1/series/" + seriesId)).andReturn().getResponse().getStatus();
    }

    private void drainReliableEvents() {
        for (int round = 0; round < MAX_DRAIN_ROUNDS; round++) {
            Integer pending = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
    }

    private Map<String, Object> seriesRow(String seriesId) {
        return jdbcTemplate.queryForMap(
                "SELECT status, lock_version, CAST(updated_at AS CHAR) AS updated_at, title, description"
                        + " FROM series WHERE id = ?",
                seriesId);
    }

    private String seriesStatus(String seriesId) {
        return String.valueOf(seriesRow(seriesId).get("status"));
    }

    private long lockVersion(String seriesId) {
        return ((Number) seriesRow(seriesId).get("lock_version")).longValue();
    }

    private String updatedAt(String seriesId) {
        return String.valueOf(seriesRow(seriesId).get("updated_at"));
    }

    private String title(String seriesId) {
        return String.valueOf(seriesRow(seriesId).get("title"));
    }

    private String description(String seriesId) {
        return String.valueOf(seriesRow(seriesId).get("description"));
    }

    private boolean isIndexed(String seriesId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document"
                        + " WHERE object_type = 'SERIES' AND object_id = ? AND removed_at IS NULL",
                Integer.class, seriesId);
        return count != null && count > 0;
    }

    private int eventCount(String seriesId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reliable_event WHERE aggregate_type = 'series' AND aggregate_id = ?",
                Integer.class, seriesId);
        return count == null ? 0 : count;
    }

    private String registerAndLogin(String prefix) throws Exception {
        String username = prefix + System.nanoTime();
        String email = username + "@example.com";
        String password = "Test1234!@#ab";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }
}

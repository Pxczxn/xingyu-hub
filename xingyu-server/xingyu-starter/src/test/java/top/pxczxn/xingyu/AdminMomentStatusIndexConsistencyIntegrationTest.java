package top.pxczxn.xingyu;

import com.alibaba.druid.pool.DruidDataSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.service.MomentService;
import top.pxczxn.xingyu.community.service.SearchIndexService;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 管理端动态回收/恢复与搜索索引在同一事务里对齐。
 *
 * <p>公开详情看 {@code moment.status}，搜索看 {@code search_document.removed_at}。
 * 本类走真实库和真实 HTTP，不用 Mock 调用次数代替提交结果。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminMomentStatusIndexConsistencyIntegrationTest {

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
    private MomentService momentService;
    @Autowired
    private ReliableEventConsumer eventConsumer;
    @Autowired
    private PlatformTransactionManager transactionManager;

    @SpyBean
    private SearchIndexService searchIndexService;

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        assertEquals("xingyu_hub_test", jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        try (Connection connection = dataSource.getConnection()) {
            assertEquals("xingyu_hub_test", connection.getCatalog());
            String url = connection.getMetaData().getURL();
            assertTrue(url.contains("/xingyu_hub_test"), url);
            assertFalse(url.contains("/xingyu_hub?"), url);
        }
        assertTrue(redisConnectionFactory instanceof LettuceConnectionFactory);
        assertEquals(7, ((LettuceConnectionFactory) redisConnectionFactory).getDatabase());
        assertEquals("REPEATABLE-READ",
                jdbcTemplate.queryForObject("SELECT @@transaction_isolation", String.class));
    }

    @Test
    @DisplayName("回收后详情和搜索同时消失，恢复后同时回来，重复操作不改变结果")
    void trashAndRestoreStayConsistentWithSearch() throws Exception {
        String token = registerAndLogin("p1aauthor");
        String marker = marker();
        String momentId = publishMoment(token, marker);
        drainReliableEvents();
        assertTrue(isIndexed(momentId));
        assertEquals(200, detailStatus(momentId));

        String admin = adminToken();
        changeStatus(admin, momentId, "TRASHED");
        assertEquals(404, detailStatus(momentId));
        assertFalse(isIndexed(momentId));
        assertFalse(searchHits(marker));
        assertEquals("TRASHED", momentStatus(momentId));

        int eventsAfterTrash = eventCount(momentId);
        changeStatus(admin, momentId, "TRASHED");
        assertEquals(404, detailStatus(momentId));
        assertFalse(isIndexed(momentId));
        assertFalse(searchHits(marker));
        assertEquals(eventsAfterTrash, eventCount(momentId), "重复回收不应再写一条 MomentChanged");

        changeStatus(admin, momentId, "PUBLISHED");
        assertEquals(200, detailStatus(momentId), "恢复后详情应重新可见");
        assertTrue(isIndexed(momentId),
                "恢复后活索引应存在，removed=" + removedAt(momentId) + " status=" + momentStatus(momentId));
        assertTrue(searchHits(marker), "恢复后搜索应命中");

        int eventsAfterRestore = eventCount(momentId);
        changeStatus(admin, momentId, "PUBLISHED");
        assertEquals(200, detailStatus(momentId));
        assertTrue(isIndexed(momentId));
        assertTrue(searchHits(marker));
        assertEquals(eventsAfterRestore, eventCount(momentId), "重复恢复不应再写一条 MomentChanged");
    }

    @Test
    @DisplayName("索引刷新失败时状态、事件和搜索行一起回滚，恢复调用后再次操作能够对齐")
    void indexFailureRollsBackStatusEventAndDocument() throws Exception {
        String token = registerAndLogin("p1afail");
        String marker = marker();
        String momentId = publishMoment(token, marker);
        drainReliableEvents();
        assertTrue(isIndexed(momentId));
        int eventsBefore = eventCount(momentId);
        String admin = adminToken();

        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("index refresh failed");
        }).when(searchIndexService).refresh(eq(SearchIndexService.MOMENT), eq(momentId));
        try {
            mockMvc.perform(patch("/api/v1/admin/operations/content/" + momentId + "/status")
                            .header("satoken", admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"type\":\"MOMENT\",\"status\":\"TRASHED\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(500))
                    .andExpect(jsonPath("$.message").value("index refresh failed"));
        } finally {
            doCallRealMethod().when(searchIndexService)
                    .refresh(eq(SearchIndexService.MOMENT), eq(momentId));
        }

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertTrue(isIndexed(momentId));
        assertEquals(eventsBefore, eventCount(momentId));
        assertEquals(200, detailStatus(momentId));
        assertTrue(searchHits(marker));

        changeStatus(admin, momentId, "TRASHED");
        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId));
        assertFalse(searchHits(marker));
        assertEquals(404, detailStatus(momentId));
    }

    @Test
    @DisplayName("并发回收和恢复结束后，动态状态与活索引一致")
    void concurrentTrashAndRestoreFinishConsistent() throws Exception {
        String token = registerAndLogin("p1arace");
        String momentId = publishMoment(token, marker());
        drainReliableEvents();
        assertTrue(isIndexed(momentId));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 12; round++) {
                CountDownLatch start = new CountDownLatch(1);
                Future<?> trash = pool.submit(() -> {
                    start.await();
                    momentService.applyOperationalStatus(momentId, "TRASHED");
                    return null;
                });
                Future<?> restore = pool.submit(() -> {
                    start.await();
                    momentService.applyOperationalStatus(momentId, "PUBLISHED");
                    return null;
                });
                start.countDown();
                trash.get(30, TimeUnit.SECONDS);
                restore.get(30, TimeUnit.SECONDS);
                assertConsistent(momentId);
            }
        } finally {
            pool.shutdownNow();
        }
        drainReliableEvents();
        assertConsistent(momentId);
    }

    @Test
    @DisplayName("状态更新、事件和索引刷新在同一未提交事务里，索引行锁会挡住提交")
    void statusEventAndIndexShareOneUncommittedTransaction() throws Exception {
        String token = registerAndLogin("p1asame");
        String momentId = publishMoment(token, marker());
        drainReliableEvents();
        assertTrue(isIndexed(momentId));
        normalizePooledLockWait();
        int eventsBefore = eventCount(momentId);

        ExecutorService one = Executors.newSingleThreadExecutor();
        try (Connection holder = dataSource.getConnection()) {
            holder.setAutoCommit(false);
            try (PreparedStatement lock = holder.prepareStatement(
                    "SELECT id FROM search_document WHERE object_type = 'MOMENT' AND object_id = ? FOR UPDATE")) {
                lock.setString(1, momentId);
                try (var rows = lock.executeQuery()) {
                    assertTrue(rows.next(), "发布后应已有搜索行可供加锁");
                }
            }
            Future<Boolean> call = one.submit(() -> momentService.applyOperationalStatus(momentId, "TRASHED"));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
            boolean momentLockHeld = false;
            while (System.nanoTime() < deadline && !call.isDone()) {
                momentLockHeld = momentRowLocked(momentId);
                if (momentLockHeld && "PUBLISHED".equals(momentStatus(momentId))) {
                    break;
                }
                Thread.sleep(50);
            }
            assertFalse(call.isDone(), "持有搜索行锁时，状态事务不能先提交");
            assertTrue(momentLockHeld, "等待索引锁期间，事务应仍持有动态行锁");
            assertEquals("PUBLISHED", momentStatus(momentId), "未提交的状态不能被其他连接读到");
            assertEquals(eventsBefore, eventCount(momentId), "未提交的 Outbox 事件不能被其他连接读到");
            assertTrue(isIndexed(momentId), "未提交的索引删除不能被其他连接读到");
            holder.rollback();
            assertEquals(Boolean.TRUE, call.get(15, TimeUnit.SECONDS));
        } finally {
            one.shutdownNow();
        }
        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId));
        assertTrue(eventCount(momentId) > eventsBefore);
    }

    @Test
    @DisplayName("FOR UPDATE 会挡住另一连接对同一动态行的更新")
    void forUpdateBlocksASecondWriter() throws Exception {
        String token = registerAndLogin("p1alock");
        String momentId = publishMoment(token, marker());
        try (Connection holder = dataSource.getConnection()) {
            holder.setAutoCommit(false);
            try (PreparedStatement lock = holder.prepareStatement(
                    "SELECT id FROM moment WHERE id = ? FOR UPDATE")) {
                lock.setString(1, momentId);
                try (var rows = lock.executeQuery()) {
                    assertTrue(rows.next());
                }
            }
            try (Connection waiter = dataSource.getConnection()) {
                try (Statement session = waiter.createStatement()) {
                    session.execute("SET SESSION innodb_lock_wait_timeout = 1");
                }
                try {
                    SQLException timeout = org.junit.jupiter.api.Assertions.assertThrows(SQLException.class, () -> {
                        try (PreparedStatement update = waiter.prepareStatement(
                                "UPDATE moment SET status = status WHERE id = ?")) {
                            update.setString(1, momentId);
                            update.executeUpdate();
                        }
                    });
                    assertEquals(1205, timeout.getErrorCode(), timeout.getMessage());
                } finally {
                    restoreLockWaitTimeout(waiter);
                }
            } finally {
                holder.rollback();
            }
        }
    }

    @Test
    @DisplayName("不存在的动态沿用内容不存在")
    void missingMomentKeepsTheExistingNotFoundResult() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/operations/content/missing-moment-p1a/status")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"MOMENT\",\"status\":\"TRASHED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value("内容不存在"));
    }

    @Test
    @DisplayName("旧快照中的消费者在管理端回收提交后保持索引删除")
    void staleSnapshotConsumerKeepsTrashedIndex() throws Exception {
        String token = registerAndLogin("p1asnap");
        String marker = marker();
        String momentId = publishMoment(token, marker);
        drainReliableEvents();
        assertTrue(isIndexed(momentId));
        requeueOldestMomentEvent(momentId, "PENDING", 0);

        runInStaleSnapshot(momentId, "PUBLISHED", "TRASHED");

        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId), "旧事件不能把已提交的删除覆盖回活索引");
        assertFalse(searchHits(marker));
        drainReliableEvents();
        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId));
    }

    @Test
    @DisplayName("旧快照中的消费者在管理端恢复提交后不会把索引标记删除")
    void staleSnapshotConsumerKeepsRestoredIndex() throws Exception {
        String token = registerAndLogin("p1aback");
        String marker = marker();
        String momentId = publishMoment(token, marker);
        drainReliableEvents();
        assertTrue(momentService.applyOperationalStatus(momentId, "TRASHED"));
        assertFalse(isIndexed(momentId));
        requeueOldestMomentEvent(momentId, "PENDING", 0);

        runInStaleSnapshot(momentId, "TRASHED", "PUBLISHED");

        assertEquals("PUBLISHED", momentStatus(momentId));
        assertTrue(isIndexed(momentId), "旧的回收事件不能把已恢复的索引再标删除");
        assertTrue(searchHits(marker));
        drainReliableEvents();
        assertEquals("PUBLISHED", momentStatus(momentId));
        assertTrue(isIndexed(momentId));
    }

    @Test
    @DisplayName("失败事件按已提交状态重试后索引仍然删除")
    void failedEventRetryKeepsTrashedIndex() throws Exception {
        String token = registerAndLogin("p1aretry");
        String momentId = publishMoment(token, marker());
        drainReliableEvents();
        assertTrue(momentService.applyOperationalStatus(momentId, "TRASHED"));
        assertFalse(isIndexed(momentId));
        requeueOldestMomentEvent(momentId, "FAILED", 1);

        runInStaleSnapshot(momentId, "TRASHED", null);

        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId));
        assertEquals("SUCCESS", oldestMomentEventStatus(momentId));
        drainReliableEvents();
        assertEquals("TRASHED", momentStatus(momentId));
        assertFalse(isIndexed(momentId));
    }

    private void runInStaleSnapshot(String momentId, String snapshotStatus, String adminStatus) throws Exception {
        CountDownLatch snapshotReady = new CountDownLatch(1);
        CountDownLatch adminDone = new CountDownLatch(1);
        ExecutorService one = Executors.newSingleThreadExecutor();
        try {
            Future<?> admin = one.submit(() -> {
                snapshotReady.await();
                try {
                    if (adminStatus != null) {
                        momentService.applyOperationalStatus(momentId, adminStatus);
                    }
                } finally {
                    adminDone.countDown();
                }
                return null;
            });
            TransactionTemplate template = new TransactionTemplate(transactionManager);
            template.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
            template.executeWithoutResult(tx -> {
                assertEquals(snapshotStatus, momentStatus(momentId));
                assertEquals("REPEATABLE-READ",
                        jdbcTemplate.queryForObject("SELECT @@transaction_isolation", String.class));
                snapshotReady.countDown();
                try {
                    assertTrue(adminDone.await(20, TimeUnit.SECONDS), "管理端事务没有在快照内完成");
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(ex);
                }
                assertEquals(snapshotStatus, momentStatus(momentId), "普通读应停在较早的快照");
                eventConsumer.poll();
            });
            admin.get(20, TimeUnit.SECONDS);
        } finally {
            one.shutdownNow();
        }
    }

    private void requeueOldestMomentEvent(String momentId, String status, int attempts) {
        int updated = jdbcTemplate.update(
                "UPDATE reliable_event SET status = ?, attempt_count = ?, next_attempt_at = '2000-01-01 00:00:00',"
                        + " lease_until = NULL, last_error = NULL"
                        + " WHERE aggregate_type = 'moment' AND aggregate_id = ? ORDER BY id LIMIT 1",
                status, attempts, momentId);
        assertEquals(1, updated);
    }

    private String oldestMomentEventStatus(String momentId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM reliable_event WHERE aggregate_type = 'moment' AND aggregate_id = ?"
                        + " ORDER BY id LIMIT 1",
                String.class, momentId);
    }

    private void assertConsistent(String momentId) {
        String status = momentStatus(momentId);
        if ("PUBLISHED".equals(status)) {
            assertTrue(isIndexed(momentId), "已发布动态必须有活索引");
        } else {
            assertEquals("TRASHED", status);
            assertFalse(isIndexed(momentId), "已回收动态不能留在活索引");
        }
    }

    private void changeStatus(String adminToken, String momentId, String status) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/operations/content/" + momentId + "/status")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"MOMENT\",\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    private int detailStatus(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
    }

    private boolean searchHits(String marker) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/search")
                        .param("q", marker)
                        .param("type", "MOMENT")
                        .param("sort", "latest")
                        .param("limit", "20"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode row : rows) {
            String summary = row.path("summary").asText("");
            String title = row.path("title").asText("");
            if (summary.contains(marker) || title.contains(marker)) {
                return true;
            }
        }
        return false;
    }

    private String publishMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
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

    private String removedAt(String momentId) {
        return jdbcTemplate.queryForObject(
                "SELECT CAST(removed_at AS CHAR) FROM search_document"
                        + " WHERE object_type = 'MOMENT' AND object_id = ?",
                String.class, momentId);
    }

    private boolean isIndexed(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document"
                        + " WHERE object_type = 'MOMENT' AND object_id = ? AND removed_at IS NULL",
                Integer.class, momentId);
        return count != null && count > 0;
    }

    private void normalizePooledLockWait() throws SQLException {
        if (!(dataSource instanceof DruidDataSource druid)) {
            return;
        }
        int idle = druid.getPoolingCount();
        Connection[] borrowed = new Connection[idle];
        int count = 0;
        try {
            for (; count < idle; count++) {
                borrowed[count] = dataSource.getConnection();
                restoreLockWaitTimeout(borrowed[count]);
            }
        } finally {
            for (int i = 0; i < count; i++) {
                borrowed[i].close();
            }
        }
    }

    private void restoreLockWaitTimeout(Connection connection) throws SQLException {
        try (Statement session = connection.createStatement()) {
            session.execute("SET SESSION innodb_lock_wait_timeout = @@GLOBAL.innodb_lock_wait_timeout");
        }
    }

    private boolean momentRowLocked(String momentId) throws SQLException {
        try (Connection waiter = dataSource.getConnection()) {
            try (Statement session = waiter.createStatement()) {
                session.execute("SET SESSION innodb_lock_wait_timeout = 1");
            }
            try {
                try (PreparedStatement query = waiter.prepareStatement(
                        "SELECT id FROM moment WHERE id = ? FOR UPDATE")) {
                    query.setString(1, momentId);
                    try (var rows = query.executeQuery()) {
                        return false;
                    }
                }
            } catch (SQLException ex) {
                if (ex.getErrorCode() == 1205) {
                    return true;
                }
                throw ex;
            } finally {
                restoreLockWaitTimeout(waiter);
            }
        }
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private int eventCount(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reliable_event WHERE aggregate_type = 'moment' AND aggregate_id = ?",
                Integer.class, momentId);
        return count == null ? 0 : count;
    }

    private static String marker() {
        return "p1a" + System.nanoTime();
    }
}

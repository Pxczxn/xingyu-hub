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
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 作者回收与搜索索引在同一事务里对齐。后台消费者被推迟，断言窗口结束后再显式 poll。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthorMomentTrashIndexConsistencyIntegrationTest {

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
    @DisplayName("作者回收后详情和活索引立即一致，消费者重放也不会写回")
    void authorTrashRemovesLiveIndexBeforeConsumer() throws Exception {
        String token = registerAndLogin("p31ok");
        String momentId = publishMoment(token, "可回收正文");
        drainReliableEvents();
        assertTrue(indexed(momentId));

        trash(token, momentId).andExpect(status().isOk());

        assertEquals("TRASHED", statusOf(momentId));
        assertEquals(404, detail(momentId));
        assertFalse(indexed(momentId));
        requeueOldest(momentId);
        eventConsumer.poll();
        assertEquals("TRASHED", statusOf(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("重复回收不新增事件，索引保持删除")
    void repeatTrashDoesNotEmitAnotherEvent() throws Exception {
        String token = registerAndLogin("p31rep");
        String momentId = publishMoment(token, "重复回收");
        drainReliableEvents();
        assertTrue(indexed(momentId));
        trash(token, momentId).andExpect(status().isOk());
        int events = eventCount(momentId);

        trash(token, momentId).andExpect(status().isOk());

        assertEquals("TRASHED", statusOf(momentId));
        assertEquals(events, eventCount(momentId));
        assertFalse(indexed(momentId));
        assertEquals(404, detail(momentId));
    }

    @Test
    @DisplayName("索引刷新失败时回收整体回滚")
    void indexFailureRollsBackTrash() throws Exception {
        String token = registerAndLogin("p31fail");
        String momentId = publishMoment(token, "索引失败");
        drainReliableEvents();
        assertTrue(indexed(momentId));
        int events = eventCount(momentId);
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new IllegalStateException("index refresh failed");
        }).when(searchIndexService).refresh(eq(SearchIndexService.MOMENT), eq(momentId));
        try {
            trash(token, momentId).andExpect(status().is5xxServerError());
        } finally {
            doCallRealMethod().when(searchIndexService)
                    .refresh(eq(SearchIndexService.MOMENT), eq(momentId));
        }

        assertEquals("PUBLISHED", statusOf(momentId));
        assertEquals(events, eventCount(momentId));
        assertTrue(indexed(momentId));
        assertEquals(200, detail(momentId));
    }

    @Test
    @DisplayName("治理隐藏的动态不能被作者回收改成 TRASHED")
    void hiddenMomentIsNotRewrittenAsTrashed() throws Exception {
        String token = registerAndLogin("p31hid");
        String momentId = publishMoment(token, "治理隐藏");
        jdbcTemplate.update("UPDATE moment SET status = 'HIDDEN' WHERE id = ?", momentId);
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = UTC_TIMESTAMP() WHERE object_type = 'MOMENT' AND object_id = ?",
                momentId);
        int events = eventCount(momentId);

        trash(token, momentId).andExpect(status().isConflict());

        assertEquals("HIDDEN", statusOf(momentId));
        assertEquals(events, eventCount(momentId));
        assertEquals(404, detail(momentId));
        assertFalse(indexed(momentId));
    }

    @Test
    @DisplayName("作者持有行锁写入新正文时，回收只改状态")
    void trashDoesNotOverwriteConcurrentRevision() throws Exception {
        String token = registerAndLogin("p31race");
        String momentId = publishMoment(token, "原始正文");
        drainReliableEvents();
        assertTrue(indexed(momentId));
        String authorId = jdbcTemplate.queryForObject(
                "SELECT author_id FROM moment WHERE id = ?", String.class, momentId);
        String body = "并发正文" + System.nanoTime();

        ExecutorService pool = Executors.newSingleThreadExecutor();
        Future<?> waiting = null;
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO moment_revision (id, moment_id, body, revision_number, created_at) VALUES (?, ?, ?, 2, UTC_TIMESTAMP())")) {
                statement.setString(1, UUID.randomUUID().toString());
                statement.setString(2, momentId);
                statement.setString(3, body);
                statement.executeUpdate();
            }
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE moment SET updated_at = UTC_TIMESTAMP() WHERE id = ?")) {
                statement.setString(1, momentId);
                statement.executeUpdate();
            }
            waiting = pool.submit(() -> {
                try {
                    trash(token, momentId).andExpect(status().isOk());
                } catch (Exception ex) {
                    throw new IllegalStateException(ex);
                }
            });
            long started = System.nanoTime();
            boolean blocked = false;
            while (!waiting.isDone() && System.nanoTime() - started < TimeUnit.SECONDS.toNanos(15)) {
                if (System.nanoTime() - started > TimeUnit.MILLISECONDS.toNanos(400)) {
                    blocked = true;
                    break;
                }
                Thread.sleep(40);
            }
            connection.commit();
            assertTrue(blocked, "回收没有停在作者未提交的行锁上");
            waiting.get(20, TimeUnit.SECONDS);
            waiting = null;
        } finally {
            if (waiting != null) {
                waiting.cancel(true);
            }
            pool.shutdownNow();
        }

        assertEquals("TRASHED", statusOf(momentId));
        assertEquals(body, jdbcTemplate.queryForObject(
                "SELECT body FROM moment_revision WHERE moment_id = ? ORDER BY revision_number DESC LIMIT 1",
                String.class, momentId));
        assertEquals(authorId, jdbcTemplate.queryForObject(
                "SELECT author_id FROM moment WHERE id = ?", String.class, momentId));
        assertFalse(indexed(momentId));
    }

    private org.springframework.test.web.servlet.ResultActions trash(String token, String momentId) throws Exception {
        return mockMvc.perform(post("/api/v1/moments/" + momentId + "/trash").header("satoken", token));
    }

    private void drainReliableEvents() {
        for (int round = 0; round < 8; round++) {
            Integer pending = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE status IN ('PENDING', 'FAILED')",
                    Integer.class);
            if (pending == null || pending == 0) {
                return;
            }
            eventConsumer.poll();
        }
    }

    private void requeueOldest(String momentId) {
        int updated = jdbcTemplate.update(
                "UPDATE reliable_event SET status = 'PENDING', attempt_count = 0, next_attempt_at = '2000-01-01 00:00:00',"
                        + " lease_until = NULL, last_error = NULL"
                        + " WHERE aggregate_type = 'moment' AND aggregate_id = ? ORDER BY id LIMIT 1",
                momentId);
        assertEquals(1, updated);
    }

    private String publishMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String registerAndLogin(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
        String email = username + "@example.com";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"Test1234!@#ab","termsVersion":"1.0"}
                                """.formatted(email, username)))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"Test1234!@#ab","rememberMe":false}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String statusOf(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private int detail(String momentId) throws Exception {
        return mockMvc.perform(get("/api/v1/moments/" + momentId)).andReturn().getResponse().getStatus();
    }

    private boolean indexed(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type = 'MOMENT' AND object_id = ? AND removed_at IS NULL",
                Integer.class, momentId);
        return count != null && count > 0;
    }

    private int eventCount(String momentId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM reliable_event WHERE aggregate_type = 'moment' AND aggregate_id = ?",
                Integer.class, momentId);
        return count == null ? 0 : count;
    }
}

package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 端到端：真实 consumer 能否把"认领后崩溃"留下的事件从 PROCESSING 中救回来。
 *
 * <p>与 {@link ReliableEventLeaseRecoveryIntegrationTest} 的分工：那个测试用 mock 隔离调度、
 * 逐条验证 SQL 语义（回收/隔离/fencing/并发）；这个测试不 mock，直接调用真实
 * {@link ReliableEventConsumer#poll()}，证明整条恢复链路能落到 SUCCESS。
 *
 * <p>fixture 用 {@code aggregateType=TEST} 的载荷：{@code SearchIndexEventHandler} 对不认识的
 * 聚合类型直接返回（不是错误路径），所以这里验证的是 outbox 自身的恢复，不牵扯索引业务。
 *
 * <p>关于并发：{@code @Scheduled} 每 5 秒也会 poll 一次。若它抢在手动 poll 之前处理，
 * 结果同样是 SUCCESS（幂等）；若两者同时处理，条件更新保证只有一方生效。断言不依赖谁先跑。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ReliableEventRecoveryEndToEndIntegrationTest {

    private static final String PREFIX = "evt-e2e-";

    @Autowired
    private ReliableEventConsumer consumer;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        cleanup();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    @Test
    void crashedClaimIsRecoveredAndCompletedByTheRealConsumer() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        // A worker claimed this row and died before writing any outcome.
        long id = insert("crash", "PROCESSING", 0, 5, now.minusSeconds(120));
        assertEquals("PROCESSING", statusOf(id));

        // First poll: the expired lease is reclaimed. The reclaimed row keeps a deliberate
        // backoff (RECLAIM_RETRY_SECONDS) so a crash loop cannot spin every poll.
        consumer.poll();
        assertEquals("FAILED", statusOf(id),
                "过期租约必须被回收；修复前该行会永久停在 PROCESSING");
        assertNull(leaseOf(id), "回收后必须释放租约");
        assertEquals(1, attemptOf(id), "崩溃只应记一次尝试");

        // Second poll after the backoff passes: the normal retry path finishes the event.
        jdbcTemplate.update(
                "UPDATE reliable_event SET next_attempt_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().truncatedTo(ChronoUnit.SECONDS)), id);
        consumer.poll();

        assertEquals("SUCCESS", statusOf(id), "退避到期后必须能被重新认领并完成");
        assertNull(leaseOf(id), "完成后必须释放租约");
        assertEquals(1, attemptOf(id), "成功路径不额外消耗尝试次数");
    }

    @Test
    void crashLoopIsBoundedAndEndsIsolatedByTheRealConsumer() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        // Already at the attempt ceiling: another lease expiry must not requeue it.
        long id = insert("crashloop", "PROCESSING", 4, 5, now.minusSeconds(120));

        consumer.poll();

        assertEquals("ISOLATED", statusOf(id), "反复崩溃的事件必须被隔离，而不是无限重试");
        assertNull(leaseOf(id));
        assertEquals(5, attemptOf(id));
    }

    private long insert(String suffix, String status, int attemptCount, int maxAttempts, Instant leaseUntil) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        String eventId = PREFIX + suffix + "-" + System.nanoTime();
        // Minimal envelope: only eventVersion is read by the consumer; a null aggregateType
        // makes every handler ignore the event, so the test measures the outbox, not the index.
        jdbcTemplate.update("""
                INSERT INTO reliable_event (event_id, event_type, aggregate_type, aggregate_id, payload,
                  status, attempt_count, max_attempts, next_attempt_at, lease_until, last_error,
                  created_at, updated_at)
                VALUES (?, 'test.lease', 'TEST', 'agg-e2e', '{"eventVersion":1}', ?, ?, ?, NULL, ?, NULL, ?, ?)
                """,
                eventId, status, attemptCount, maxAttempts,
                Timestamp.from(leaseUntil), Timestamp.from(now), Timestamp.from(now));
        return jdbcTemplate.queryForObject(
                "SELECT id FROM reliable_event WHERE event_id = ?", Long.class, eventId);
    }

    private void cleanup() {
        jdbcTemplate.update("DELETE FROM reliable_event WHERE event_id LIKE ?", PREFIX + "%");
    }

    private String statusOf(long id) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM reliable_event WHERE id = ?", String.class, id);
    }

    private int attemptOf(long id) {
        Integer value = jdbcTemplate.queryForObject(
                "SELECT attempt_count FROM reliable_event WHERE id = ?", Integer.class, id);
        return value == null ? -1 : value;
    }

    private Instant leaseOf(long id) {
        Timestamp value = jdbcTemplate.queryForObject(
                "SELECT lease_until FROM reliable_event WHERE id = ?", Timestamp.class, id);
        return value == null ? null : value.toInstant();
    }
}

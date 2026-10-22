package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.core.event.ReliableEvent;
import top.pxczxn.xingyu.core.event.ReliableEventConsumer;
import top.pxczxn.xingyu.core.event.ReliableEventMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 可靠事件租约恢复（Outbox lease recovery）。
 *
 * <p>背景：{@code findClaimable} / {@code claim} 只接受 PENDING/FAILED，而 claim 后写
 * PROCESSING。进程在认领后崩溃时，租约过期也不会有人回收该行 —— 事件永久滞留。
 * 本测试锁定修复后的三条真实 SQL 语义（跑真实 MySQL，不是 mock）：
 * <ol>
 *   <li>过期租约被回收为 FAILED 且可再次认领；未过期租约保持不动；</li>
 *   <li>超限的过期租约直接 ISOLATED，不会无限重试；</li>
 *   <li>outcome 写入以 lease 为栅栏：旧 worker 的结果被丢弃，不会覆盖新 owner。</li>
 * </ol>
 *
 * <p>真实消费由 {@link ReliableEventConsumer} 的定时任务驱动；这里把它替换为 mock，
 * 让测试自己控制"何时回收、何时认领"，否则后台 5 秒一次的 poll 会与断言竞争。
 * 验证边界：这证明的是数据库条件更新与 mapper 契约；不证明 handler 的业务副作用幂等
 * （outbox 是 at-least-once，崩溃恢复后 handler 可能被重跑一次）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ReliableEventLeaseRecoveryIntegrationTest {

    private static final String PREFIX = "evtrec-";

    @Autowired
    private ReliableEventMapper eventMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** 阻止真实调度线程在断言中途消费/回收 fixture，测试自己驱动每一步。 */
    @MockBean
    private ReliableEventConsumer consumer;

    @BeforeEach
    void setUp() {
        cleanup();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    @Test
    void expiredLeaseIsReclaimedAndClaimableAgain() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("reclaim", "PROCESSING", 0, 5, now.minusSeconds(120));
        Instant staleLease = leaseOf(id);
        assertNotNull(staleLease, "fixture 必须带上已过期租约");

        int reclaimed = eventMapper.reclaimExpiredLeases(now, now.plusSeconds(60));
        assertEquals(1, reclaimed, "过期租约必须被回收（修复前为 0，事件永久卡死）");

        assertEquals("FAILED", statusOf(id));
        assertEquals(1, attemptOf(id), "回收必须记一次尝试，避免崩溃循环无限重试");
        assertNull(leaseOf(id), "回收后必须清空租约");
        assertNotNull(nextAttemptAtOf(id), "回收后必须设置重试时间");

        List<ReliableEvent> claimable = eventMapper.findClaimable(now.plusSeconds(61), 50);
        assertTrue(claimable.stream().anyMatch(e -> e.getId().equals(id)),
                "回收后的事件必须重新进入可认领集合");

        Instant newLease = now.plusSeconds(90);
        assertEquals(1, eventMapper.claim(id, newLease, now.plusSeconds(61)),
                "回收后的事件必须能被重新认领");
        assertEquals("PROCESSING", statusOf(id));
        assertEquals(newLease.getEpochSecond(), leaseOf(id).getEpochSecond());
    }

    @Test
    void activeLeaseIsLeftAlone() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("active", "PROCESSING", 1, 5, now.plusSeconds(120));

        assertEquals(0, eventMapper.reclaimExpiredLeases(now, now.plusSeconds(60)));
        assertEquals(0, eventMapper.isolateExpiredLeases(now));
        assertEquals("PROCESSING", statusOf(id));
        assertEquals(1, attemptOf(id));
    }

    @Test
    void expiredLeaseAtMaxAttemptsIsIsolated() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("isolate", "PROCESSING", 4, 5, now.minusSeconds(120));

        assertEquals(0, eventMapper.reclaimExpiredLeases(now, now.plusSeconds(60)),
                "已用完尝试次数的事件不得被再次排队");
        assertEquals(1, eventMapper.isolateExpiredLeases(now));

        assertEquals("ISOLATED", statusOf(id));
        assertEquals(5, attemptOf(id));
        assertNull(leaseOf(id));
        assertNull(nextAttemptAtOf(id));
    }

    @Test
    void staleWorkerCannotOverwriteTheNewOwner() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("fence", "PROCESSING", 0, 5, now.minusSeconds(120));
        Instant staleLease = leaseOf(id);

        // 模拟恢复：回收 → 新 worker 认领。
        assertEquals(1, eventMapper.reclaimExpiredLeases(now, now.plusSeconds(60)));
        Instant newLease = now.plusSeconds(90);
        assertEquals(1, eventMapper.claim(id, newLease, now.plusSeconds(61)));
        Instant ownedLease = leaseOf(id);

        ReliableEvent staleSuccess = outcome(id, "SUCCESS", 1, now);
        assertEquals(0, eventMapper.updateOutcome(staleSuccess, staleLease),
                "旧租约的结果必须被栅栏拒绝");
        assertEquals("PROCESSING", statusOf(id), "旧 worker 不得改变行状态");

        assertEquals(0, eventMapper.updateOutcome(staleSuccess, staleLease.plusSeconds(3600)),
                "任何非当前租约都必须被拒绝");

        ReliableEvent currentSuccess = outcome(id, "SUCCESS", 1, now);
        assertEquals(1, eventMapper.updateOutcome(currentSuccess, ownedLease),
                "当前 owner 的写入必须成功");
        assertEquals("SUCCESS", statusOf(id));
        assertNull(leaseOf(id));
    }

    @Test
    void concurrentClaimsProduceExactlyOneOwner() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("concurrent", "PENDING", 0, 5, null);
        Instant lease = now.plusSeconds(30);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = List.of(
                    pool.submit(() -> claimAfter(start, id, lease, now)),
                    pool.submit(() -> claimAfter(start, id, lease, now)));
            start.countDown();
            int winners = futures.get(0).get(30, TimeUnit.SECONDS)
                    + futures.get(1).get(30, TimeUnit.SECONDS);
            assertEquals(1, winners, "同一事件并发认领只能有一个 worker 成功");
        } finally {
            pool.shutdownNow();
        }
        assertEquals("PROCESSING", statusOf(id));
        assertEquals(lease.getEpochSecond(), leaseOf(id).getEpochSecond());
    }

    @Test
    void concurrentReclaimsCountTheCrashOnlyOnce() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        long id = insert("concurrent-reclaim", "PROCESSING", 0, 5, now.minusSeconds(120));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = List.of(
                    pool.submit(() -> reclaimAfter(start, now)),
                    pool.submit(() -> reclaimAfter(start, now)));
            start.countDown();
            int total = futures.get(0).get(30, TimeUnit.SECONDS)
                    + futures.get(1).get(30, TimeUnit.SECONDS);
            assertEquals(1, total, "两路并发回收对同一行只能生效一次");
        } finally {
            pool.shutdownNow();
        }
        assertEquals("FAILED", statusOf(id));
        assertEquals(1, attemptOf(id), "并发回收不得把同一次崩溃记成两次尝试");
    }

    // ---- fixtures ----

    private int claimAfter(CountDownLatch start, long id, Instant lease, Instant now) throws Exception {
        start.await(10, TimeUnit.SECONDS);
        return eventMapper.claim(id, lease, now);
    }

    private int reclaimAfter(CountDownLatch start, Instant now) throws Exception {
        start.await(10, TimeUnit.SECONDS);
        return eventMapper.reclaimExpiredLeases(now, now.plusSeconds(60));
    }

    private static ReliableEvent outcome(long id, String status, int attemptCount, Instant now) {
        ReliableEvent event = new ReliableEvent();
        event.setId(id);
        event.setStatus(status);
        event.setAttemptCount(attemptCount);
        event.setUpdatedAt(now);
        return event;
    }

    /**
     * 插入一条事件 fixture。时间一律整秒，与 MySQL {@code timestamp} 精度一致。
     */
    private long insert(String suffix, String status, int attemptCount, int maxAttempts, Instant leaseUntil) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        String eventId = PREFIX + suffix + "-" + System.nanoTime();
        jdbcTemplate.update("""
                INSERT INTO reliable_event (event_id, event_type, aggregate_type, aggregate_id, payload,
                  status, attempt_count, max_attempts, next_attempt_at, lease_until, last_error,
                  created_at, updated_at)
                VALUES (?, 'test.lease', 'TEST', 'agg-1', '{}', ?, ?, ?, NULL, ?, NULL, ?, ?)
                """,
                eventId, status, attemptCount, maxAttempts,
                timestamp(leaseUntil), timestamp(now), timestamp(now));
        return jdbcTemplate.queryForObject(
                "SELECT id FROM reliable_event WHERE event_id = ?", Long.class, eventId);
    }

    private void cleanup() {
        jdbcTemplate.update("DELETE FROM reliable_event WHERE event_id LIKE ?", PREFIX + "%");
    }

    private static Timestamp timestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    // ---- probes ----

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

    private Instant nextAttemptAtOf(long id) {
        Timestamp value = jdbcTemplate.queryForObject(
                "SELECT next_attempt_at FROM reliable_event WHERE id = ?", Timestamp.class, id);
        return value == null ? null : value.toInstant();
    }
}

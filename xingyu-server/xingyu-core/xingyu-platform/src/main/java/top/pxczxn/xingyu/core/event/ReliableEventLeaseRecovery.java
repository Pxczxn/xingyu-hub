package top.pxczxn.xingyu.core.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * 过期租约回收：把崩溃 worker 留下的 PROCESSING 行重新排队或隔离。
 *
 * <p>两条语句都是幂等的条件更新，所以并发 poller 的“输家”本应影响 0 行。但 InnoDB 在并发
 * UPDATE 同一批行时仍可能选出死锁牺牲者并抛 {@link PessimisticLockingFailureException}；
 * 对调度线程来说这是可恢复的瞬时冲突，不是业务失败。这里做有限次退避重试：
 * 条件更新可以安全重放，重试后要么生效一次，要么看到对方已改完而影响 0 行。
 *
 * <p>只重试锁冲突，不吞掉其他异常；重试耗尽后仍抛出最后一次冲突，避免掩盖持续性问题。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReliableEventLeaseRecovery {

    /** 首次尝试 + 两次重试；足够跨过瞬时死锁，又不会让一次 poll 长时间卡住。 */
    static final int MAX_ATTEMPTS = 3;

    static final long RETRY_BACKOFF_MILLIS = 10L;

    private final ReliableEventMapper eventMapper;

    /** 回收已过期且仍有重试预算的租约，返回实际影响行数。 */
    public int reclaimExpiredLeases(Instant now) {
        Instant retryAt = now.plusSeconds(ReliableEventConsumer.RECLAIM_RETRY_SECONDS)
                .truncatedTo(ChronoUnit.SECONDS);
        return withLockRetry("reclaimExpiredLeases",
                () -> eventMapper.reclaimExpiredLeases(now, retryAt));
    }

    /** 隔离已过期且用完重试预算的租约，返回实际影响行数。 */
    public int isolateExpiredLeases(Instant now) {
        return withLockRetry("isolateExpiredLeases",
                () -> eventMapper.isolateExpiredLeases(now));
    }

    private <T> T withLockRetry(String operation, Supplier<T> action) {
        PessimisticLockingFailureException lastConflict = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return action.get();
            } catch (PessimisticLockingFailureException conflict) {
                lastConflict = conflict;
                if (attempt == MAX_ATTEMPTS) {
                    break;
                }
                log.warn("reliable event lease recovery {} hit a lock conflict, retrying ({}/{})",
                        operation, attempt, MAX_ATTEMPTS);
                try {
                    Thread.sleep(RETRY_BACKOFF_MILLIS * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw conflict;
                }
            }
        }
        throw Objects.requireNonNull(lastConflict, "lock conflict retry exhausted without cause");
    }
}

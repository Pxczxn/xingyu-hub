package top.pxczxn.xingyu.core.event;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.List;

@Mapper
public interface ReliableEventMapper {

    @Insert("""
            INSERT INTO reliable_event (
              event_id, event_type, aggregate_type, aggregate_id, payload,
              status, attempt_count, max_attempts, created_at, updated_at
            ) VALUES (
              #{eventId}, #{eventType}, #{aggregateType}, #{aggregateId}, #{payload},
              #{status}, #{attemptCount}, #{maxAttempts}, #{createdAt}, #{updatedAt}
            )
            """)
    int insert(ReliableEvent event);

    @Select("SELECT * FROM reliable_event WHERE event_id = #{eventId} LIMIT 1")
    ReliableEvent findByEventId(String eventId);

    @Select("""
            SELECT * FROM reliable_event
            WHERE status IN ('PENDING', 'FAILED')
              AND attempt_count < max_attempts
              AND (next_attempt_at IS NULL OR next_attempt_at <= #{now})
              AND (lease_until IS NULL OR lease_until < #{now})
            ORDER BY id
            LIMIT #{limit}
            """)
    List<ReliableEvent> findClaimable(@Param("now") Instant now, @Param("limit") int limit);

    @Update("""
            UPDATE reliable_event
            SET status = 'PROCESSING', lease_until = #{leaseUntil}, updated_at = #{now}
            WHERE id = #{id}
              AND status IN ('PENDING', 'FAILED')
              AND (lease_until IS NULL OR lease_until < #{now})
            """)
    int claim(@Param("id") Long id, @Param("leaseUntil") Instant leaseUntil, @Param("now") Instant now);

    /**
     * Fenced outcome write.
     *
     * <p>The {@code lease_until} predicate is what keeps a worker that overran its lease from
     * overwriting the worker that took the row over: the stale worker's claim value no longer
     * matches, so the update affects 0 rows and its result must be discarded.
     */
    @Update("""
            UPDATE reliable_event
            SET status = #{event.status},
                attempt_count = #{event.attemptCount},
                next_attempt_at = #{event.nextAttemptAt},
                lease_until = NULL,
                last_error = #{event.lastError},
                updated_at = #{event.updatedAt}
            WHERE id = #{event.id}
              AND lease_until = #{leaseUntil}
            """)
    int updateOutcome(@Param("event") ReliableEvent event, @Param("leaseUntil") Instant leaseUntil);

    /**
     * Lease recovery for a worker that died holding a claim (process crash, kill, host loss).
     *
     * <p>Without this, a row left in PROCESSING after its lease expired is invisible to both
     * {@link #findClaimable} and {@link #claim}, which only accept PENDING/FAILED, so it would
     * stay stuck forever. Demoting it back to FAILED reuses the existing retry path
     * (next_attempt_at gates the next poll). The attempt is counted on purpose: a handler that
     * keeps killing the process is bounded by max_attempts instead of looping forever.
     *
     * <p>{@code attempt_count + 1 < max_attempts} is the boundary with
     * {@link #isolateExpiredLeases}; the two statements are complementary, not ordered, and each
     * is an idempotent conditional update — a second poller arrives after lease_until = NULL and
     * matches nothing.
     */
    @Update("""
            UPDATE reliable_event
            SET status = 'FAILED',
                attempt_count = attempt_count + 1,
                next_attempt_at = #{retryAt},
                lease_until = NULL,
                last_error = 'lease expired before processing completed',
                updated_at = #{now}
            WHERE status = 'PROCESSING'
              AND lease_until IS NOT NULL
              AND lease_until < #{now}
              AND attempt_count + 1 < max_attempts
            """)
    int reclaimExpiredLeases(@Param("now") Instant now, @Param("retryAt") Instant retryAt);

    /**
     * Expired lease whose attempt budget is already exhausted — the crash-loop case. The row is
     * isolated (operator-visible) rather than re-queued, so it cannot wedge the outbox.
     */
    @Update("""
            UPDATE reliable_event
            SET status = 'ISOLATED',
                attempt_count = attempt_count + 1,
                next_attempt_at = NULL,
                lease_until = NULL,
                last_error = 'lease expired; max attempts reached',
                updated_at = #{now}
            WHERE status = 'PROCESSING'
              AND lease_until IS NOT NULL
              AND lease_until < #{now}
              AND attempt_count + 1 >= max_attempts
            """)
    int isolateExpiredLeases(@Param("now") Instant now);

    /**
     * How many events sit in a given status — the backlog / dead-letter read behind the
     * index health view. Read-only and unbounded on purpose: an operator needs the real
     * number, not a sample.
     */
    @Select("SELECT COUNT(*) FROM reliable_event WHERE status = #{status}")
    long countByStatus(String status);
}

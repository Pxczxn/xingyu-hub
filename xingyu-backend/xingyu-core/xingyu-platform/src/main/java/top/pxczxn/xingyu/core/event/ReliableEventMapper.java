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

    @Update("""
            UPDATE reliable_event
            SET status = #{status},
                attempt_count = #{attemptCount},
                next_attempt_at = #{nextAttemptAt},
                lease_until = NULL,
                last_error = #{lastError},
                updated_at = #{updatedAt}
            WHERE id = #{id}
            """)
    int updateOutcome(ReliableEvent event);
}

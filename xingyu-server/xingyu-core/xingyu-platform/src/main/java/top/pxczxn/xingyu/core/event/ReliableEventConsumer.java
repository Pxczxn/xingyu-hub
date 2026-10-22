package top.pxczxn.xingyu.core.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.ConsumeDecision;
import top.pxczxn.xingyu.common.contract.EventEnvelope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReliableEventConsumer {

    static final int LEASE_SECONDS = 30;
    static final int BATCH_SIZE = 20;
    static final int CONSUMER_SCHEMA_VERSION = 1;
    /**
     * Delay before a reclaimed event is eligible again. Long enough for the crashed process to
     * be gone, short enough that a crash is not a multi-minute outage for the projection.
     */
    static final int RECLAIM_RETRY_SECONDS = 60;

    private final ReliableEventMapper eventMapper;
    private final ObjectMapper objectMapper;
    private final List<ReliableEventHandler> handlers;

    @Scheduled(fixedDelayString = "${xingyu.event.consumer.delay-ms:5000}")
    public void poll() {
        Instant now = Instant.now();
        reclaimExpiredLeases(now);
        // MySQL `timestamp` keeps whole seconds. The SAME truncated value is handed to claim and
        // to the outcome write, otherwise the fencing equality (lease_until = ?) could never
        // match what the database actually stored.
        Instant leaseUntil = now.plusSeconds(LEASE_SECONDS).truncatedTo(ChronoUnit.SECONDS);
        for (ReliableEvent event : eventMapper.findClaimable(now, BATCH_SIZE)) {
            if (eventMapper.claim(event.getId(), leaseUntil, now) == 0) {
                continue;
            }
            processClaimed(event, leaseUntil);
        }
    }

    /**
     * Recovery step for claims abandoned by a dead worker.
     *
     * <p>Runs before reading claimable rows so a crash from an earlier poll is repaired even
     * when the rest of the batch is empty. Both statements are conditional updates, so running
     * them from two pollers concurrently is safe; the loser affects 0 rows.
     */
    void reclaimExpiredLeases(Instant now) {
        int isolated = eventMapper.isolateExpiredLeases(now);
        int reclaimed = eventMapper.reclaimExpiredLeases(
                now,
                now.plusSeconds(RECLAIM_RETRY_SECONDS).truncatedTo(ChronoUnit.SECONDS));
        if (isolated > 0 || reclaimed > 0) {
            log.warn("reliable event lease recovery: reclaimed={} isolated={}", reclaimed, isolated);
        }
    }

    void processClaimed(ReliableEvent event, Instant leaseUntil) {
        Instant now = Instant.now();
        try {
            EventEnvelope envelope = objectMapper.readValue(event.getPayload(), EventEnvelope.class);
            ConsumeDecision decision = ConsumeDecision.forEventVersion(
                    CONSUMER_SCHEMA_VERSION, envelope.getEventVersion());
            if (decision == ConsumeDecision.ISOLATE) {
                markIsolated(event, now, "unknown event version: " + envelope.getEventVersion(), leaseUntil);
                return;
            }
            for (ReliableEventHandler handler : handlers) {
                handler.handle(envelope, event.getPayload());
            }
            event.setStatus(ReliableEventStatus.SUCCESS.name());
            event.setAttemptCount(event.getAttemptCount());
            event.setNextAttemptAt(null);
            event.setLastError(null);
            event.setUpdatedAt(now);
            applyOutcome(event, leaseUntil);
        } catch (Exception ex) {
            int attempts = event.getAttemptCount() + 1;
            event.setAttemptCount(attempts);
            event.setLastError(truncate(ex.getMessage()));
            event.setUpdatedAt(now);
            if (attempts >= event.getMaxAttempts()) {
                markIsolated(event, now, event.getLastError(), leaseUntil);
            } else {
                event.setStatus(ReliableEventStatus.FAILED.name());
                event.setNextAttemptAt(now.plus(attempts, ChronoUnit.MINUTES));
                applyOutcome(event, leaseUntil);
            }
            log.warn("reliable event {} failed attempt {}: {}", event.getEventId(), attempts, ex.getMessage());
        }
    }

    private void markIsolated(ReliableEvent event, Instant now, String reason, Instant leaseUntil) {
        event.setStatus(ReliableEventStatus.ISOLATED.name());
        event.setLastError(truncate(reason));
        event.setUpdatedAt(now);
        applyOutcome(event, leaseUntil);
    }

    /**
     * Writes the outcome only while this worker still owns the row.
     *
     * <p>0 affected rows means the lease was reclaimed (or the row was already finished). The
     * result is deliberately dropped instead of retried: the current owner has the latest state,
     * and re-applying a stale outcome is exactly the corruption the fence exists to prevent.
     */
    private void applyOutcome(ReliableEvent event, Instant leaseUntil) {
        if (eventMapper.updateOutcome(event, leaseUntil) == 0) {
            log.warn("reliable event {} outcome discarded: lease {} is no longer owned",
                    event.getEventId(), leaseUntil);
        }
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 2000 ? value : value.substring(0, 2000);
    }
}

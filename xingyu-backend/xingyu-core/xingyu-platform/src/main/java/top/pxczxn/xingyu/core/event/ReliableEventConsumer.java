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

    private final ReliableEventMapper eventMapper;
    private final ObjectMapper objectMapper;
    private final List<ReliableEventHandler> handlers;

    @Scheduled(fixedDelayString = "${xingyu.event.consumer.delay-ms:5000}")
    public void poll() {
        Instant now = Instant.now();
        for (ReliableEvent event : eventMapper.findClaimable(now, BATCH_SIZE)) {
            if (eventMapper.claim(event.getId(), now.plus(LEASE_SECONDS, ChronoUnit.SECONDS), now) == 0) {
                continue;
            }
            processClaimed(event);
        }
    }

    void processClaimed(ReliableEvent event) {
        Instant now = Instant.now();
        try {
            EventEnvelope envelope = objectMapper.readValue(event.getPayload(), EventEnvelope.class);
            ConsumeDecision decision = ConsumeDecision.forEventVersion(
                    CONSUMER_SCHEMA_VERSION, envelope.getEventVersion());
            if (decision == ConsumeDecision.ISOLATE) {
                markIsolated(event, now, "unknown event version: " + envelope.getEventVersion());
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
            eventMapper.updateOutcome(event);
        } catch (Exception ex) {
            int attempts = event.getAttemptCount() + 1;
            event.setAttemptCount(attempts);
            event.setLastError(truncate(ex.getMessage()));
            event.setUpdatedAt(now);
            if (attempts >= event.getMaxAttempts()) {
                markIsolated(event, now, event.getLastError());
            } else {
                event.setStatus(ReliableEventStatus.FAILED.name());
                event.setNextAttemptAt(now.plus(attempts, ChronoUnit.MINUTES));
                eventMapper.updateOutcome(event);
            }
            log.warn("reliable event {} failed attempt {}: {}", event.getEventId(), attempts, ex.getMessage());
        }
    }

    private void markIsolated(ReliableEvent event, Instant now, String reason) {
        event.setStatus(ReliableEventStatus.ISOLATED.name());
        event.setLastError(truncate(reason));
        event.setUpdatedAt(now);
        eventMapper.updateOutcome(event);
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 2000 ? value : value.substring(0, 2000);
    }
}

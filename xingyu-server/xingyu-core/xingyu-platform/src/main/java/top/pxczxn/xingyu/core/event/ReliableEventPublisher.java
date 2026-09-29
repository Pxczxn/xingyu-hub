package top.pxczxn.xingyu.core.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.common.contract.EventEnvelope;
import top.pxczxn.xingyu.common.contract.InstantUtc;
import top.pxczxn.xingyu.common.contract.ObjectId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class ReliableEventPublisher {

    public static final int DEFAULT_MAX_ATTEMPTS = 5;

    private final ReliableEventMapper eventMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public void publish(EventEnvelope envelope, String payloadJson) {
        Instant now = Instant.now();
        ReliableEvent row = new ReliableEvent();
        row.setEventId(envelope.getEventId());
        row.setEventType(envelope.getEventType());
        row.setAggregateType(envelope.getAggregateType());
        row.setAggregateId(envelope.getAggregateId().value());
        row.setPayload(payloadJson);
        row.setStatus(ReliableEventStatus.PENDING.name());
        row.setAttemptCount(0);
        row.setMaxAttempts(DEFAULT_MAX_ATTEMPTS);
        row.setCreatedAt(now);
        row.setUpdatedAt(now);
        if (eventMapper.findByEventId(envelope.getEventId()) != null) {
            return;
        }
        eventMapper.insert(row);
    }

    public EventEnvelope envelope(
            String eventId,
            String eventType,
            int eventVersion,
            String aggregateType,
            ObjectId aggregateId,
            String correlationId,
            String causationId,
            int consumerSchemaVersion) {
        return EventEnvelope.builder()
                .eventId(eventId)
                .eventType(eventType)
                .eventVersion(eventVersion)
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .occurredAt(InstantUtc.now())
                .correlationId(correlationId)
                .causationId(causationId)
                .consumerSchemaVersion(consumerSchemaVersion)
                .build();
    }

    public String toJson(EventEnvelope envelope) throws Exception {
        return objectMapper.writeValueAsString(envelope);
    }
}

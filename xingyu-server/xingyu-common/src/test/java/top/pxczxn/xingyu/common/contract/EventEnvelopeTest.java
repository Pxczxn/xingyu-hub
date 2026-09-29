package top.pxczxn.xingyu.common.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EventEnvelopeTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void serializesWithoutBodyOrCredentials() throws Exception {
        EventEnvelope envelope = EventEnvelope.builder()
                .eventId("evt-1")
                .eventType("article.revision.submitted")
                .eventVersion(1)
                .aggregateType("article")
                .aggregateId(ObjectId.of("f37ad3a9-b5d7-4625-b7b9-189512886403"))
                .occurredAt(InstantUtc.parse("2026-08-25T12:00:00Z"))
                .correlationId("corr-1")
                .causationId("cause-1")
                .consumerSchemaVersion(1)
                .build();

        JsonNode json = mapper.readTree(mapper.writeValueAsString(envelope));
        assertEquals("evt-1", json.get("eventId").asText());
        assertFalse(json.has("body"));
        assertFalse(json.has("password"));
        assertFalse(json.has("token"));
    }

    @Test
    void unknownVersionIsolates() {
        assertEquals(ConsumeDecision.ISOLATE, ConsumeDecision.forEventVersion(1, 3));
        assertEquals(ConsumeDecision.ACCEPT, ConsumeDecision.forEventVersion(1, 1));
        assertEquals(ConsumeDecision.ACCEPT, ConsumeDecision.forEventVersion(1, 2));
    }
}

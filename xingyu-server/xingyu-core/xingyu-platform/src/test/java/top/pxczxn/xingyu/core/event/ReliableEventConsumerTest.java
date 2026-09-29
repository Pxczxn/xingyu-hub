package top.pxczxn.xingyu.core.event;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReliableEventConsumerTest {

    @Mock
    private ReliableEventMapper eventMapper;

    @Mock
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Mock
    private java.util.List<ReliableEventHandler> handlers;

    @InjectMocks
    private ReliableEventConsumer consumer;

    @Test
    void exhaustedAttemptsMarkIsolated() throws Exception {
        ReliableEvent event = new ReliableEvent();
        event.setId(1L);
        event.setEventId("evt-1");
        event.setAttemptCount(4);
        event.setMaxAttempts(5);
        event.setPayload("{\"eventId\":\"evt-1\",\"eventVersion\":1}");
        when(objectMapper.readValue(event.getPayload(), top.pxczxn.xingyu.common.contract.EventEnvelope.class))
                .thenThrow(new RuntimeException("handler failed"));

        consumer.processClaimed(event);

        ArgumentCaptor<ReliableEvent> captor = ArgumentCaptor.forClass(ReliableEvent.class);
        verify(eventMapper).updateOutcome(captor.capture());
        assertEquals(ReliableEventStatus.ISOLATED.name(), captor.getValue().getStatus());
        assertEquals(5, captor.getValue().getAttemptCount());
    }
}

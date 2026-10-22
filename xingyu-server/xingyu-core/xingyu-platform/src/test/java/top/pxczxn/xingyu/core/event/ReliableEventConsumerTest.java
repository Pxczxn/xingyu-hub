package top.pxczxn.xingyu.core.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import top.pxczxn.xingyu.common.contract.EventEnvelope;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReliableEventConsumerTest {

    @Mock
    private ReliableEventMapper eventMapper;

    @Mock
    private ObjectMapper objectMapper;

    private ReliableEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new ReliableEventConsumer(eventMapper, objectMapper, List.of());
    }

    @Test
    void pollReclaimsExpiredLeasesBeforeReadingClaimable() {
        when(eventMapper.findClaimable(any(), anyInt())).thenReturn(List.of());

        consumer.poll();

        InOrder order = inOrder(eventMapper);
        order.verify(eventMapper).isolateExpiredLeases(any());
        order.verify(eventMapper).reclaimExpiredLeases(any(), any());
        order.verify(eventMapper).findClaimable(any(), eq(ReliableEventConsumer.BATCH_SIZE));
    }

    @Test
    void claimCollisionSkipsProcessing() {
        when(eventMapper.findClaimable(any(), anyInt())).thenReturn(List.of(event()));
        when(eventMapper.claim(anyLong(), any(), any())).thenReturn(0);

        consumer.poll();

        verify(eventMapper, never()).updateOutcome(any(), any());
    }

    @Test
    void claimedLeaseIsWholeSecondAndFencesTheOutcome() throws Exception {
        ReliableEvent event = event();
        when(eventMapper.findClaimable(any(), anyInt())).thenReturn(List.of(event));
        when(eventMapper.claim(anyLong(), any(), any())).thenReturn(1);
        when(objectMapper.readValue(anyString(), eq(EventEnvelope.class)))
                .thenReturn(EventEnvelope.builder().eventVersion(1).build());
        when(eventMapper.updateOutcome(any(), any())).thenReturn(1);

        consumer.poll();

        ArgumentCaptor<Instant> leaseCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(eventMapper).claim(eq(1L), leaseCaptor.capture(), any());
        Instant claimedLease = leaseCaptor.getValue();
        // MySQL `timestamp` is whole-second precision; claim and the fenced write must agree.
        assertEquals(0, claimedLease.getNano(), "claim lease must be truncated to whole seconds");
        verify(eventMapper).updateOutcome(any(), eq(claimedLease));
    }

    @Test
    void discardedOutcomeDoesNotThrow() throws Exception {
        ReliableEvent event = event();
        when(objectMapper.readValue(anyString(), eq(EventEnvelope.class)))
                .thenReturn(EventEnvelope.builder().eventVersion(1).build());
        // 0 rows = the row is owned by someone else now (lease reclaimed).
        when(eventMapper.updateOutcome(any(), any())).thenReturn(0);

        assertDoesNotThrow(() -> consumer.processClaimed(
                event, Instant.now().truncatedTo(ChronoUnit.SECONDS)));
        verify(eventMapper).updateOutcome(any(), any());
    }

    @Test
    void exhaustedAttemptsMarkIsolated() throws Exception {
        ReliableEvent event = event();
        event.setAttemptCount(4);
        event.setMaxAttempts(5);
        when(objectMapper.readValue(event.getPayload(), EventEnvelope.class))
                .thenThrow(new RuntimeException("handler failed"));
        when(eventMapper.updateOutcome(any(), any())).thenReturn(1);

        consumer.processClaimed(event, Instant.now().truncatedTo(ChronoUnit.SECONDS));

        ArgumentCaptor<ReliableEvent> captor = ArgumentCaptor.forClass(ReliableEvent.class);
        verify(eventMapper).updateOutcome(captor.capture(), any());
        assertEquals(ReliableEventStatus.ISOLATED.name(), captor.getValue().getStatus());
        assertEquals(5, captor.getValue().getAttemptCount());
    }

    private static ReliableEvent event() {
        ReliableEvent event = new ReliableEvent();
        event.setId(1L);
        event.setEventId("evt-1");
        event.setAttemptCount(0);
        event.setMaxAttempts(5);
        event.setPayload("{\"eventVersion\":1}");
        return event;
    }
}

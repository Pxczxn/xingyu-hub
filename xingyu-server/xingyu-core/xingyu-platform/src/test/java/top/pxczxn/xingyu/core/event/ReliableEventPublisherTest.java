package top.pxczxn.xingyu.core.event;

import top.pxczxn.xingyu.common.contract.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReliableEventPublisherTest {

    @Mock
    private ReliableEventMapper eventMapper;

    @Mock
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    private ReliableEventPublisher publisher;

    @Test
    void duplicateEventIdSkipsSecondInsert() {
        var envelope = publisher.envelope(
                "evt-dup",
                "test.event",
                1,
                "article",
                ObjectId.random(),
                "corr",
                "cause",
                1);
        when(eventMapper.findByEventId("evt-dup")).thenReturn(null, new ReliableEvent());

        publisher.publish(envelope, "{}");
        publisher.publish(envelope, "{}");

        verify(eventMapper, times(1)).insert(any(ReliableEvent.class));
    }
}

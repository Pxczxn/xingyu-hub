package top.pxczxn.xingyu.core.event;

import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReliableEventLeaseRecoveryTest {

    @Test
    void reclaimRetriesTransientLockConflict() {
        ReliableEventMapper mapper = mock(ReliableEventMapper.class);
        ReliableEventLeaseRecovery recovery = new ReliableEventLeaseRecovery(mapper);
        Instant now = Instant.parse("2026-10-29T00:00:00Z");
        when(mapper.reclaimExpiredLeases(any(), any()))
                .thenThrow(new CannotAcquireLockException("deadlock"))
                .thenReturn(1);

        assertEquals(1, recovery.reclaimExpiredLeases(now));
        verify(mapper, times(2)).reclaimExpiredLeases(any(), any());
    }

    @Test
    void reclaimGivesUpAfterMaxAttempts() {
        ReliableEventMapper mapper = mock(ReliableEventMapper.class);
        ReliableEventLeaseRecovery recovery = new ReliableEventLeaseRecovery(mapper);
        Instant now = Instant.parse("2026-10-29T00:00:00Z");
        when(mapper.reclaimExpiredLeases(any(), any()))
                .thenThrow(new CannotAcquireLockException("deadlock"));

        assertThrows(CannotAcquireLockException.class, () -> recovery.reclaimExpiredLeases(now));
        verify(mapper, times(ReliableEventLeaseRecovery.MAX_ATTEMPTS))
                .reclaimExpiredLeases(any(), any());
    }

    @Test
    void isolateRetriesTransientLockConflict() {
        ReliableEventMapper mapper = mock(ReliableEventMapper.class);
        ReliableEventLeaseRecovery recovery = new ReliableEventLeaseRecovery(mapper);
        Instant now = Instant.parse("2026-10-29T00:00:00Z");
        when(mapper.isolateExpiredLeases(any()))
                .thenThrow(new CannotAcquireLockException("deadlock"))
                .thenReturn(2);

        assertEquals(2, recovery.isolateExpiredLeases(now));
        verify(mapper, times(2)).isolateExpiredLeases(any());
    }
}

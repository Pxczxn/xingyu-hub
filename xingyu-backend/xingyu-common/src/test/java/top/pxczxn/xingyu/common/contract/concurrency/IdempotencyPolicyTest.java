package top.pxczxn.xingyu.common.contract.concurrency;

import top.pxczxn.xingyu.common.contract.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class IdempotencyPolicyTest {

    @Test
    void sameKeySamePayloadReplays() {
        String hash = IdempotencyPolicy.hashPayload("{\"email\":\"a@b.c\"}");
        IdempotencyResult<String> result = IdempotencyPolicy.resolve(hash, hash, "old", "new");
        assertEquals(IdempotencyResult.IdempotencyStatus.REPLAYED, result.getStatus());
        assertEquals("old", result.getResponse());
    }

    @Test
    void sameKeyDifferentPayloadConflicts() {
        String existing = IdempotencyPolicy.hashPayload("{\"email\":\"a@b.c\"}");
        String incoming = IdempotencyPolicy.hashPayload("{\"email\":\"x@y.z\"}");
        IdempotencyResult<String> result = IdempotencyPolicy.resolve(existing, incoming, "old", "new");
        assertEquals(IdempotencyResult.IdempotencyStatus.CONFLICT, result.getStatus());
        assertEquals(ErrorCode.IDEMPOTENCY_CONFLICT, result.getErrorCode());
    }

    @Test
    void lockVersionMismatchReturnsConflict() {
        ConcurrencyConflict conflict = IdempotencyPolicy.assertLockVersion(LockVersion.initial().next(), 0);
        assertEquals(ErrorCode.CONFLICT, conflict.getErrorCode());
        assertNull(IdempotencyPolicy.assertLockVersion(LockVersion.initial(), 0));
    }
}

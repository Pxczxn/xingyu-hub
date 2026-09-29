package top.pxczxn.xingyu.common.contract.concurrency;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

public final class IdempotencyPolicy {

    private IdempotencyPolicy() {
    }

    public static String hashPayload(String payload) {
        Objects.requireNonNull(payload, "payload");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static <T> IdempotencyResult<T> resolve(
            String existingHash,
            String incomingHash,
            T existingResponse,
            T newResponse) {
        if (existingHash == null) {
            return IdempotencyResult.created(newResponse);
        }
        if (existingHash.equals(incomingHash)) {
            return IdempotencyResult.replayed(existingResponse);
        }
        return IdempotencyResult.conflict();
    }

    public static ConcurrencyConflict assertLockVersion(LockVersion current, long expected) {
        if (!current.matches(expected)) {
            return ConcurrencyConflict.lockVersionMismatch(current);
        }
        return null;
    }
}

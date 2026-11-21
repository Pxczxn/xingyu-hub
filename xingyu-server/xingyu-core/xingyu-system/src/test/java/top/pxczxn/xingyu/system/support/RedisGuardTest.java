package top.pxczxn.xingyu.system.support;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import top.pxczxn.xingyu.common.exception.BusinessException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RedisGuardTest {

    @Test
    void optionalWriteDoesNotThrowWhenRedisIsDown() {
        assertDoesNotThrow(() -> RedisGuard.optional(
                () -> {
                    throw new RedisConnectionFailureException("down");
                },
                "config-cache"));
    }

    @Test
    void optionalWriteStillPropagatesNonRedisErrors() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> RedisGuard.optional(
                () -> {
                    throw new IllegalStateException("db");
                },
                "config-cache"));
        assertEquals("db", ex.getMessage());
    }

    @Test
    void requiredReadFailsClosedAndDoesNotReturnMiss() {
        BusinessException ex = assertThrows(BusinessException.class, () -> RedisGuard.required(
                () -> {
                    throw new RedisConnectionFailureException("down");
                },
                "login-retry"));
        assertEquals(RedisGuard.UNAVAILABLE_MESSAGE, ex.getMessage());
    }

    @Test
    void redisRecoveryIsNotSticky() {
        assertThrows(BusinessException.class, () -> RedisGuard.required(
                () -> {
                    throw new RedisConnectionFailureException("down");
                },
                "captcha"));
        assertEquals("ok", RedisGuard.required(() -> "ok", "captcha"));
        assertFalse(RedisGuard.isUnavailable(new IllegalArgumentException("bad")));
        assertTrue(RedisGuard.isUnavailable(new RedisConnectionFailureException("down")));
    }
}

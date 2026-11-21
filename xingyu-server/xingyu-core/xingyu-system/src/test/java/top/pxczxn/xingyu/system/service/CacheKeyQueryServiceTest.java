package top.pxczxn.xingyu.system.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CacheKeyQueryServiceTest {

    private StringRedisTemplate redisTemplate;
    private CacheKeyQueryService service;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        service = new CacheKeyQueryService(redisTemplate);
    }

    @Test
    void scanReturnsUniqueInspectableKeysAndDoesNotCallKeys() {
        stubScan(List.of(
                "sys:config:group:mail",
                "captcha:1",
                "sys:config:group:mail",
                "sys:config:group:sms"
        ));

        Map<String, Object> payload = service.listKeys("sys:config:group:");

        assertEquals(List.of("sys:config:group:mail", "sys:config:group:sms"), payload.get("keys"));
        assertEquals(true, payload.get("complete"));
        assertEquals(false, payload.get("truncated"));
        assertEquals(4, payload.get("scanned"));
        verify(redisTemplate, never()).keys(any());
    }

    @Test
    void emptyCursorIsComplete() {
        stubScan(List.of());
        Map<String, Object> payload = service.listKeys("api:access:log:");
        assertEquals(List.of(), payload.get("keys"));
        assertEquals(true, payload.get("complete"));
        assertEquals("没有匹配的可查看缓存键。", payload.get("notice"));
    }

    @Test
    void redisFailureIsUnavailable() {
        when(redisTemplate.execute(any(RedisCallback.class)))
                .thenThrow(new RedisConnectionFailureException("down"));
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.listKeys("sys:config:group:"));
        assertEquals("缓存暂不可用", ex.getMessage());
    }

    @Test
    void starPatternIsRejectedBeforeScan() {
        assertThrows(IllegalArgumentException.class, () -> service.listKeys("*"));
        verify(redisTemplate, never()).execute(any(RedisCallback.class));
        verify(redisTemplate, never()).keys(any());
    }

    @Test
    void returnCapMarksTruncatedIncompleteScan() {
        List<String> hits = new java.util.ArrayList<>();
        for (int i = 0; i < 201; i++) {
            hits.add("sys:config:group:k" + i);
        }
        stubScan(hits);
        Map<String, Object> payload = service.listKeys("sys:config:group:");
        assertEquals(200, payload.get("returned"));
        assertEquals(true, payload.get("truncated"));
        assertEquals(false, payload.get("complete"));
        assertEquals(200, payload.get("maxReturn"));
        assertEquals(1000, payload.get("maxScan"));
        verify(redisTemplate, never()).keys(any());
    }

    @SuppressWarnings("unchecked")
    private void stubScan(List<String> hits) {
        when(redisTemplate.execute(any(RedisCallback.class))).thenAnswer(invocation -> {
            RedisCallback<Object> callback = invocation.getArgument(0);
            RedisConnection connection = mock(RedisConnection.class);
            Cursor<byte[]> cursor = mock(Cursor.class);
            Iterator<byte[]> iterator = hits.stream()
                    .map(hit -> hit.getBytes(StandardCharsets.UTF_8))
                    .iterator();
            when(cursor.hasNext()).thenAnswer(inv -> iterator.hasNext());
            when(cursor.next()).thenAnswer(inv -> iterator.next());
            when(connection.scan(any(ScanOptions.class))).thenReturn(cursor);
            return callback.doInRedis(connection);
        });
    }
}

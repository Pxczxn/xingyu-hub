package top.pxczxn.xingyu.system.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.system.support.CacheKeyScanSupport;
import top.pxczxn.xingyu.system.support.CacheKeyScanSupport.ScanAccumulator;
import top.pxczxn.xingyu.system.support.RedisGuard;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CacheKeyQueryService {

    private final StringRedisTemplate redisTemplate;

    public Map<String, Object> listKeys(String pattern) {
        String match = CacheKeyScanSupport.resolveMatch(pattern);
        if (match == null) {
            throw new IllegalArgumentException(CacheKeyScanSupport.invalidPatternMessage());
        }
        try {
            ScanAccumulator acc = redisTemplate.execute((RedisCallback<ScanAccumulator>) connection -> {
                ScanAccumulator collected = new ScanAccumulator();
                ScanOptions options = ScanOptions.scanOptions()
                        .match(match)
                        .count(CacheKeyScanSupport.COUNT_HINT)
                        .build();
                try (Cursor<byte[]> cursor = connection.scan(options)) {
                    while (cursor.hasNext()) {
                        byte[] raw = cursor.next();
                        if (raw == null) {
                            continue;
                        }
                        String key = new String(raw, StandardCharsets.UTF_8);
                        if (!CacheKeyScanSupport.acceptHit(
                                collected, key, CacheKeyScanSupport.MAX_SCAN, CacheKeyScanSupport.MAX_RETURN)) {
                            return collected;
                        }
                    }
                }
                collected.complete = !collected.truncated;
                return collected;
            });
            if (acc == null) {
                acc = new ScanAccumulator();
                acc.complete = true;
            }
            return toPayload(match, acc);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            if (RedisGuard.isUnavailable(ex)) {
                throw new IllegalStateException("缓存暂不可用", ex);
            }
            throw ex;
        }
    }

    private static Map<String, Object> toPayload(String match, ScanAccumulator acc) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("keys", new ArrayList<>(acc.keys));
        payload.put("pattern", match);
        payload.put("complete", acc.complete);
        payload.put("truncated", acc.truncated);
        payload.put("scanned", acc.scanned);
        payload.put("returned", acc.keys.size());
        payload.put("maxScan", CacheKeyScanSupport.MAX_SCAN);
        payload.put("maxReturn", CacheKeyScanSupport.MAX_RETURN);
        if (acc.truncated) {
            payload.put("notice", "结果不完整：已达单次扫描或返回上限，不是全库键清单。");
        } else if (acc.keys.isEmpty()) {
            payload.put("notice", "没有匹配的可查看缓存键。");
        } else if (acc.complete) {
            payload.put("notice", "当前前缀扫描已结束。");
        } else {
            payload.put("notice", "");
        }
        return payload;
    }
}

package top.pxczxn.xingyu.system.support;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.system.support.CacheKeyScanSupport.ScanAccumulator;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CacheKeyScanSupportTest {

    @Test
    void rejectsUnscopedPatterns() {
        assertNull(CacheKeyScanSupport.resolveMatch(null));
        assertNull(CacheKeyScanSupport.resolveMatch(""));
        assertNull(CacheKeyScanSupport.resolveMatch("*"));
        assertNull(CacheKeyScanSupport.resolveMatch("**"));
        assertNull(CacheKeyScanSupport.resolveMatch("?*"));
        assertNull(CacheKeyScanSupport.resolveMatch("sys:*"));
        assertNull(CacheKeyScanSupport.resolveMatch("captcha:*"));
        assertNull(CacheKeyScanSupport.resolveMatch("satoken:login:session:*"));
    }

    @Test
    void allowsControlledPrefixes() {
        assertEquals("sys:config:group:*", CacheKeyScanSupport.resolveMatch("sys:config:group:"));
        assertEquals("sys:config:group:*", CacheKeyScanSupport.resolveMatch("sys:config:group:*"));
        assertEquals("sys:config:group:security", CacheKeyScanSupport.resolveMatch("sys:config:group:security"));
        assertEquals("api:access:log:*", CacheKeyScanSupport.resolveMatch(" api:access:log: "));
    }

    @Test
    void filtersSensitiveAndDuplicatesThenStopsAtLimits() {
        ScanAccumulator acc = CacheKeyScanSupport.collect(List.of(
                "sys:config:group:a",
                "captcha:uuid",
                "satoken:login:session:1",
                "sys:config:group:a",
                "login:retry:admin",
                "sys:config:group:b",
                "sys:config:group:c"
        ), 100, 2);
        assertEquals(List.of("sys:config:group:a", "sys:config:group:b"), List.copyOf(acc.keys));
        assertTrue(acc.truncated);
        assertFalse(acc.complete);
        assertEquals(6, acc.scanned);
    }

    @Test
    void emptyCompleteScan() {
        ScanAccumulator acc = CacheKeyScanSupport.collect(List.of(), 100, 200);
        assertTrue(acc.keys.isEmpty());
        assertTrue(acc.complete);
        assertFalse(acc.truncated);
        assertEquals(0, acc.scanned);
    }

    @Test
    void scanCapStopsBeforeReturnCap() {
        ScanAccumulator acc = CacheKeyScanSupport.collect(
                List.of("sys:config:group:1", "sys:config:group:2", "sys:config:group:3"),
                1, 200);
        assertEquals(1, acc.keys.size());
        assertTrue(acc.truncated);
        assertEquals(2, acc.scanned);
    }
}

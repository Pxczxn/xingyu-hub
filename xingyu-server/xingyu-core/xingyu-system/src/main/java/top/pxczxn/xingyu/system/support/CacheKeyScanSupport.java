package top.pxczxn.xingyu.system.support;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 管理端缓存键查询规则：只允许受控前缀、SCAN 有上限，且永不把安全类键列入结果。
 * 不声称扫完整个 Redis。
 */
public final class CacheKeyScanSupport {

    public static final int MAX_SCAN = 1000;
    public static final int MAX_RETURN = 200;
    public static final int COUNT_HINT = 100;

    public static final List<String> ALLOWED_PREFIXES = List.of(
            "sys:config:group:",
            "api:access:log:"
    );

    public static final List<String> SENSITIVE_PREFIXES = List.of(
            "satoken:",
            "authorization:",
            "captcha:",
            "login:retry:",
            "community:login:retry:",
            "community:must-change-password:",
            "community:admin-temp-password:",
            "sms:",
            "repeat_submit:",
            "register:"
    );

    private CacheKeyScanSupport() {
    }

    public static String resolveMatch(String rawPattern) {
        if (rawPattern == null) {
            return null;
        }
        String pattern = rawPattern.trim();
        if (pattern.isEmpty() || isUnscoped(pattern)) {
            return null;
        }
        String match = pattern;
        if (!containsGlob(pattern)) {
            match = pattern.endsWith(":") ? pattern + "*" : pattern;
        }
        if (!startsWithAllowedPrefix(match)) {
            return null;
        }
        return match;
    }

    public static boolean isSensitive(String key) {
        if (key == null || key.isEmpty()) {
            return true;
        }
        String lowered = key.toLowerCase(Locale.ROOT);
        for (String prefix : SENSITIVE_PREFIXES) {
            if (lowered.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    public static boolean isInspectable(String key) {
        if (key == null || isSensitive(key)) {
            return false;
        }
        for (String prefix : ALLOWED_PREFIXES) {
            if (key.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /** @return false when the caller must stop SCAN. */
    public static boolean acceptHit(ScanAccumulator acc, String hit, int maxScan, int maxReturn) {
        acc.scanned++;
        if (acc.scanned > maxScan) {
            acc.truncated = true;
            acc.complete = false;
            return false;
        }
        if (!isInspectable(hit)) {
            return true;
        }
        if (!acc.keys.add(hit)) {
            return true;
        }
        if (acc.keys.size() >= maxReturn) {
            acc.truncated = true;
            acc.complete = false;
            return false;
        }
        return true;
    }

    public static ScanAccumulator collect(Iterable<String> scanHits, int maxScan, int maxReturn) {
        ScanAccumulator acc = new ScanAccumulator();
        for (String hit : scanHits) {
            if (!acceptHit(acc, hit, maxScan, maxReturn)) {
                return acc;
            }
        }
        acc.complete = !acc.truncated;
        return acc;
    }

    public static String invalidPatternMessage() {
        return "请输入受控前缀，例如 sys:config:group: 或 api:access:log:。禁止 * 全库扫描。";
    }

    private static boolean isUnscoped(String pattern) {
        if (pattern.startsWith("*") || pattern.startsWith("?")) {
            return true;
        }
        String compact = pattern.replace("*", "").replace("?", "");
        return compact.isEmpty();
    }

    private static boolean containsGlob(String pattern) {
        return pattern.indexOf('*') >= 0 || pattern.indexOf('?') >= 0;
    }

    private static boolean startsWithAllowedPrefix(String match) {
        for (String prefix : ALLOWED_PREFIXES) {
            if (match.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    public static final class ScanAccumulator {
        public final Set<String> keys = new LinkedHashSet<>();
        public int scanned;
        public boolean truncated;
        public boolean complete;
    }
}

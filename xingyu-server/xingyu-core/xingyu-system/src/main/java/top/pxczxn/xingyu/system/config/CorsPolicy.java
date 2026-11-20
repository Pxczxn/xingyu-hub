package top.pxczxn.xingyu.system.config;

import java.util.ArrayList;
import java.util.List;

/**
 * 生产环境只接受明确列出的来源。未配置或写成 {@code *} 时不放行任何跨域来源。
 */
public final class CorsPolicy {

    private CorsPolicy() {}

    public record Decision(boolean allowAnyOrigin, List<String> allowedOrigins, boolean allowCredentials) {}

    public static Decision decide(boolean production, String configuredOrigins) {
        if (!production) {
            return new Decision(true, List.of(), true);
        }
        List<String> origins = exactOrigins(configuredOrigins);
        if (origins.isEmpty()) {
            return new Decision(false, List.of(), false);
        }
        return new Decision(false, origins, true);
    }

    static List<String> exactOrigins(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> origins = new ArrayList<>();
        for (String part : raw.split(",")) {
            String origin = part.trim();
            if (origin.isEmpty() || "*".equals(origin) || origin.contains("*")) {
                continue;
            }
            if (!origins.contains(origin)) {
                origins.add(origin);
            }
        }
        return List.copyOf(origins);
    }
}

package top.pxczxn.xingyu.common.config;

import java.net.URI;

/**
 * Normalizes the community public origin used by SEO and mail links.
 *
 * <p>Business services should not hard-code the production hostname. YAML/env
 * bind {@code xingyu.community.public-base-url}; this helper strips trailing
 * slashes and refuses a silent localhost fallback when the active profile is
 * production.
 */
public final class PublicBaseUrls {

    public static final String DEVELOPMENT_DEFAULT = "http://localhost:3000";
    public static final String PRODUCTION_DEFAULT = "https://pxczxn.top";

    private PublicBaseUrls() {}

    /**
     * @param preferred explicit value (for example DB {@code communityWebUrl}); wins when non-blank
     * @param configured YAML/env {@code xingyu.community.public-base-url}
     * @param production {@code prod} Spring profile
     */
    public static String resolve(String preferred, String configured, boolean production) {
        String fromPreferred = normalize(preferred);
        if (fromPreferred != null) {
            return fromPreferred;
        }
        String fromConfigured = normalize(configured);
        if (fromConfigured != null && !(production && isLoopbackOrigin(fromConfigured))) {
            return fromConfigured;
        }
        return production ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT;
    }

    public static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        while (trimmed.endsWith("/") && trimmed.length() > 1) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    static boolean isLoopbackOrigin(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null) {
                return false;
            }
            return "localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host)
                    || "0.0.0.0".equals(host)
                    || "::1".equals(host);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }
}

package top.pxczxn.xingyu.community.support;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ArticleCoverSupport {

    private static final Pattern MARKDOWN_IMAGE = Pattern.compile("!\\[[^\\]]*\\]\\(([^)]+)\\)");
    private static final Pattern HTML_IMAGE = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLAIN_IMAGE_URL = Pattern.compile(
            "https?://[^\\s<>\"']+\\.(?:png|jpe?g|gif|webp|svg)(?:\\?[^\\s<>\"']*)?",
            Pattern.CASE_INSENSITIVE);

    private ArticleCoverSupport() {}

    public static String extractCoverUrl(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }

        Matcher markdown = MARKDOWN_IMAGE.matcher(body);
        if (markdown.find()) {
            return normalizeCoverUrl(markdown.group(1));
        }

        Matcher html = HTML_IMAGE.matcher(body);
        if (html.find()) {
            return normalizeCoverUrl(html.group(1));
        }

        Matcher plain = PLAIN_IMAGE_URL.matcher(body);
        if (plain.find()) {
            return normalizeCoverUrl(plain.group());
        }

        return null;
    }

    private static String normalizeCoverUrl(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
            return trimmed;
        }
        return null;
    }
}

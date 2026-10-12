package top.pxczxn.xingyu.file.community;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 解析正文/封面中的社区媒体 URL。 */
public final class CommunityFileMediaUrls {

    private static final Pattern PRIVATE_MEDIA =
            Pattern.compile("/api/v1/media/private/(\\d+)");

    private CommunityFileMediaUrls() {}

    public static List<Long> extractPrivateFileIds(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        Matcher matcher = PRIVATE_MEDIA.matcher(text);
        List<Long> ids = new ArrayList<>();
        while (matcher.find()) {
            ids.add(Long.parseLong(matcher.group(1)));
        }
        return ids;
    }

    public static String replacePrivateWithPublic(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        return PRIVATE_MEDIA.matcher(text).replaceAll("/api/v1/media/public/$1");
    }

    public static Long extractSinglePrivateFileId(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        Matcher matcher = PRIVATE_MEDIA.matcher(url.trim());
        if (matcher.matches()) {
            return Long.parseLong(matcher.group(1));
        }
        if (matcher.find()) {
            return Long.parseLong(matcher.group(1));
        }
        return null;
    }
}

package top.pxczxn.xingyu.file.community;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.UUID;

/**
 * 生成统一 Object Key（相对存储根 / 桶内路径）。本地开发在 base_path 下用 public/ 与 private/ 前缀模拟双桶。
 */
public final class CommunityFilePathPlanner {

    private CommunityFilePathPlanner() {}

    public static String objectKey(
            CommunityFilePurpose purpose,
            String ownerUserId,
            String suffix,
            String draftId,
            String articleId,
            String seriesId,
            String galaxyId,
            String momentId) {
        String safeSuffix = normalizeSuffix(suffix);
        String fileName = UUID.randomUUID().toString().replace("-", "") + safeSuffix;
        String user = sanitizeSegment(ownerUserId, "unknown");

        String relative = switch (purpose) {
            case USER_AVATAR -> "users/" + user + "/avatars/" + fileName;
            case USER_BANNER -> "users/" + user + "/banners/" + fileName;
            case ARTICLE_COVER -> {
                String article = sanitizeSegment(articleId, "draft");
                yield "articles/" + article + "/covers/" + fileName;
            }
            case ARTICLE_BODY_IMAGE -> {
                String article = sanitizeSegment(articleId, "draft");
                yield "articles/" + article + "/images/" + fileName;
            }
            case SERIES_COVER -> {
                String series = sanitizeSegment(seriesId, "draft");
                yield "series/" + series + "/covers/" + fileName;
            }
            case GALAXY_COVER -> {
                String galaxy = sanitizeSegment(galaxyId, "draft");
                yield "galaxies/" + galaxy + "/covers/" + fileName;
            }
            case MOMENT_MEDIA -> {
                String moment = sanitizeSegment(momentId, "draft");
                yield "moments/" + moment + "/media/" + fileName;
            }
            case MESSAGE_ATTACHMENT -> "messages/" + user + "/" + fileName;
            case DRAFT_IMAGE -> {
                String draft = sanitizeSegment(draftId, "temp");
                yield "drafts/" + user + "/" + draft + "/images/" + fileName;
            }
            case DRAFT_ATTACHMENT -> {
                String draft = sanitizeSegment(draftId, "temp");
                yield "drafts/" + user + "/" + draft + "/attachments/" + fileName;
            }
            case TEMP_UPLOAD -> "temp/" + user + "/" + fileName;
        };

        String zone = purpose.isPublicByDefault() ? "public" : "private";
        return zone + "/" + relative;
    }

    private static String normalizeSuffix(String suffix) {
        if (!StringUtils.hasText(suffix)) {
            return "";
        }
        String s = suffix.trim().toLowerCase(Locale.ROOT);
        return s.startsWith(".") ? s : "." + s;
    }

    private static String sanitizeSegment(String raw, String fallback) {
        if (!StringUtils.hasText(raw)) {
            return fallback;
        }
        String cleaned = raw.trim().replace('\\', '/');
        if (cleaned.contains("..") || cleaned.contains("/")) {
            throw new IllegalArgumentException("非法资源标识");
        }
        return cleaned;
    }
}

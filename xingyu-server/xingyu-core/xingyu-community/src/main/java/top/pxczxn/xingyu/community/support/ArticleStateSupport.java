package top.pxczxn.xingyu.community.support;

import top.pxczxn.xingyu.community.entity.Article;

/**
 * 文章 v3 状态语义：editorial(status) + lifecycle + moderation 三维合成。
 */
public final class ArticleStateSupport {

    public static final String EDITORIAL_DRAFT = "DRAFT";
    public static final String EDITORIAL_IN_REVIEW = "IN_REVIEW";
    public static final String EDITORIAL_PUBLISHED = "PUBLISHED";

    public static final String LIFECYCLE_ACTIVE = "ACTIVE";
    public static final String LIFECYCLE_TRASHED = "TRASHED";

    public static final String MODERATION_NORMAL = "NORMAL";
    public static final String MODERATION_HIDDEN = "HIDDEN";
    public static final String MODERATION_FROZEN = "FROZEN";

    private ArticleStateSupport() {
    }

    public static void initNewArticle(Article article) {
        article.setStatus(EDITORIAL_DRAFT);
        article.setLifecycleStatus(LIFECYCLE_ACTIVE);
        article.setModerationStatus(MODERATION_NORMAL);
    }

    public static boolean isActiveLifecycle(Article article) {
        return article != null && LIFECYCLE_ACTIVE.equals(normalizeLifecycle(article.getLifecycleStatus()));
    }

    public static boolean isTrashed(Article article) {
        return article != null && LIFECYCLE_TRASHED.equals(normalizeLifecycle(article.getLifecycleStatus()));
    }

    public static boolean isUnderReview(Article article) {
        return article != null && EDITORIAL_IN_REVIEW.equals(article.getStatus());
    }

    public static boolean isPublished(Article article) {
        return article != null && EDITORIAL_PUBLISHED.equals(article.getStatus());
    }

    public static boolean canEditDraft(Article article) {
        return isActiveLifecycle(article)
                && MODERATION_NORMAL.equals(normalizeModeration(article.getModerationStatus()))
                && !isUnderReview(article);
    }

    public static String normalizeLifecycle(String value) {
        if (value == null || value.isBlank()) {
            return LIFECYCLE_ACTIVE;
        }
        return value.trim().toUpperCase();
    }

    public static String normalizeModeration(String value) {
        if (value == null || value.isBlank()) {
            return MODERATION_NORMAL;
        }
        return value.trim().toUpperCase();
    }
}

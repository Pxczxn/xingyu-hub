package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ArticleTopicNameRow;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Batch presentation enrichment for feed cards.
 *
 * <p>WHY THIS EXISTS: the services that produce feed cards (HomeService,
 * ReadingService, RecommendationService) only know what {@code search_document}
 * carries. Author identity, interaction counters and tags live in other tables,
 * and resolving them per row is the N+1 that turns a 10-row feed into 40
 * queries.
 *
 * <p>USAGE — two steps, so that every rail on a page shares ONE pass. Resolving
 * rails one at a time would re-resolve objects that appear in several rails
 * (a recommended article is often also a follow update):
 *
 * <pre>{@code
 * List<FeedObject> refs = new ArrayList<>();
 * refs.addAll(refsOfCards(railA));
 * refs.addAll(refsOfViews(railB));
 * Map<String, Presentation> enrichment = enrichmentService.enrich(refs);
 * railA = enrichmentService.applyCards(railA, enrichment);
 * railB = enrichmentService.applyViews(railB, enrichment);
 * }</pre>
 *
 * <p>QUERY BUDGET per {@link #enrich} call — independent of row count, and each
 * statement is skipped entirely when its input set is empty:
 * <ol>
 *   <li>one batch per object type present (article / series / moment) to find owners</li>
 *   <li>one {@code community_profile} batch for those owners</li>
 *   <li>one like-count batch and one comment-count batch per object type present</li>
 *   <li>one {@code article_topic} batch, only when ARTICLE rows are present</li>
 * </ol>
 *
 * <p>HONESTY RULES: every field is best-effort. A row whose owner cannot be
 * resolved keeps a null author rather than a placeholder, and a row with no
 * comments reports 0 (the count query omits zero rows by design) rather than
 * "unknown". Callers must render a missing value as absent, never as a fake one.
 */
@Service
@RequiredArgsConstructor
public class HomeFeedEnrichmentService {

    private final ArticleMapper articleMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final CommunityProfileMapper profileMapper;
    private final ArticleTopicMapper articleTopicMapper;
    private final EngagementMetricsService engagementMetricsService;

    private static final String ARTICLE = "ARTICLE";
    private static final String SERIES = "SERIES";
    private static final String MOMENT = "MOMENT";

    /** One feed row to enrich. {@code objectId} is the id the card renders with. */
    public record FeedObject(String objectType, String objectId) {}

    /** What could be resolved for one row. Every field may be null / empty. */
    public record Presentation(
            String authorName,
            String avatar,
            Long likeCount,
            Long commentCount,
            List<String> tags,
            Boolean bookmarked,
            Boolean liked) {

        static final Presentation EMPTY =
                new Presentation(null, null, null, null, List.of(), null, null);
    }

    /** Stable map key for an (objectType, objectId) pair. */
    public static String key(String objectType, String objectId) {
        return normalizeType(objectType) + ":" + objectId;
    }

    /** The rows a page of cards will need resolved. */
    public static List<FeedObject> refsOfCards(List<ContentCardView> cards) {
        if (cards == null) {
            return List.of();
        }
        return cards.stream()
                .filter(Objects::nonNull)
                .map(card -> new FeedObject(card.getObjectType(), card.getId()))
                .toList();
    }

    /** The rows a page of search-result views will need resolved. */
    public static List<FeedObject> refsOfViews(List<SearchResultView> views) {
        if (views == null) {
            return List.of();
        }
        return views.stream()
                .filter(Objects::nonNull)
                .map(view -> new FeedObject(view.getObjectType(), view.getObjectId()))
                .toList();
    }

    /**
     * Resolves presentation data for a whole page of feed rows at once.
     *
     * <p>{@code viewerId} is optional and ONLY used for the viewer-scoped fields
     * ({@code bookmarked}); every other field is the same for everybody. A null viewer means
     * "nobody is signed in", which leaves {@code bookmarked} null — deliberately not false, so
     * a guest is never told an item is un-bookmarked when the truth is "unknown".
     *
     * <p>The returned map is keyed by {@link #key}. An absent entry means nothing
     * could be resolved for that row, which callers render as blank.
     */
    public Map<String, Presentation> enrich(List<FeedObject> objects, String viewerId) {
        Map<String, Presentation> resolved = new HashMap<>();
        if (objects == null || objects.isEmpty()) {
            return resolved;
        }

        // The same object can appear in several rails; resolve it once.
        Map<String, FeedObject> unique = new LinkedHashMap<>();
        for (FeedObject object : objects) {
            if (object == null || object.objectId() == null || object.objectId().isBlank()) {
                continue;
            }
            unique.putIfAbsent(key(object.objectType(), object.objectId()), object);
        }
        if (unique.isEmpty()) {
            return resolved;
        }

        Map<String, List<String>> idsByType = new HashMap<>();
        for (FeedObject object : unique.values()) {
            idsByType
                    .computeIfAbsent(normalizeType(object.objectType()), type -> new ArrayList<>())
                    .add(object.objectId());
        }

        Map<String, String> ownerByKey = resolveOwners(idsByType);
        Map<String, CommunityProfile> profileByOwner = resolveProfiles(ownerByKey.values());

        Map<String, Map<String, Long>> likeCountsByType = new HashMap<>();
        Map<String, Map<String, Long>> commentCountsByType = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : idsByType.entrySet()) {
            likeCountsByType.put(
                    entry.getKey(),
                    engagementMetricsService.likeCounts(entry.getKey(), entry.getValue()));
            commentCountsByType.put(
                    entry.getKey(),
                    engagementMetricsService.commentCounts(entry.getKey(), entry.getValue()));
        }

        boolean viewerKnown = viewerId != null && !viewerId.isBlank();
        Map<String, Set<String>> bookmarkedByType = new HashMap<>();
        Map<String, Set<String>> likedByType = new HashMap<>();
        if (viewerKnown) {
            for (Map.Entry<String, List<String>> entry : idsByType.entrySet()) {
                bookmarkedByType.put(
                        entry.getKey(),
                        engagementMetricsService.bookmarkedObjectIds(
                                viewerId, entry.getKey(), entry.getValue()));
                likedByType.put(
                        entry.getKey(),
                        engagementMetricsService.likedObjectIds(
                                viewerId, entry.getKey(), entry.getValue()));
            }
        }

        Map<String, List<String>> tagsByArticle = resolveTags(idsByType.get(ARTICLE));

        for (Map.Entry<String, FeedObject> entry : unique.entrySet()) {
            FeedObject object = entry.getValue();
            String type = normalizeType(object.objectType());
            CommunityProfile profile = profileByOwner.get(ownerByKey.get(entry.getKey()));
            boolean bookmarked = viewerKnown
                    && bookmarkedByType.getOrDefault(type, Set.of()).contains(object.objectId());
            boolean liked = viewerKnown
                    && likedByType.getOrDefault(type, Set.of()).contains(object.objectId());
            resolved.put(entry.getKey(), new Presentation(
                    displayName(profile),
                    ProfileSettingsSupport.resolveAvatar(profile),
                    lookup(likeCountsByType.get(type), object.objectId()),
                    lookup(commentCountsByType.get(type), object.objectId()),
                    tagsByArticle.getOrDefault(object.objectId(), List.of()),
                    viewerKnown ? bookmarked : null,
                    viewerKnown ? liked : null));
        }
        return resolved;
    }

    /**
     * Returns enriched copies of a page of cards. Every field the producer already
     * set is preserved — this only fills blanks and adds the presentation fields.
     */
    public List<ContentCardView> applyCards(
            List<ContentCardView> cards, Map<String, Presentation> enrichment) {
        if (cards == null || cards.isEmpty()) {
            return cards == null ? List.of() : cards;
        }
        return cards.stream()
                .map(card -> card == null ? null : applyCard(card, enrichment))
                .filter(Objects::nonNull)
                .toList();
    }

    /** Returns enriched copies of a page of search-result views. */
    public List<SearchResultView> applyViews(
            List<SearchResultView> views, Map<String, Presentation> enrichment) {
        if (views == null || views.isEmpty()) {
            return views == null ? List.of() : views;
        }
        return views.stream()
                .map(view -> view == null ? null : applyView(view, enrichment))
                .filter(Objects::nonNull)
                .toList();
    }

    private ContentCardView applyCard(ContentCardView card, Map<String, Presentation> enrichment) {
        Presentation presentation =
                enrichment.getOrDefault(key(card.getObjectType(), card.getId()), Presentation.EMPTY);
        return ContentCardView.builder()
                .id(card.getId())
                .objectType(card.getObjectType())
                .title(card.getTitle())
                .summary(card.getSummary())
                .cover(card.getCover())
                // A producer that already resolved the author wins; enrichment fills the gap.
                .authorName(card.getAuthorName() != null ? card.getAuthorName() : presentation.authorName())
                .updatedAt(card.getUpdatedAt())
                .avatar(presentation.avatar())
                .likeCount(presentation.likeCount())
                .commentCount(presentation.commentCount())
                .tags(presentation.tags())
                .bookmarked(presentation.bookmarked())
                .liked(presentation.liked())
                .chapterIndex(card.getChapterIndex())
                .chapterCount(card.getChapterCount())
                .chapterTitle(card.getChapterTitle())
                .build();
    }

    private SearchResultView applyView(SearchResultView view, Map<String, Presentation> enrichment) {
        Presentation presentation = enrichment.getOrDefault(
                key(view.getObjectType(), view.getObjectId()), Presentation.EMPTY);
        return SearchResultView.builder()
                .objectType(view.getObjectType())
                .objectId(view.getObjectId())
                .title(view.getTitle())
                .summary(view.getSummary())
                .cover(view.getCover())
                .avatar(view.getAvatar() != null ? view.getAvatar() : presentation.avatar())
                .updatedAt(view.getUpdatedAt())
                .authorName(presentation.authorName())
                .likeCount(presentation.likeCount())
                .commentCount(presentation.commentCount())
                .tags(presentation.tags())
                .bookmarked(presentation.bookmarked())
                .liked(presentation.liked())
                .build();
    }

    private Map<String, String> resolveOwners(Map<String, List<String>> idsByType) {
        Map<String, String> owners = new HashMap<>();

        List<String> articleIds = idsByType.getOrDefault(ARTICLE, List.of());
        if (!articleIds.isEmpty()) {
            for (Article article : articleMapper.selectBatchIds(articleIds)) {
                owners.put(key(ARTICLE, article.getId()), article.getOwnerId());
            }
        }

        List<String> seriesIds = idsByType.getOrDefault(SERIES, List.of());
        if (!seriesIds.isEmpty()) {
            for (Series series : seriesMapper.selectBatchIds(seriesIds)) {
                owners.put(key(SERIES, series.getId()), series.getOwnerId());
            }
        }

        List<String> momentIds = idsByType.getOrDefault(MOMENT, List.of());
        if (!momentIds.isEmpty()) {
            for (Moment moment : momentMapper.selectBatchIds(momentIds)) {
                owners.put(key(MOMENT, moment.getId()), moment.getAuthorId());
            }
        }

        return owners;
    }

    private Map<String, CommunityProfile> resolveProfiles(Collection<String> ownerIds) {
        List<String> ids = ownerIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, CommunityProfile> byUserId = new HashMap<>();
        for (CommunityProfile profile : profileMapper.findByUserIds(ids)) {
            byUserId.put(profile.getUserId(), profile);
        }
        return byUserId;
    }

    private Map<String, List<String>> resolveTags(List<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> tags = new HashMap<>();
        for (ArticleTopicNameRow row : articleTopicMapper.listTopicNamesByArticleIds(articleIds)) {
            if (row.getName() == null || row.getName().isBlank()) {
                continue;
            }
            tags.computeIfAbsent(row.getArticleId(), id -> new ArrayList<>()).add(row.getName());
        }
        return tags;
    }

    /**
     * A batch count ran for this object type, so a MISSING key means zero — not "unknown".
     *
     * <p>Returning null there would make "0 likes" indistinguishable from "we did not count",
     * and the client would have to choose between showing nothing and showing a wrong number.
     * Null is reserved for "no count was attempted for this type at all".
     */
    private static Long lookup(Map<String, Long> counts, String objectId) {
        return counts == null ? null : counts.getOrDefault(objectId, 0L);
    }

    private static String displayName(CommunityProfile profile) {
        if (profile == null) {
            return null;
        }
        String name = profile.getDisplayName();
        return name == null || name.isBlank() ? profile.getUsername() : name;
    }

    private static String normalizeType(String objectType) {
        return objectType == null ? "" : objectType.trim().toUpperCase(Locale.ROOT);
    }
}

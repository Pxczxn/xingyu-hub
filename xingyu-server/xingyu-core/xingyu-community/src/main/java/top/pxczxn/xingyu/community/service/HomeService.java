package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.HomeCompositionView;
import top.pxczxn.xingyu.community.dto.MeHomeView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.PendingActionView;
import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.NotificationMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The home composition endpoint pair ({@code GET /home} for guests,
 * {@code GET /me/home} for members).
 *
 * <p>Every rail is assembled here and then handed to
 * {@link HomeFeedEnrichmentService} in a SINGLE pass. The mappers below only
 * know what {@code search_document} carries, so without that pass the cards
 * would render with no author, no avatar, no counters and no tags — and doing
 * the lookups rail-by-rail would multiply the query count for no benefit.
 *
 * <p>{@code draftArticles} is deliberately NOT enriched: a draft is not in
 * {@code search_document}, so it has no public counters, and rendering "0 赞"
 * next to an unpublished draft would be noise rather than information.
 */
@Service
@RequiredArgsConstructor
public class HomeService {

    private final NotificationMapper notificationMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final UserFollowMapper userFollowMapper;
    private final ArticleMapper articleMapper;
    private final WorkingDraftMapper draftMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final ReadingService readingService;
    private final RecommendationService recommendationService;
    private final ContentCoverService contentCoverService;
    private final HomeFeedEnrichmentService enrichmentService;

    public HomeCompositionView compose(CommunityUser user) {
        long unread = user == null ? 0L : notificationMapper.countUnread(user.getId());
        List<SearchResultView> discoveries = toSearchViews(searchDocumentMapper.listActiveByHot(10));
        List<SearchResultView> followingUpdates = user == null ? List.of() : followingUpdatesFor(user);

        // One enrichment pass across both rails — see HomeFeedEnrichmentService.
        List<HomeFeedEnrichmentService.FeedObject> refs = new ArrayList<>();
        refs.addAll(HomeFeedEnrichmentService.refsOfViews(discoveries));
        refs.addAll(HomeFeedEnrichmentService.refsOfViews(followingUpdates));
        // The guest endpoint serves signed-in users too (AppLayout counts unread from it), so
        // pass the viewer when there is one — `bookmarked` is viewer-scoped.
        Map<String, HomeFeedEnrichmentService.Presentation> enrichment =
                enrichmentService.enrich(refs, user == null ? null : user.getId());

        return HomeCompositionView.builder()
                .unreadNotifications(unread)
                .continueReading(List.of())
                .followingUpdates(enrichmentService.applyViews(followingUpdates, enrichment))
                .discoveries(enrichmentService.applyViews(discoveries, enrichment))
                .build();
    }

    public MeHomeView composeForMe(CommunityUser user) {
        List<ContentCardView> continueReading = readingService.continueReading(user, 10);
        List<ContentCardView> followUpdates = followingUpdatesFor(user).stream()
                .map(this::toContentCard)
                .toList();
        List<ContentCardView> recommendations = recommendationService.recommend(user, 12).getItems();
        List<ContentCardView> draftArticles = articleMapper.listByOwnerId(user.getId()).stream()
                .filter(ArticleStateSupport::isActiveLifecycle)
                .filter(article -> ArticleStateSupport.EDITORIAL_DRAFT.equals(article.getStatus()))
                .limit(6)
                .map(article -> {
                    var draft = draftMapper.findByArticleId(article.getId());
                    return ContentCardView.builder()
                            .id(article.getId())
                            .title(draft == null ? "未命名草稿" : draft.getTitle())
                            .summary(draft == null ? null : draft.getSummary())
                            .updatedAt(article.getUpdatedAt())
                            .build();
                })
                .toList();
        List<PendingActionView> pendingActions = new ArrayList<>();
        for (Article article : articleMapper.listByOwnerId(user.getId())) {
            if (!ArticleStateSupport.isActiveLifecycle(article)) {
                continue;
            }
            if (ArticleStateSupport.isUnderReview(article)) {
                pendingActions.add(new PendingActionView(
                        "REVIEW",
                        "文章审核中",
                        "/studio/reviewing"));
            }
        }

        // One enrichment pass across all three content rails.
        List<HomeFeedEnrichmentService.FeedObject> refs = new ArrayList<>();
        refs.addAll(HomeFeedEnrichmentService.refsOfCards(continueReading));
        refs.addAll(HomeFeedEnrichmentService.refsOfCards(followUpdates));
        refs.addAll(HomeFeedEnrichmentService.refsOfCards(recommendations));
        Map<String, HomeFeedEnrichmentService.Presentation> enrichment =
                enrichmentService.enrich(refs, user.getId());

        return MeHomeView.builder()
                .continueReading(enrichmentService.applyCards(continueReading, enrichment))
                .followUpdates(enrichmentService.applyCards(followUpdates, enrichment))
                .recommendations(enrichmentService.applyCards(recommendations, enrichment))
                .draftArticles(draftArticles)
                .pendingActions(pendingActions)
                .build();
    }

    private List<SearchResultView> followingUpdatesFor(CommunityUser user) {
        List<String> followeeIds = userFollowMapper.listFolloweeIdsByFollower(user.getId());
        if (followeeIds.isEmpty()) {
            return List.of();
        }
        List<SearchDocument> documents = new ArrayList<>();
        for (String followeeId : followeeIds) {
            for (Article article : articleMapper.listByOwnerId(followeeId)) {
                if (!ArticleStateSupport.isActiveLifecycle(article) || !ArticleStateSupport.isPublished(article)) {
                    continue;
                }
                SearchDocument document = searchDocumentMapper.findByObject("ARTICLE", article.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
            for (Series series : seriesMapper.listByOwnerId(followeeId)) {
                if (!"ACTIVE".equals(series.getStatus())) {
                    continue;
                }
                SearchDocument document = searchDocumentMapper.findByObject("SERIES", series.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
            for (Moment moment : momentMapper.listByAuthorId(followeeId, 5)) {
                SearchDocument document = searchDocumentMapper.findByObject("MOMENT", moment.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
        }
        return documents.stream()
                .sorted((left, right) -> right.getIndexedAt().compareTo(left.getIndexedAt()))
                .limit(10)
                .map(this::toSearchView)
                .toList();
    }

    public PageResultView<ContentCardView> discover(int limit, String cursor) {
        if (limit <= 0) {
            limit = 20;
        }
        List<ContentCardView> items = recommendationService.recommend(null, limit).getItems();
        // Same enrichment the home rails get. `ContentCard` renders `authorName`, so without
        // this the discover grid shows anonymous cards while the home feed shows authors —
        // the same content, described two different ways.
        // No viewer here: /discover is a public endpoint and takes no session.
        List<ContentCardView> enriched = enrichmentService.applyCards(
                items, enrichmentService.enrich(HomeFeedEnrichmentService.refsOfCards(items), null));
        return PageResultView.<ContentCardView>builder()
                .items(enriched)
                .nextCursor(null)
                .total((long) enriched.size())
                .build();
    }

    private List<SearchResultView> toSearchViews(List<SearchDocument> docs) {
        return docs.stream().map(this::toSearchView).toList();
    }

    private SearchResultView toSearchView(SearchDocument doc) {
        return SearchResultView.builder()
                .objectType(doc.getObjectType())
                .objectId(doc.getObjectId())
                .title(doc.getTitle())
                .summary(doc.getSummary())
                .cover(contentCoverService.resolveCoverUrl(doc))
                // `indexedAt` is the only timestamp this document carries; SearchService
                // already treats it as the hit's updatedAt, so the two surfaces agree.
                .updatedAt(doc.getIndexedAt() == null ? null : doc.getIndexedAt().toString())
                .build();
    }

    private ContentCardView toContentCard(SearchResultView view) {
        return ContentCardView.builder()
                .id(view.getObjectId())
                .objectType(view.getObjectType())
                .title(view.getTitle())
                .summary(view.getSummary())
                .cover(view.getCover())
                .build();
    }
}

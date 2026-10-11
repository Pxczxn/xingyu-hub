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
        List<SearchResultView> discoveries = toSearchViews(searchDocumentMapper.listActiveByHot(null, 10));
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

    /**
     * 关注流（Phase 6.1 批量化，2026-10-11）。
     *
     * <p>旧实现逐 followee 逐内容回表（1 + F×(2 + A + S + 5) 查询，F=50 时
     * 实测 354 次）——现在按作者集合三次批量取数（每类型一次，业务规则
     * 在 SQL 内保持与逐条路径一致：ARTICLE=PUBLISHED+ACTIVE、SERIES=ACTIVE、
     * MOMENT=PUBLISHED 且每人最近 5 条窗口函数）。合并后仍按 indexed_at 取
     * 最新 10 条——排序与数量约束不变。
     *
     * <p>一致性边界：可见性规则由事件管线保证（发布/生命周期/治理变化实时
     * 同步 search_document），与逐条路径共享同一真相源。
     */
    private List<SearchResultView> followingUpdatesFor(CommunityUser user) {
        List<String> followeeIds = userFollowMapper.listFolloweeIdsByFollower(user.getId());
        if (followeeIds.isEmpty()) {
            return List.of();
        }
        List<SearchDocument> documents = new ArrayList<>();
        documents.addAll(searchDocumentMapper.findLiveArticlesByOwnerIds(followeeIds));
        documents.addAll(searchDocumentMapper.findLiveSeriesByOwnerIds(followeeIds));
        documents.addAll(searchDocumentMapper.findRecentMomentsByAuthorIds(followeeIds, 5));
        return documents.stream()
                .sorted((left, right) -> right.getIndexedAt().compareTo(left.getIndexedAt()))
                .limit(10)
                .map(this::toSearchView)
                .toList();
    }

    public PageResultView<ContentCardView> discover(int limit, String cursor) {
        // Phase 5（2026-10-11）：keyset 翻页实现（此前 nextCursor 恒 null、
        // 超过单页的内容不可达）。同样做一轮批量富化，保持与首页 rails 一致
        // 的作者/计数描述；/discover 为公开端点，富化不带 viewer。
        PageResultView<ContentCardView> page = recommendationService.discoverPage(limit, cursor);
        List<ContentCardView> items = page.getItems();
        List<ContentCardView> enriched = enrichmentService.applyCards(
                items, enrichmentService.enrich(HomeFeedEnrichmentService.refsOfCards(items), null));
        // total 缺省（不冒充当前页大小）：keyset 分页无廉价总数，前端契约 optional。
        return PageResultView.<ContentCardView>builder()
                .items(enriched)
                .nextCursor(page.getNextCursor())
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

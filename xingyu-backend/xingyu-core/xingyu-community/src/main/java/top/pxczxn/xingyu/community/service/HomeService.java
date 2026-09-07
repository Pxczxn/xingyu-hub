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
import top.pxczxn.xingyu.community.mapper.CreatorFollowMapper;
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

@Service
@RequiredArgsConstructor
public class HomeService {

    private final NotificationMapper notificationMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CreatorFollowMapper creatorFollowMapper;
    private final ArticleMapper articleMapper;
    private final WorkingDraftMapper draftMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final ReadingService readingService;
    private final RecommendationService recommendationService;

    public HomeCompositionView compose(CommunityUser user) {
        long unread = user == null ? 0L : notificationMapper.countUnread(user.getId());
        List<SearchResultView> discoveries = toSearchViews(searchDocumentMapper.listActive(10));
        List<SearchResultView> followingUpdates = new ArrayList<>();
        if (user != null) {
            followingUpdates = followingUpdatesFor(user);
        }
        return HomeCompositionView.builder()
                .unreadNotifications(unread)
                .continueReading(List.of())
                .followingUpdates(followingUpdates)
                .discoveries(discoveries)
                .build();
    }

    public MeHomeView composeForMe(CommunityUser user) {
        List<ContentCardView> continueReading = readingService.continueReading(user, 10);
        List<ContentCardView> followUpdates = compose(user).getFollowingUpdates().stream()
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
        return MeHomeView.builder()
                .continueReading(continueReading)
                .followUpdates(followUpdates)
                .recommendations(recommendations)
                .draftArticles(draftArticles)
                .pendingActions(pendingActions)
                .build();
    }

    private List<SearchResultView> followingUpdatesFor(CommunityUser user) {
        List<String> creatorIds = creatorFollowMapper.listCreatorIdsByFollower(user.getId());
        if (creatorIds.isEmpty()) {
            return List.of();
        }
        List<SearchDocument> documents = new ArrayList<>();
        for (String creatorId : creatorIds) {
            for (Article article : articleMapper.listByOwnerId(creatorId)) {
                if (!ArticleStateSupport.isActiveLifecycle(article) || !ArticleStateSupport.isPublished(article)) {
                    continue;
                }
                SearchDocument document = searchDocumentMapper.findByObject("ARTICLE", article.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
            for (Series series : seriesMapper.listByOwnerId(creatorId)) {
                if (!"ACTIVE".equals(series.getStatus())) {
                    continue;
                }
                SearchDocument document = searchDocumentMapper.findByObject("SERIES", series.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
            for (Moment moment : momentMapper.listByAuthorId(creatorId, 5)) {
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
        return PageResultView.<ContentCardView>builder()
                .items(items)
                .nextCursor(null)
                .total((long) items.size())
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
                .build();
    }

    private ContentCardView toContentCard(SearchResultView view) {
        return ContentCardView.builder()
                .id(view.getObjectId())
                .objectType(view.getObjectType())
                .title(view.getTitle())
                .summary(view.getSummary())
                .build();
    }

    private ContentCardView toContentCard(SearchDocument doc) {
        return ContentCardView.builder()
                .id(doc.getObjectId())
                .objectType(doc.getObjectType())
                .title(doc.getTitle())
                .summary(doc.getSummary())
                .updatedAt(doc.getIndexedAt())
                .build();
    }
}

package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.FeedItemDTO;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final UserFollowMapper userFollowMapper;
    private final ArticleMapper articleMapper;
    private final MomentMapper momentMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final RecommendationService recommendationService;
    private final ContentCoverService contentCoverService;

    public List<FeedItemDTO> getFeed(CommunityUser user, String type, int page, int size) {
        if (size <= 0) {
            size = 20;
        }
        String normalized = type == null ? "recommended" : type.toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "following" -> getFollowingFeed(user, size);
            case "hot" -> getHotFeed(size);
            case "latest" -> getLatestFeed(size);
            default -> getRecommendedFeed(user, size);
        };
    }

    private List<FeedItemDTO> getFollowingFeed(CommunityUser user, int size) {
        if (user == null) {
            return List.of();
        }
        List<String> followeeIds = userFollowMapper.listFolloweeIdsByFollower(user.getId());
        if (followeeIds.isEmpty()) {
            return List.of();
        }
        List<Article> articles = new ArrayList<>();
        for (Article article : articleMapper.listByOwnerIds(followeeIds)) {
            // Public visibility is decided by the live search document
            // (removed_at IS NULL). Filtering on article.status == PUBLISHED here
            // would drop the published revision while its next revision is
            // IN_REVIEW — the same article search and detail keep serving.
            // Lifecycle stays as a cheap guard.
            if (ArticleStateSupport.isActiveLifecycle(article)) {
                articles.add(article);
            }
        }
        List<Moment> moments = new ArrayList<>();
        for (Moment moment : momentMapper.listRecentByAuthorIds(followeeIds, 10)) {
            if ("VISIBLE".equals(moment.getStatus())) {
                moments.add(moment);
            }
        }
        Map<String, SearchDocument> articleDocuments = liveDocuments(
                "ARTICLE", articles.stream().map(Article::getId).toList());
        Map<String, SearchDocument> momentDocuments = liveDocuments(
                "MOMENT", moments.stream().map(Moment::getId).toList());
        Map<String, String> covers = contentCoverService.resolveDocumentCovers(articleDocuments.values());
        List<FeedItemDTO> items = new ArrayList<>();
        for (Article article : articles) {
            SearchDocument document = articleDocuments.get(article.getId());
            if (document == null) {
                continue;
            }
            items.add(toFeedItem(
                    article.getId(),
                    "ARTICLE",
                    document,
                    article.getOwnerId(),
                    article.getUpdatedAt(),
                    covers.get(article.getId())));
        }
        for (Moment moment : moments) {
            SearchDocument document = momentDocuments.get(moment.getId());
            if (document == null) {
                continue;
            }
            items.add(toFeedItem(
                    moment.getId(),
                    "MOMENT",
                    document,
                    moment.getAuthorId(),
                    moment.getCreatedAt(),
                    null));
        }
        return items.stream()
                .sorted(Comparator.comparing(FeedItemDTO::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(size)
                .toList();
    }

    private List<FeedItemDTO> getRecommendedFeed(CommunityUser user, int size) {
        return recommendationService.recommend(user, size).getItems().stream()
                .map(card -> FeedItemDTO.builder()
                        .id(card.getId())
                        .type(card.getObjectType() == null ? "ARTICLE" : card.getObjectType())
                        .title(card.getTitle())
                        .summary(card.getSummary())
                        .cover(card.getCover())
                        .createdAt(card.getUpdatedAt())
                        .build())
                .toList();
    }

    private List<FeedItemDTO> getHotFeed(int size) {
        List<SearchDocument> documents = searchDocumentMapper.listActiveByHot(null, size * 2).stream()
                .filter(doc -> doc.getRemovedAt() == null)
                .filter(doc -> "ARTICLE".equals(doc.getObjectType()) || "MOMENT".equals(doc.getObjectType()))
                .limit(size)
                .toList();
        Map<String, String> covers = contentCoverService.resolveDocumentCovers(documents);
        return documents.stream()
                .map(doc -> FeedItemDTO.builder()
                        .id(doc.getObjectId())
                        .type(doc.getObjectType())
                        .title(doc.getTitle())
                        .summary(doc.getSummary())
                        .cover("ARTICLE".equals(doc.getObjectType()) ? covers.get(doc.getObjectId()) : null)
                        .createdAt(doc.getIndexedAt())
                        .build())
                .toList();
    }

    private List<FeedItemDTO> getLatestFeed(int size) {
        return getHotFeed(size);
    }

    private Map<String, SearchDocument> liveDocuments(String type, List<String> objectIds) {
        if (objectIds.isEmpty()) {
            return Map.of();
        }
        Map<String, SearchDocument> documents = new HashMap<>();
        for (SearchDocument document : searchDocumentMapper.findLiveByTypeAndIds(type, objectIds)) {
            if (document != null && document.getObjectId() != null) {
                documents.putIfAbsent(document.getObjectId(), document);
            }
        }
        return documents;
    }

    private static FeedItemDTO toFeedItem(
            String id,
            String type,
            SearchDocument document,
            String authorId,
            java.time.Instant createdAt,
            String cover) {
        return FeedItemDTO.builder()
                .id(id)
                .type(type)
                .title(document.getTitle())
                .summary(document.getSummary())
                .cover(cover)
                .authorId(authorId)
                .createdAt(createdAt != null ? createdAt : document.getIndexedAt())
                .build();
    }
}

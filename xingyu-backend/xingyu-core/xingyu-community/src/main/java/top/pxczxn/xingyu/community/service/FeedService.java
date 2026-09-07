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
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final UserFollowMapper userFollowMapper;
    private final ArticleMapper articleMapper;
    private final MomentMapper momentMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final RecommendationService recommendationService;

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
        List<FeedItemDTO> items = new ArrayList<>();
        for (String followeeId : followeeIds) {
            for (Article article : articleMapper.listByOwnerId(followeeId)) {
                if (!ArticleStateSupport.isActiveLifecycle(article) || !ArticleStateSupport.isPublished(article)) {
                    continue;
                }
                FeedItemDTO item = toFeedItemFromDocument("ARTICLE", article.getId(), article.getOwnerId(), article.getUpdatedAt());
                if (item != null) {
                    items.add(item);
                }
            }
            for (Moment moment : momentMapper.listByAuthorId(followeeId, 10)) {
                if (!"VISIBLE".equals(moment.getStatus())) {
                    continue;
                }
                FeedItemDTO item = toFeedItemFromDocument("MOMENT", moment.getId(), moment.getAuthorId(), moment.getCreatedAt());
                if (item != null) {
                    items.add(item);
                }
            }
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
                        .createdAt(card.getUpdatedAt())
                        .build())
                .toList();
    }

    private List<FeedItemDTO> getHotFeed(int size) {
        return searchDocumentMapper.listActive(size * 2).stream()
                .filter(doc -> doc.getRemovedAt() == null)
                .filter(doc -> "ARTICLE".equals(doc.getObjectType()) || "MOMENT".equals(doc.getObjectType()))
                .limit(size)
                .map(doc -> FeedItemDTO.builder()
                        .id(doc.getObjectId())
                        .type(doc.getObjectType())
                        .title(doc.getTitle())
                        .summary(doc.getSummary())
                        .createdAt(doc.getIndexedAt())
                        .build())
                .toList();
    }

    private List<FeedItemDTO> getLatestFeed(int size) {
        return getHotFeed(size);
    }

    private FeedItemDTO toFeedItemFromDocument(String type, String id, String authorId, java.time.Instant createdAt) {
        SearchDocument document = searchDocumentMapper.findByObject(type, id);
        if (document == null || document.getRemovedAt() != null) {
            return null;
        }
        return FeedItemDTO.builder()
                .id(id)
                .type(type)
                .title(document.getTitle())
                .summary(document.getSummary())
                .authorId(authorId)
                .createdAt(createdAt != null ? createdAt : document.getIndexedAt())
                .build();
    }
}

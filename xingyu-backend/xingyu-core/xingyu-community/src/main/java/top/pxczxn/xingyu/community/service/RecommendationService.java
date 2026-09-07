package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.FeaturedContentView;
import top.pxczxn.xingyu.community.dto.RecommendationFeedView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FeaturedContent;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CreatorFollowMapper;
import top.pxczxn.xingyu.community.mapper.FeaturedContentMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final ClientSettingsService clientSettingsService;
    private final FeaturedContentMapper featuredContentMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CreatorFollowMapper creatorFollowMapper;
    private final ArticleMapper articleMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;

    public RecommendationFeedView recommend(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 12;
        }
        boolean personalized = user != null && isPersonalizedEnabled(user);
        List<ContentCardView> items = new ArrayList<>();
        String strategy;

        if (personalized) {
            items.addAll(followBasedCards(user, limit));
            strategy = items.isEmpty() ? "FALLBACK_FEATURED" : "PERSONALIZED_FOLLOW";
        } else {
            strategy = "NON_PERSONALIZED";
        }

        if (items.size() < limit) {
            for (FeaturedContent featured : featuredContentMapper.listActive(limit)) {
                ContentCardView card = toFeaturedCard(featured);
                if (card != null) {
                    items.add(card);
                }
                if (items.size() >= limit) {
                    break;
                }
            }
            if ("NON_PERSONALIZED".equals(strategy)) {
                strategy = "FEATURED";
            } else if (items.size() > 0 && "FALLBACK_FEATURED".equals(strategy)) {
                strategy = "FOLLOW_THEN_FEATURED";
            }
        }

        if (items.size() < limit) {
            for (SearchDocument document : searchDocumentMapper.listActive(limit * 2)) {
                items.add(toContentCard(document));
                if (items.size() >= limit) {
                    break;
                }
            }
            strategy = strategy + "_POPULAR";
        }

        return RecommendationFeedView.builder()
                .strategy(strategy)
                .items(dedupe(items, limit))
                .build();
    }

    public List<FeaturedContentView> listFeaturedForAdmin(int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        return featuredContentMapper.listAll(limit).stream()
                .map(this::toFeaturedView)
                .toList();
    }

    @Transactional
    public FeaturedContentView addFeaturedForAdmin(Map<String, Object> body) {
        String objectType = normalizeObjectType(String.valueOf(body.getOrDefault("objectType", "")));
        String objectId = trimRequired(String.valueOf(body.getOrDefault("objectId", "")), "objectId");
        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "内容不存在或未进入公开索引");
        }
        FeaturedContent featured = new FeaturedContent();
        featured.setId(TokenSupport.newId());
        featured.setObjectType(objectType);
        featured.setObjectId(objectId);
        featured.setSortOrder(parseInt(body.get("sortOrder"), 0));
        featured.setStatus("ACTIVE");
        featured.setCreatedAt(Instant.now());
        featuredContentMapper.insert(featured);
        return toFeaturedView(featured);
    }

    @Transactional
    public void archiveFeaturedForAdmin(String featuredId) {
        FeaturedContent featured = featuredContentMapper.selectById(featuredId);
        if (featured == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        featured.setStatus("ARCHIVED");
        featuredContentMapper.updateById(featured);
    }

    private List<ContentCardView> followBasedCards(CommunityUser user, int limit) {
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
            for (Moment moment : momentMapper.listByAuthorId(creatorId, 3)) {
                SearchDocument document = searchDocumentMapper.findByObject("MOMENT", moment.getId());
                if (document != null && document.getRemovedAt() == null) {
                    documents.add(document);
                }
            }
        }
        return documents.stream()
                .sorted((left, right) -> right.getIndexedAt().compareTo(left.getIndexedAt()))
                .limit(limit)
                .map(this::toContentCard)
                .toList();
    }

    private boolean isPersonalizedEnabled(CommunityUser user) {
        Map<String, Object> settings = clientSettingsService.getSettings(user);
        Object raw = settings.get("personalizedRecommendationEnabled");
        if (raw == null) {
            return true;
        }
        if (raw instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(raw));
    }

    private ContentCardView toFeaturedCard(FeaturedContent featured) {
        SearchDocument document = searchDocumentMapper.findByObject(featured.getObjectType(), featured.getObjectId());
        if (document == null || document.getRemovedAt() != null) {
            return null;
        }
        return toContentCard(document);
    }

    private FeaturedContentView toFeaturedView(FeaturedContent featured) {
        SearchDocument document = searchDocumentMapper.findByObject(featured.getObjectType(), featured.getObjectId());
        return FeaturedContentView.builder()
                .id(featured.getId())
                .objectType(featured.getObjectType())
                .objectId(featured.getObjectId())
                .title(document == null ? featured.getObjectId() : document.getTitle())
                .sortOrder(featured.getSortOrder())
                .status(featured.getStatus())
                .createdAt(featured.getCreatedAt())
                .build();
    }

    private ContentCardView toContentCard(SearchDocument document) {
        return ContentCardView.builder()
                .id(document.getObjectId())
                .objectType(document.getObjectType())
                .title(document.getTitle())
                .summary(document.getSummary())
                .updatedAt(document.getIndexedAt())
                .build();
    }

    private static List<ContentCardView> dedupe(List<ContentCardView> items, int limit) {
        LinkedHashMap<String, ContentCardView> unique = new LinkedHashMap<>();
        for (ContentCardView item : items) {
            String key = item.getObjectType() + ":" + item.getId();
            unique.putIfAbsent(key, item);
            if (unique.size() >= limit) {
                break;
            }
        }
        return new ArrayList<>(unique.values());
    }

    private static String normalizeObjectType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "不能为空");
        }
        return raw.trim();
    }

    private static int parseInt(Object raw, int defaultValue) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }
}

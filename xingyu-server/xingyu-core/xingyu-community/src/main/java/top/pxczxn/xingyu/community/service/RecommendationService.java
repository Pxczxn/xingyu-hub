package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.FeaturedContentView;
import top.pxczxn.xingyu.community.dto.RecommendationFeedView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FeaturedContent;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.mapper.FeaturedContentMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.CursorCodec;
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
    private final UserFollowMapper userFollowMapper;
    private final ArticleMapper articleMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final ContentCoverService contentCoverService;

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
                    /*
                     * `featured = true` comes from a REAL `featured_content` match — the row we
                     * are iterating — and from nothing else. Not from the position it lands in,
                     * not from an index bound, not from `sortOrder` being non-null, and not
                     * from how many ACTIVE rows happen to exist today.
                     */
                    items.add(card.toBuilder().featured(true).build());
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
            for (SearchDocument document : searchDocumentMapper.listActiveByHot(null, limit * 2)) {
                /*
                 * Explicitly `false`, not left null: on THIS surface every card has been
                 * classified, so the client never has to treat "not an editorial pick" and
                 * "this producer does not classify" as the same thing.
                 *
                 * A document that is ALSO an editorial pick would be added above first, and
                 * `dedupe` keeps the first occurrence — so the surviving copy is the
                 * `featured = true` one. Ordering is unchanged by any of this.
                 */
                items.add(toContentCard(document).toBuilder().featured(false).build());
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

    /**
     * 发现页（Phase 5，2026-10-11）：统一的"最新内容"keyset 流。
     *
     * <p>此前 discover 复用 recommend(null, limit)（featured 池 + hot 池拼接、
     * 忽略 cursor、nextCursor 恒 null）——超过单页的内容经公开分发面不可达
     * （真实阻断）。现在固定排序 (indexed_at DESC, object_id DESC) +
     * keyset 游标：跨页不重不漏，且不受点赞数变化影响。
     *
     * <p>非法/伪造 cursor 回退首页（游标是透明的续读标记，不是权限边界）。
     */
    public PageResultView<ContentCardView> discoverPage(int limit, String cursor) {
        if (limit <= 0) {
            limit = 20;
        }
        List<SearchDocument> documents;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null) {
                // Phase 5.1：非法 cursor 是明确的客户端错误（400），不再静默回首页——
                // 静默重置会让用户在不知情中重复看到第一页。
                throw new FieldContractException("cursor", "分页游标无效或已过期，请从第一页重新浏览");
            }
            documents = searchDocumentMapper.listActiveByRecencyAfter(
                    Instant.ofEpochMilli(Long.parseLong(parts[1])), parts[0], parts[2], limit);
        } else {
            documents = searchDocumentMapper.listActiveByRecency(limit);
        }
        List<ContentCardView> items = documents.stream().map(this::toContentCard).toList();
        String nextCursor = items.size() == limit && !documents.isEmpty()
                ? CursorCodec.encode(
                        documents.get(documents.size() - 1).getObjectType(),
                        documents.get(documents.size() - 1).getIndexedAt(),
                        documents.get(documents.size() - 1).getObjectId())
                : null;
        // Phase 5.1：total 不再冒充当前页大小——keyset 分页拿不到廉价总数，
        // 前端契约 total 为 optional，discover 不返回。
        return PageResultView.<ContentCardView>builder()
                .items(items)
                .nextCursor(nextCursor)
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
            for (Moment moment : momentMapper.listByAuthorId(followeeId, 3)) {
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
                .cover(contentCoverService.resolveCoverUrl(document))
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

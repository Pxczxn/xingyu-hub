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
        return discoverPage(limit, cursor, null, null);
    }

    public PageResultView<ContentCardView> discoverPage(int limit, String cursor, String topicId, String type) {
        if (type != null && !List.of("ARTICLE", "SERIES").contains(type)) {
            throw new FieldContractException("type", "不支持的内容类型");
        }
        if (limit <= 0) {
            limit = 20;
        }
        // Phase 5.1-F：查询 limit+1 条探测"是否还有下一页"——items.size()==limit
        // 恰好整页时无法区分"正好穷尽"与"还有更多"，旧判据会在整页倍数处多出
        // 一次空翻页。多取的 1 条只用作探针，不返回给客户端。
        int probeLimit = limit + 1;
        List<SearchDocument> documents;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null) {
                // Phase 5.1：非法 cursor 是明确的客户端错误（400），不再静默回首页——
                // 静默重置会让用户在不知情中重复看到第一页。
                throw new FieldContractException("cursor", "分页游标无效");
            }
            Instant boundary = Instant.ofEpochMilli(Long.parseLong(parts[1]));
            documents = topicId != null || type != null
                    ? searchDocumentMapper.listDiscoverFiltered(topicId, type, boundary, parts[0], parts[2], probeLimit)
                    : searchDocumentMapper.listActiveByRecencyAfter(boundary, parts[0], parts[2], probeLimit);
        } else {
            documents = topicId != null || type != null
                    ? searchDocumentMapper.listDiscoverFiltered(topicId, type, null, null, null, probeLimit)
                    : searchDocumentMapper.listActiveByRecency(probeLimit);
        }
        boolean hasMore = documents.size() > limit;
        List<SearchDocument> page = hasMore ? documents.subList(0, limit) : documents;
        List<ContentCardView> items = page.stream().map(this::toContentCard).toList();
        // 游标 = 最后一条<b>实际返回</b>记录的三元组（不是探针记录）。
        String nextCursor = hasMore
                ? CursorCodec.encode(
                        page.get(page.size() - 1).getObjectType(),
                        page.get(page.size() - 1).getIndexedAt(),
                        page.get(page.size() - 1).getObjectId())
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

    /**
     * 关注优先推荐卡（Phase 6.1 批量化，2026-10-11）：与 HomeService 关注流共享
     * 同一批量取数通道（三类型各一次集合查询），仅"每人动态条数"（3 vs 5）与
     * 输出上限不同。优先级、fallback、去重与可见性规则不变。
     */
    private List<ContentCardView> followBasedCards(CommunityUser user, int limit) {
        List<String> followeeIds = userFollowMapper.listFolloweeIdsByFollower(user.getId());
        if (followeeIds.isEmpty()) {
            return List.of();
        }
        List<SearchDocument> documents = new ArrayList<>();
        documents.addAll(searchDocumentMapper.findLiveArticlesByOwnerIds(followeeIds));
        documents.addAll(searchDocumentMapper.findLiveSeriesByOwnerIds(followeeIds));
        documents.addAll(searchDocumentMapper.findRecentMomentsByAuthorIds(followeeIds, 3));
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

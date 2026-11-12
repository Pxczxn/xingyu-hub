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
import java.util.HashMap;
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
            addFeatured(items, limit);
            if ("NON_PERSONALIZED".equals(strategy)) {
                strategy = "FEATURED";
            } else if (items.size() > 0 && "FALLBACK_FEATURED".equals(strategy)) {
                strategy = "FOLLOW_THEN_FEATURED";
            }
        }

        if (items.size() < limit) {
            addPopular(items, limit);
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
        return discoverPage(limit, cursor, topicId, type, null);
    }

    public PageResultView<ContentCardView> discoverPage(
            int limit, String cursor, String topicId, String type, String sort) {
        return discoverPage(limit, cursor, topicId, type, sort, List.of());
    }

    public PageResultView<ContentCardView> discoverPage(
            int limit, String cursor, String topicId, String type, String sort, List<String> domainIds) {
        if (type != null && !List.of("ARTICLE", "SERIES", "MOMENT").contains(type)) {
            throw new FieldContractException("type", "不支持的内容类型");
        }
        String normalized = normalizeDiscoverSort(sort);
        if ("featured".equals(normalized)) {
            return discoverFeatured(limit, cursor, topicId, type);
        }
        if ("interest".equals(normalized)) {
            return discoverInterest(limit, cursor, topicId, type, domainIds);
        }
        return discoverLatest(limit, cursor, topicId, type);
    }

    /**
     * 点赞序不能做稳定游标（见 SearchDocumentMapper 发现页说明）。
     * 未实现的排序直接拒绝，而不是假装成最新。
     */
    private static String normalizeDiscoverSort(String sort) {
        if (sort == null || sort.isBlank() || "latest".equalsIgnoreCase(sort.trim())) {
            return "latest";
        }
        if ("featured".equalsIgnoreCase(sort.trim())) {
            return "featured";
        }
        if ("interest".equalsIgnoreCase(sort.trim())) {
            return "interest";
        }
        throw new FieldContractException("sort", "不支持的排序");
    }

    private PageResultView<ContentCardView> discoverLatest(int limit, String cursor, String topicId, String type) {
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
        List<ContentCardView> items = contentCards(page);
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

    private PageResultView<ContentCardView> discoverInterest(
            int limit, String cursor, String topicId, String type, List<String> domainIds) {
        if (limit <= 0) {
            limit = 20;
        }
        if ((type != null && !"ARTICLE".equals(type)) || domainIds == null || domainIds.isEmpty()) {
            return PageResultView.<ContentCardView>builder().items(List.of()).build();
        }
        int probeLimit = limit + 1;
        List<SearchDocument> documents;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null || !"ARTICLE".equals(parts[0])) {
                throw new FieldContractException("cursor", "分页游标无效");
            }
            Instant boundary = Instant.ofEpochMilli(Long.parseLong(parts[1]));
            documents = searchDocumentMapper.listDiscoverByDomains(
                    domainIds, topicId, boundary, parts[0], parts[2], probeLimit);
        } else {
            documents = searchDocumentMapper.listDiscoverByDomains(
                    domainIds, topicId, null, null, null, probeLimit);
        }
        boolean hasMore = documents.size() > limit;
        List<SearchDocument> page = hasMore ? documents.subList(0, limit) : documents;
        String nextCursor = hasMore
                ? CursorCodec.encode(
                        page.get(page.size() - 1).getObjectType(),
                        page.get(page.size() - 1).getIndexedAt(),
                        page.get(page.size() - 1).getObjectId())
                : null;
        return PageResultView.<ContentCardView>builder()
                .items(contentCards(page))
                .nextCursor(nextCursor)
                .build();
    }

    private PageResultView<ContentCardView> discoverFeatured(int limit, String cursor, String topicId, String type) {
        if (limit <= 0) {
            limit = 20;
        }
        Integer cursorSort = null;
        String cursorId = null;
        if (cursor != null && !cursor.isBlank()) {
            String[] parts = CursorCodec.decode(cursor);
            if (parts == null || !"FEATURED".equals(parts[0])) {
                throw new FieldContractException("cursor", "分页游标无效");
            }
            long rawSort = Long.parseLong(parts[1]);
            if (rawSort < Integer.MIN_VALUE || rawSort > Integer.MAX_VALUE) {
                throw new FieldContractException("cursor", "分页游标无效");
            }
            cursorSort = (int) rawSort;
            cursorId = parts[2];
        }
        int probeLimit = limit + 1;
        List<FeaturedContent> rows = featuredContentMapper.listDiscover(
                topicId, type, cursorSort, cursorId, probeLimit);
        boolean hasMore = rows.size() > limit;
        List<FeaturedContent> page = hasMore ? rows.subList(0, limit) : rows;
        Map<String, SearchDocument> documents = page.isEmpty() ? Map.of() : liveDocuments(page);
        Map<String, String> covers = coversFor(documents.values());
        List<ContentCardView> items = new ArrayList<>();
        for (FeaturedContent row : page) {
            SearchDocument document = documents.get(documentKey(row.getObjectType(), row.getObjectId()));
            if (document == null) {
                continue;
            }
            items.add(toContentCard(document, covers).toBuilder().featured(true).build());
        }
        FeaturedContent last = page.isEmpty() ? null : page.get(page.size() - 1);
        String nextCursor = hasMore && last != null
                ? CursorCodec.encode("FEATURED", Instant.ofEpochMilli(last.getSortOrder()), last.getId())
                : null;
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
        List<SearchDocument> selected = documents.stream()
                .sorted((left, right) -> right.getIndexedAt().compareTo(left.getIndexedAt()))
                .limit(limit)
                .toList();
        Map<String, String> covers = coversFor(selected);
        return selected.stream()
                .map(document -> toContentCard(document, covers))
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

    private void addFeatured(List<ContentCardView> items, int limit) {
        List<FeaturedContent> featured = featuredContentMapper.listActive(limit);
        if (featured.isEmpty()) {
            return;
        }
        Map<String, SearchDocument> documents = liveDocuments(featured);
        Map<String, String> covers = coversFor(documents.values());
        for (FeaturedContent row : featured) {
            SearchDocument document = documents.get(documentKey(row.getObjectType(), row.getObjectId()));
            if (document == null) {
                continue;
            }
            /*
             * `featured = true` comes from a REAL `featured_content` match — the row we
             * are iterating — and from nothing else. Not from the position it lands in,
             * not from an index bound, not from `sortOrder` being non-null, and not
             * from how many ACTIVE rows happen to exist today.
             */
            items.add(toContentCard(document, covers).toBuilder().featured(true).build());
            if (items.size() >= limit) {
                break;
            }
        }
    }

    private void addPopular(List<ContentCardView> items, int limit) {
        List<SearchDocument> popular = searchDocumentMapper.listActiveByHot(null, limit * 2);
        Map<String, String> covers = coversFor(popular);
        for (SearchDocument document : popular) {
            /*
             * Explicitly `false`, not left null: on THIS surface every card has been
             * classified, so the client never has to treat "not an editorial pick" and
             * "this producer does not classify" as the same thing.
             *
             * A document that is ALSO an editorial pick would be added above first, and
             * `dedupe` keeps the first occurrence — so the surviving copy is the
             * `featured = true` one. Ordering is unchanged by any of this.
             */
            items.add(toContentCard(document, covers).toBuilder().featured(false).build());
            if (items.size() >= limit) {
                break;
            }
        }
    }

    private Map<String, SearchDocument> liveDocuments(List<FeaturedContent> featured) {
        Map<String, List<String>> idsByType = new LinkedHashMap<>();
        for (FeaturedContent row : featured) {
            if (row.getObjectType() == null || row.getObjectId() == null || row.getObjectId().isBlank()) {
                continue;
            }
            List<String> ids = idsByType.computeIfAbsent(row.getObjectType(), key -> new ArrayList<>());
            if (!ids.contains(row.getObjectId())) {
                ids.add(row.getObjectId());
            }
        }
        Map<String, SearchDocument> documents = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : idsByType.entrySet()) {
            for (SearchDocument document : searchDocumentMapper.findLiveByTypeAndIds(entry.getKey(), entry.getValue())) {
                documents.putIfAbsent(documentKey(document.getObjectType(), document.getObjectId()), document);
            }
        }
        return documents;
    }

    private Map<String, String> coversFor(Iterable<SearchDocument> documents) {
        List<String> articleIds = new ArrayList<>();
        for (SearchDocument document : documents) {
            if ("ARTICLE".equals(document.getObjectType())
                    && document.getObjectId() != null
                    && !document.getObjectId().isBlank()
                    && !articleIds.contains(document.getObjectId())) {
                articleIds.add(document.getObjectId());
            }
        }
        if (articleIds.isEmpty()) {
            return Map.of();
        }
        return contentCoverService.resolveArticleCovers(articleIds);
    }

    private static String documentKey(String objectType, String objectId) {
        return objectType + "\u0001" + objectId;
    }

    private List<ContentCardView> contentCards(List<SearchDocument> documents) {
        Map<String, String> covers = coversFor(documents);
        return documents.stream()
                .map(document -> toContentCard(document, covers))
                .toList();
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

    private ContentCardView toContentCard(SearchDocument document, Map<String, String> covers) {
        String cover = "ARTICLE".equals(document.getObjectType()) ? covers.get(document.getObjectId()) : null;
        return ContentCardView.builder()
                .id(document.getObjectId())
                .objectType(document.getObjectType())
                .title(document.getTitle())
                .summary(document.getSummary())
                .cover(cover)
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

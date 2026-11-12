package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.dto.SeriesReadingProgressView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.entity.SeriesReaderState;
import top.pxczxn.xingyu.community.entity.SeriesSubscription;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.SeriesReaderStateMapper;
import top.pxczxn.xingyu.community.mapper.SeriesSubscriptionMapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReadingService {

    private final SeriesReaderStateMapper readerStateMapper;
    private final SeriesSubscriptionMapper seriesSubscriptionMapper;
    private final SeriesMapper seriesMapper;
    private final SeriesChapterMapper seriesChapterMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final ArticleAccessService articleAccessService;
    private final ClientSettingsService clientSettingsService;
    private final ContentCoverService contentCoverService;

    public List<ContentCardView> continueReading(CommunityUser user, int limit) {
        if (user == null || !clientSettingsService.isReadingHistoryEnabled(user)) {
            return List.of();
        }
        if (limit <= 0) {
            limit = 10;
        }
        List<SeriesReaderState> states = readerStateMapper.listRecentByUser(user.getId(), limit);
        if (states.isEmpty()) {
            return List.of();
        }
        Map<String, Series> seriesById = seriesById(states.stream().map(SeriesReaderState::getSeriesId).distinct().toList());
        Map<String, List<SeriesChapter>> chaptersBySeries = chaptersBySeries(states.stream()
                .map(SeriesReaderState::getSeriesId)
                .filter(seriesById::containsKey)
                .distinct()
                .toList());
        List<String> articleIds = new ArrayList<>();
        for (SeriesReaderState state : states) {
            String articleId = documentArticleId(state, seriesById.get(state.getSeriesId()), chaptersBySeries);
            if (articleId != null && !articleIds.contains(articleId)) {
                articleIds.add(articleId);
            }
        }
        Map<String, SearchDocument> documents = documentsByArticle(articleIds);
        List<String> coverIds = new ArrayList<>();
        for (SeriesReaderState state : states) {
            String articleId = coverArticleId(state, seriesById.get(state.getSeriesId()), chaptersBySeries, documents);
            if (articleId != null && !coverIds.contains(articleId)) {
                coverIds.add(articleId);
            }
        }
        Map<String, String> covers = contentCoverService.resolveArticleCovers(coverIds);
        List<ContentCardView> cards = new ArrayList<>();
        for (SeriesReaderState state : states) {
            ContentCardView card = continueCard(state, seriesById, chaptersBySeries, documents, covers);
            if (card != null) {
                cards.add(card);
            }
        }
        return cards;
    }

    public PageResultView<ContentCardView> readingHistory(CommunityUser user, int limit, String cursor) {
        List<ContentCardView> items = continueReading(user, limit);
        return PageResultView.<ContentCardView>builder()
                .items(items)
                .nextCursor(null)
                .total((long) items.size())
                .build();
    }

    public PageResultView<ContentCardView> bookshelf(CommunityUser user, int limit, String cursor) {
        if (user == null) {
            return PageResultView.<ContentCardView>builder()
                    .items(List.of())
                    .nextCursor(null)
                    .total(0L)
                    .build();
        }
        if (limit <= 0) {
            limit = 20;
        }
        List<SeriesSubscription> subscriptions = seriesSubscriptionMapper.listByUserId(user.getId(), limit);
        if (subscriptions.isEmpty()) {
            return PageResultView.<ContentCardView>builder()
                    .items(List.of())
                    .nextCursor(null)
                    .total(0L)
                    .build();
        }
        Map<String, Series> seriesById = seriesById(
                subscriptions.stream().map(SeriesSubscription::getSeriesId).distinct().toList());
        List<ContentCardView> items = new ArrayList<>();
        for (SeriesSubscription subscription : subscriptions) {
            Series series = seriesById.get(subscription.getSeriesId());
            if (series == null) {
                continue;
            }
            items.add(ContentCardView.builder()
                    .id(series.getId())
                    .objectType("SERIES")
                    .title(series.getTitle())
                    .summary(series.getDescription())
                    .updatedAt(subscription.getCreatedAt())
                    .build());
        }
        return PageResultView.<ContentCardView>builder()
                .items(items)
                .nextCursor(null)
                .total((long) items.size())
                .build();
    }

    @Transactional
    public void subscribeSeries(CommunityUser user, String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (seriesSubscriptionMapper.findByUserAndSeries(user.getId(), seriesId) != null) {
            return;
        }
        SeriesSubscription subscription = new SeriesSubscription();
        subscription.setId(TokenSupport.newId());
        subscription.setUserId(user.getId());
        subscription.setSeriesId(seriesId);
        subscription.setCreatedAt(Instant.now());
        seriesSubscriptionMapper.insert(subscription);
    }

    @Transactional
    public void unsubscribeSeries(CommunityUser user, String seriesId) {
        SeriesSubscription subscription = seriesSubscriptionMapper.findByUserAndSeries(user.getId(), seriesId);
        if (subscription != null) {
            seriesSubscriptionMapper.deleteById(subscription.getId());
        }
    }

    /**
     * 记录阅读位置（Phase 3C，2026-10-19）。
     *
     * <p>旧实现只校验"系列存在"，因此任何 articleId 都能被写成有效进度——包括
     * 不属于该系列的文章、草稿、已下架文章。现在写入前必须同时满足：
     * <ol>
     *   <li>系列存在且 ACTIVE（公开可读的同一判据）；</li>
     *   <li>articleId 确实是该系列的章节（宁可不记录，也不制造一个指向系列外的进度）；</li>
     *   <li>该文章当前对这次请求的用户可读。判定与 {@code GET /articles/{id}} 完全
     *       一致（{@link ArticleAccessService}）：PRIVATE / 审核中只有作者可读，
     *       治理隐藏同理；UNLISTED 仍是直接链接可读。</li>
     * </ol>
     *
     * <p>阅读历史开关关闭时：先完成上述校验（请求本身是否有效仍然是确定的），
     * 然后<b>不写库</b>。关闭开关意味着"不要记录我读过什么"，而不是"记录但不展示"。
     *
     * <p>写入使用唯一键 upsert：快速连点章节会并发提交两次，先查后写在第二次会撞
     * {@code (series_id, user_id)} 唯一键。
     */
    @Transactional
    public void recordProgress(CommunityUser user, String seriesId, String articleId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (articleId == null || articleId.isBlank()) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        boolean isChapter = seriesChapterMapper.listBySeriesId(seriesId).stream()
                .anyMatch(chapter -> articleId.equals(chapter.getArticleId()));
        if (!isChapter || !articleAccessService.isReadable(articleId, user)) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!clientSettingsService.isReadingHistoryEnabled(user)) {
            return;
        }
        readerStateMapper.upsertProgress(
                TokenSupport.newId(), seriesId, user.getId(), articleId, Instant.now());
    }

    /**
     * 单个系列的阅读进度（Phase 3C）。
     *
     * <p>只读当前用户自己的记录；游客没有这条路由（{@code /me/**} 需要会话）。
     *
     * <p>"有记录"不等于"能继续"：记录里的章节可能已被移出系列，或文章已不可读。
     * 这两种情况下 {@code chapterArticleId}/{@code chapterIndex} 都返回空，客户端
     * 应回退到"开始阅读"，而不是把读者送进一个打不开的章节或伪造一个序号。
     *
     * <p>阅读历史关闭时返回 {@code readingHistoryEnabled=false} 且不含进度字段——
     * 这与"没有记录"是两种不同的事实，客户端可以据此区分，但都不应展示"继续阅读"。
     */
    public SeriesReadingProgressView readingProgress(CommunityUser user, String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        List<SeriesChapter> chapters = seriesChapterMapper.listBySeriesId(seriesId);
        int chapterCount = chapters.size();

        if (!clientSettingsService.isReadingHistoryEnabled(user)) {
            return SeriesReadingProgressView.builder()
                    .readingHistoryEnabled(false)
                    .chapterCount(chapterCount)
                    .build();
        }

        SeriesReaderState state = readerStateMapper.findBySeriesAndUser(seriesId, user.getId());
        if (state == null || state.getLastReadArticleId() == null) {
            return SeriesReadingProgressView.builder()
                    .readingHistoryEnabled(true)
                    .chapterCount(chapterCount)
                    .build();
        }

        String lastArticleId = state.getLastReadArticleId();
        int index = 0;
        for (int i = 0; i < chapters.size(); i++) {
            if (lastArticleId.equals(chapters.get(i).getArticleId())) {
                index = i + 1;
                break;
            }
        }
        boolean resumable = index > 0 && articleAccessService.isReadable(lastArticleId, user);
        return SeriesReadingProgressView.builder()
                .readingHistoryEnabled(true)
                .chapterArticleId(resumable ? lastArticleId : null)
                .chapterIndex(resumable ? index : null)
                .chapterCount(chapterCount)
                .lastReadAt(state.getLastReadAt())
                .build();
    }

    private ContentCardView continueCard(
            SeriesReaderState state,
            Map<String, Series> seriesById,
            Map<String, List<SeriesChapter>> chaptersBySeries,
            Map<String, SearchDocument> documents,
            Map<String, String> covers) {
        Series series = seriesById.get(state.getSeriesId());
        if (series != null) {
            ContentCardView card = ContentCardView.builder()
                    .id(series.getId())
                    .objectType("SERIES")
                    .title(series.getTitle())
                    .summary(series.getDescription())
                    .updatedAt(state.getLastReadAt())
                    .build();
            return withChapterProgress(
                    card,
                    state,
                    chaptersBySeries.getOrDefault(series.getId(), List.of()),
                    documents,
                    covers);
        }
        if (state.getLastReadArticleId() != null) {
            return articleCard(state.getLastReadArticleId(), documents, covers);
        }
        return null;
    }

    /**
     * Adds "how far did I get" to a continue-reading card.
     *
     * <p>There is NO percentage anywhere in the schema. {@code series_reader_state}
     * records only the last-read article and when; {@code series_chapter} only
     * knows each chapter's ordinal. So progress is expressed in CHAPTERS
     * ({@code chapterIndex} / {@code chapterCount}) — a client must never render a
     * percent number, because nothing here can produce an honest one.
     *
     * <p>The cover is the LAST-READ CHAPTER's cover, not the series' own (a series
     * has no cover column at all). That is deliberate: this card exists to resume
     * the chapter you stopped on, and the label alongside it names that chapter.
     */
    private ContentCardView withChapterProgress(
            ContentCardView card,
            SeriesReaderState state,
            List<SeriesChapter> chapters,
            Map<String, SearchDocument> documents,
            Map<String, String> covers) {
        if (chapters.isEmpty()) {
            return card;
        }
        int index = chapterIndex(chapters, state.getLastReadArticleId());
        String chapterTitle = null;
        String cover = null;
        if (index > 0) {
            SearchDocument document = documents.get(state.getLastReadArticleId());
            chapterTitle = document == null ? null : document.getTitle();
            cover = covers.get(state.getLastReadArticleId());
        }
        // index == 0 means the recorded chapter is no longer part of the series
        // (removed or reordered). Report the total only; a guessed index would be wrong.
        return card.toBuilder()
                .chapterIndex(index > 0 ? index : null)
                .chapterCount(chapters.size())
                .chapterTitle(chapterTitle)
                .cover(cover)
                .build();
    }

    private ContentCardView articleCard(
            String articleId, Map<String, SearchDocument> documents, Map<String, String> covers) {
        SearchDocument document = documents.get(articleId);
        if (document == null) {
            return ContentCardView.builder()
                    .id(articleId)
                    .objectType("ARTICLE")
                    .title(articleId)
                    .build();
        }
        return ContentCardView.builder()
                .id(document.getObjectId())
                .objectType("ARTICLE")
                .title(document.getTitle())
                .summary(document.getSummary())
                .cover(covers.get(articleId))
                .updatedAt(document.getIndexedAt())
                .build();
    }

    private String documentArticleId(
            SeriesReaderState state, Series series, Map<String, List<SeriesChapter>> chaptersBySeries) {
        if (series != null) {
            List<SeriesChapter> chapters = chaptersBySeries.getOrDefault(series.getId(), List.of());
            return chapterIndex(chapters, state.getLastReadArticleId()) > 0 ? state.getLastReadArticleId() : null;
        }
        return state.getLastReadArticleId();
    }

    private String coverArticleId(
            SeriesReaderState state,
            Series series,
            Map<String, List<SeriesChapter>> chaptersBySeries,
            Map<String, SearchDocument> documents) {
        if (series != null) {
            return documentArticleId(state, series, chaptersBySeries);
        }
        String articleId = state.getLastReadArticleId();
        return articleId != null && documents.containsKey(articleId) ? articleId : null;
    }

    private static int chapterIndex(List<SeriesChapter> chapters, String articleId) {
        if (articleId == null) {
            return 0;
        }
        for (int i = 0; i < chapters.size(); i++) {
            if (articleId.equals(chapters.get(i).getArticleId())) {
                return i + 1;
            }
        }
        return 0;
    }

    private Map<String, Series> seriesById(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, Series> seriesById = new HashMap<>();
        for (Series series : seriesMapper.listByIds(ids)) {
            seriesById.putIfAbsent(series.getId(), series);
        }
        return seriesById;
    }

    private Map<String, List<SeriesChapter>> chaptersBySeries(List<String> seriesIds) {
        if (seriesIds.isEmpty()) {
            return Map.of();
        }
        Map<String, List<SeriesChapter>> chapters = new HashMap<>();
        for (SeriesChapter chapter : seriesChapterMapper.listBySeriesIds(seriesIds)) {
            chapters.computeIfAbsent(chapter.getSeriesId(), key -> new ArrayList<>()).add(chapter);
        }
        return chapters;
    }

    private Map<String, SearchDocument> documentsByArticle(List<String> articleIds) {
        if (articleIds.isEmpty()) {
            return Map.of();
        }
        Map<String, SearchDocument> documents = new HashMap<>();
        for (SearchDocument document : searchDocumentMapper.listByTypeAndIds("ARTICLE", articleIds)) {
            documents.putIfAbsent(document.getObjectId(), document);
        }
        return documents;
    }
}

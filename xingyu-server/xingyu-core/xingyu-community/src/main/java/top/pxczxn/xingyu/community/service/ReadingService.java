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
import java.util.List;
import java.util.Objects;

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
        return readerStateMapper.listRecentByUser(user.getId(), limit).stream()
                .map(this::toContinueReadingCard)
                // `toContinueReadingCard` answers null when the series is gone AND no
                // chapter was recorded. Without this filter that null would be
                // serialised as a literal `null` entry inside the feed array.
                .filter(Objects::nonNull)
                .toList();
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
        List<ContentCardView> items = seriesSubscriptionMapper.listByUserId(user.getId(), limit).stream()
                .map(sub -> {
                    Series series = seriesMapper.selectById(sub.getSeriesId());
                    if (series == null) {
                        return null;
                    }
                    return ContentCardView.builder()
                            .id(series.getId())
                            .objectType("SERIES")
                            .title(series.getTitle())
                            .summary(series.getDescription())
                            .updatedAt(sub.getCreatedAt())
                            .build();
                })
                .filter(card -> card != null)
                .toList();
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

    private ContentCardView toContinueReadingCard(SeriesReaderState state) {
        Series series = seriesMapper.selectById(state.getSeriesId());
        if (series != null) {
            ContentCardView card = ContentCardView.builder()
                    .id(series.getId())
                    .objectType("SERIES")
                    .title(series.getTitle())
                    .summary(series.getDescription())
                    .updatedAt(state.getLastReadAt())
                    .build();
            return withChapterProgress(card, state);
        }
        if (state.getLastReadArticleId() != null) {
            return toContentCard("ARTICLE", state.getLastReadArticleId());
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
    private ContentCardView withChapterProgress(ContentCardView card, SeriesReaderState state) {
        List<SeriesChapter> chapters = seriesChapterMapper.listBySeriesId(state.getSeriesId());
        if (chapters.isEmpty()) {
            return card;
        }

        int index = 0;
        for (int i = 0; i < chapters.size(); i++) {
            String articleId = chapters.get(i).getArticleId();
            if (articleId != null && articleId.equals(state.getLastReadArticleId())) {
                index = i + 1;
                break;
            }
        }

        String chapterTitle = null;
        String cover = null;
        if (index > 0) {
            SearchDocument document =
                    searchDocumentMapper.findByObject("ARTICLE", state.getLastReadArticleId());
            chapterTitle = document == null ? null : document.getTitle();
            cover = contentCoverService.resolveArticleCoverUrl("ARTICLE", state.getLastReadArticleId());
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

    private ContentCardView toContentCard(String objectType, String objectId) {
        SearchDocument document = searchDocumentMapper.findByObject(objectType, objectId);
        if (document == null) {
            return ContentCardView.builder()
                    .id(objectId)
                    .objectType(objectType)
                    .title(objectId)
                    .build();
        }
        return ContentCardView.builder()
                .id(document.getObjectId())
                .objectType(objectType)
                .title(document.getTitle())
                .summary(document.getSummary())
                .cover(contentCoverService.resolveCoverUrl(document))
                .updatedAt(document.getIndexedAt())
                .build();
    }
}

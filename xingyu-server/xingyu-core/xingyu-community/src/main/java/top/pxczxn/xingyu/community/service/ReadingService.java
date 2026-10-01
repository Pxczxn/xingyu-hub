package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.PageResultView;
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

    @Transactional
    public void recordProgress(CommunityUser user, String seriesId, String articleId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Instant now = Instant.now();
        SeriesReaderState existing = readerStateMapper.findBySeriesAndUser(seriesId, user.getId());
        if (existing == null) {
            SeriesReaderState state = new SeriesReaderState();
            state.setId(TokenSupport.newId());
            state.setSeriesId(seriesId);
            state.setUserId(user.getId());
            state.setLastReadArticleId(articleId);
            state.setLastReadAt(now);
            state.setFollowing(0);
            state.setCreatedAt(now);
            state.setUpdatedAt(now);
            readerStateMapper.insert(state);
        } else {
            existing.setLastReadArticleId(articleId);
            existing.setLastReadAt(now);
            existing.setUpdatedAt(now);
            readerStateMapper.updateById(existing);
        }
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

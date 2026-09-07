package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesReaderState;
import top.pxczxn.xingyu.community.entity.SeriesSubscription;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
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

@Service
@RequiredArgsConstructor
public class ReadingService {

    private final SeriesReaderStateMapper readerStateMapper;
    private final SeriesSubscriptionMapper seriesSubscriptionMapper;
    private final SeriesMapper seriesMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final ClientSettingsService clientSettingsService;

    public List<ContentCardView> continueReading(CommunityUser user, int limit) {
        if (user == null || !clientSettingsService.isReadingHistoryEnabled(user)) {
            return List.of();
        }
        if (limit <= 0) {
            limit = 10;
        }
        return readerStateMapper.listRecentByUser(user.getId(), limit).stream()
                .map(this::toContinueReadingCard)
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
            return ContentCardView.builder()
                    .id(series.getId())
                    .objectType("SERIES")
                    .title(series.getTitle())
                    .summary(series.getDescription())
                    .updatedAt(state.getLastReadAt())
                    .build();
        }
        if (state.getLastReadArticleId() != null) {
            return toContentCard("ARTICLE", state.getLastReadArticleId());
        }
        return null;
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
                .updatedAt(document.getIndexedAt())
                .build();
    }
}

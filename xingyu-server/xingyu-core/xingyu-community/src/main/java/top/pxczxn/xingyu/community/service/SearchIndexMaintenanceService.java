package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchIndexHealthView;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.core.event.ReliableEventMapper;
import top.pxczxn.xingyu.core.event.ReliableEventStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Operator-facing index maintenance — the 「人工重建索引」 half of product doc §20.3
 * (「索引更新失败必须可重试和人工重建」), plus the health read behind §1840's
 * `/community/search-health`.
 *
 * <p>TWO REBUILD SHAPES, deliberately different:
 * <ul>
 *   <li>{@link #rebuildOne} re-derives a single object INLINE. An operator asking about one
 *       resource wants the answer now, and wants a failure to surface as an error rather than
 *       disappear into a queue.</li>
 *   <li>{@link #rebuildAll} only ENQUEUES one refresh event per object and returns. A full
 *       rebuild can be arbitrarily large, and §1215 is explicit that indexing must not block
 *       the caller — so the existing reliable-event consumer drains it at its own pace, with
 *       retry, and the health read below shows the backlog.</li>
 * </ul>
 *
 * <p>The enqueued events use their own event id namespace ({@code rebuild:<run>:<objectId>})
 * rather than reusing the lifecycle ids. That matters: reusing them would let the outbox
 * deduplicate a rebuild against an event that was already processed, so a second rebuild
 * would silently do nothing.
 */
@Service
@RequiredArgsConstructor
public class SearchIndexMaintenanceService {

    private final ArticleMapper articleMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final ReliableEventMapper reliableEventMapper;
    private final SearchIndexService searchIndexService;
    private final CommunityEventSupport eventSupport;

    /** Re-derives one object's index entry, inline. Idempotent. */
    @Transactional
    public void rebuildOne(String objectType, String objectId) {
        searchIndexService.refresh(objectType, objectId);
    }

    /**
     * Queues a refresh for every object that belongs in the public index.
     *
     * <p>Returns how many events were queued — NOT how many rows changed, because nothing has
     * been consumed yet at that point. Read {@link #health} to watch it drain.
     *
     * <p>Deliberately NOT {@code @Transactional}: each enqueue then commits on its own, so a
     * full rebuild does not become one enormous transaction, and an interrupted run keeps the
     * progress it made. Re-running is safe — the handler re-derives rather than accumulating.
     */
    public long rebuildAll() {
        long runId = Instant.now().toEpochMilli();
        long queued = 0;
        queued += enqueue(SearchIndexService.ARTICLE, articleMapper.listIndexableIds(), runId);
        queued += enqueue(SearchIndexService.SERIES, seriesMapper.listIndexableIds(), runId);
        queued += enqueue(SearchIndexService.MOMENT, momentMapper.listIndexableIds(), runId);
        return queued;
    }

    public SearchIndexHealthView health() {
        return SearchIndexHealthView.builder()
                .indexed(searchDocumentMapper.countLive())
                .removed(searchDocumentMapper.countRemoved())
                .pendingEvents(
                        reliableEventMapper.countByStatus(ReliableEventStatus.PENDING.name())
                                + reliableEventMapper.countByStatus(
                                        ReliableEventStatus.PROCESSING.name()))
                .failedEvents(reliableEventMapper.countByStatus(ReliableEventStatus.FAILED.name()))
                .isolatedEvents(
                        reliableEventMapper.countByStatus(ReliableEventStatus.ISOLATED.name()))
                .build();
    }

    private long enqueue(String objectType, List<String> objectIds, long runId) {
        if (objectIds == null || objectIds.isEmpty()) {
            return 0;
        }
        long queued = 0;
        for (String objectId : objectIds) {
            if (objectId == null || objectId.isBlank()) {
                continue;
            }
            // `rebuild:<runId>:<objectId>` = 8 + 13 + 1 + 36 = 58 chars, inside the
            // varchar(64) of reliable_event.event_id. CommunityEventSupport also guards it.
            eventSupport.publishContentEvent(
                    "rebuild:" + runId + ":" + objectId,
                    CommunityEventSupport.REBUILD_REQUESTED,
                    aggregateTypeOf(objectType),
                    objectId);
            queued++;
        }
        return queued;
    }

    private static String aggregateTypeOf(String objectType) {
        return switch (objectType) {
            case SearchIndexService.ARTICLE -> CommunityEventSupport.AGGREGATE_TYPE_ARTICLE;
            case SearchIndexService.SERIES -> CommunityEventSupport.AGGREGATE_TYPE_SERIES;
            case SearchIndexService.MOMENT -> CommunityEventSupport.AGGREGATE_TYPE_MOMENT;
            default -> throw new IllegalArgumentException(
                    "not an indexed object type: " + objectType);
        };
    }
}

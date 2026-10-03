package top.pxczxn.xingyu.community.support;

import top.pxczxn.xingyu.common.contract.EventEnvelope;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.community.service.SearchIndexService;
import top.pxczxn.xingyu.core.event.ReliableEventHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Drives the public search index from the content lifecycle events.
 *
 * <p>This is the handler the product doc §20.3 asks for: 「发布、隐藏、删除、恢复、账号冻结等
 * 事件都必须驱动索引更新」. The event plumbing already existed — {@code CommunityEventSupport}
 * had been publishing article lifecycle events all along — but nothing ever consumed them,
 * which is why {@code search_document} stayed empty and no published content ever appeared in
 * the home feed, search, topics or discovery.
 *
 * <p>THE CONSUMER CALLS EVERY HANDLER FOR EVERY EVENT, so filtering is this class's job: an
 * unrecognised aggregate or event type returns immediately. That is not an error path — most
 * events on the bus belong to somebody else.
 *
 * <p>WHY ONLY SOME EVENT TYPES PER AGGREGATE. The handler re-derives state instead of
 * applying a delta, so it is always safe to run; the filter exists purely to avoid pointless
 * work:
 * <ul>
 *   <li>ARTICLE — {@code PublicationSucceeded} (just published or re-published) and
 *       {@code ReviewDecisionRecorded} (an approval publishes; a rejection returns the
 *       article to DRAFT, and a never-published one simply has nothing to remove).
 *       {@code DraftChanged} fires on every autosave and cannot change the PUBLIC title or
 *       summary, which come from the published revision; {@code RevisionSubmitted} moves the
 *       article to IN_REVIEW while the published revision stays readable. Both are skipped.</li>
 *   <li>SERIES / MOMENT — one "changed" event each, because every mutation that can alter
 *       visibility or text goes through the same service method that publishes it.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class SearchIndexEventHandler implements ReliableEventHandler {

    /** aggregateType on the wire (lowercase) -> the object type the index uses. */
    private static final Map<String, String> INDEXED_AGGREGATES = Map.of(
            CommunityEventSupport.AGGREGATE_TYPE_ARTICLE, SearchIndexService.ARTICLE,
            CommunityEventSupport.AGGREGATE_TYPE_SERIES, SearchIndexService.SERIES,
            CommunityEventSupport.AGGREGATE_TYPE_MOMENT, SearchIndexService.MOMENT);

    /** Object type -> the event types worth acting on. */
    private static final Map<String, Set<String>> INDEXABLE_EVENTS = Map.of(
            SearchIndexService.ARTICLE, Set.of(
                    CommunityEventSupport.PUBLICATION_SUCCEEDED,
                    CommunityEventSupport.REVIEW_DECISION_RECORDED,
                    CommunityEventSupport.REBUILD_REQUESTED),
            SearchIndexService.SERIES, Set.of(
                    CommunityEventSupport.SERIES_CHANGED,
                    CommunityEventSupport.REBUILD_REQUESTED),
            SearchIndexService.MOMENT, Set.of(
                    CommunityEventSupport.MOMENT_CHANGED,
                    CommunityEventSupport.REBUILD_REQUESTED));

    private final SearchIndexService searchIndexService;

    @Override
    public void handle(EventEnvelope envelope, String payloadJson) {
        if (envelope == null || envelope.getAggregateType() == null) {
            return;
        }

        String indexedType = INDEXED_AGGREGATES.get(
                envelope.getAggregateType().trim().toLowerCase(Locale.ROOT));
        if (indexedType == null) {
            return;
        }

        Set<String> eventTypes = INDEXABLE_EVENTS.get(indexedType);
        if (eventTypes == null || !eventTypes.contains(envelope.getEventType())) {
            return;
        }

        ObjectId aggregateId = envelope.getAggregateId();
        if (aggregateId == null || aggregateId.value() == null || aggregateId.value().isBlank()) {
            return;
        }

        searchIndexService.refresh(indexedType, aggregateId.value());
    }
}

package top.pxczxn.xingyu.community.support;

import top.pxczxn.xingyu.common.contract.EventEnvelope;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.core.event.ReliableEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Publishes community content-lifecycle events onto the reliable-event outbox.
 *
 * <p>The envelope carries METADATA ONLY (event id, type, aggregate type + id) — never a body
 * or a credential. Consumers therefore re-read the aggregate instead of applying a delta,
 * which is what makes replay safe. See {@link SearchIndexEventHandler} for the first consumer.
 *
 * <p>Publishing is transactional: {@code ReliableEventPublisher.publish} joins the caller's
 * transaction, so an event is only ever visible if the state change it describes commits.
 */
@Component
@RequiredArgsConstructor
public class CommunityEventSupport {

    public static final String AGGREGATE_TYPE_ARTICLE = "article";
    public static final String AGGREGATE_TYPE_SERIES = "series";
    public static final String AGGREGATE_TYPE_MOMENT = "moment";

    public static final int EVENT_VERSION = 1;
    public static final int CONSUMER_SCHEMA_VERSION = 1;

    public static final String DRAFT_CHANGED = "DraftChanged";
    public static final String REVISION_SUBMITTED = "RevisionSubmitted";
    public static final String REVIEW_DECISION_RECORDED = "ReviewDecisionRecorded";
    public static final String PUBLICATION_SUCCEEDED = "PublicationSucceeded";
    public static final String SERIES_CHANGED = "SeriesChanged";
    public static final String MOMENT_CHANGED = "MomentChanged";
    /**
     * An operator asked for this object's index entry to be re-derived. Distinct from the
     * lifecycle events so a rebuild cannot be deduplicated away against an event that was
     * already processed.
     */
    public static final String REBUILD_REQUESTED = "RebuildRequested";

    /**
     * `reliable_event.event_id` is varchar(64).
     *
     * <p>Checked here rather than left to MySQL, because exceeding it fails the insert and
     * therefore the WHOLE caller transaction — a moment creation would answer 500 with nothing
     * in the message pointing at the event id. That is exactly how a 65-character id slipped
     * through once.
     */
    private static final int EVENT_ID_MAX_LENGTH = 64;

    private final ReliableEventPublisher eventPublisher;

    public void publishArticleEvent(String eventId, String eventType, String articleId) {
        publishContentEvent(eventId, eventType, AGGREGATE_TYPE_ARTICLE, articleId);
    }

    /**
     * Publishes one content-lifecycle event.
     *
     * <p>{@code eventId} is the deduplication key, so callers must make it deterministic per
     * state change (e.g. include the aggregate's lock version or timestamp) — re-publishing
     * the same id is a silent no-op, which is what keeps a retried publish from queueing a
     * second event.
     */
    public void publishContentEvent(
            String eventId, String eventType, String aggregateType, String aggregateId) {
        if (eventId == null || eventId.isBlank() || eventId.length() > EVENT_ID_MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "event id must be 1.." + EVENT_ID_MAX_LENGTH + " chars, got "
                            + (eventId == null ? "null" : eventId.length() + " (" + eventId + ")"));
        }
        EventEnvelope envelope = eventPublisher.envelope(
                eventId,
                eventType,
                EVENT_VERSION,
                aggregateType,
                ObjectId.of(aggregateId),
                eventId,
                null,
                CONSUMER_SCHEMA_VERSION);
        try {
            eventPublisher.publish(envelope, eventPublisher.toJson(envelope));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to publish event: " + eventType, ex);
        }
    }
}

package top.pxczxn.xingyu.community.support;

import top.pxczxn.xingyu.common.contract.EventEnvelope;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.core.event.ReliableEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CommunityEventSupport {

    public static final String AGGREGATE_TYPE_ARTICLE = "article";
    public static final int EVENT_VERSION = 1;
    public static final int CONSUMER_SCHEMA_VERSION = 1;

    public static final String DRAFT_CHANGED = "DraftChanged";
    public static final String REVISION_SUBMITTED = "RevisionSubmitted";
    public static final String REVIEW_DECISION_RECORDED = "ReviewDecisionRecorded";
    public static final String PUBLICATION_SUCCEEDED = "PublicationSucceeded";

    private final ReliableEventPublisher eventPublisher;

    public void publishArticleEvent(String eventId, String eventType, String articleId) {
        EventEnvelope envelope = eventPublisher.envelope(
                eventId,
                eventType,
                EVENT_VERSION,
                AGGREGATE_TYPE_ARTICLE,
                ObjectId.of(articleId),
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

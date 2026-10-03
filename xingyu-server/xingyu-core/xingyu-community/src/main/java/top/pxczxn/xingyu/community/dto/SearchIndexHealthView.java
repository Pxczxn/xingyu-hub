package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * Operational view of the public search index — the 「搜索索引健康」 half of the product doc
 * §1840 admin entry.
 *
 * <p>`indexed` / `removed` describe the PROJECTION (`search_document`); the three event counts
 * describe the OUTBOX that keeps it in step. Reading them together is what makes the view
 * useful: a healthy index with a growing `failedEvents` is not healthy, and a large
 * `pendingEvents` explains why content published a moment ago is not searchable yet.
 *
 * <p>`isolatedEvents` is the dead-letter count — §20.3 requires that failed index updates be
 * retryable and visible, and ISOLATED is where the consumer parks an event it has given up on
 * (either it exhausted `maxAttempts`, or its `eventVersion` is newer than this build knows).
 */
@Value
@Builder
public class SearchIndexHealthView {
    /** Rows currently live in the index. */
    long indexed;
    /** Rows kept but marked not-public (a re-publish restores them). */
    long removed;
    /** Events queued or being processed right now. */
    long pendingEvents;
    /** Events that failed but will be retried. */
    long failedEvents;
    /** Dead letter: events the consumer gave up on and an operator must look at. */
    long isolatedEvents;
}

package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * One row's worth of content destined for the public search index.
 *
 * <p>Deliberately minimal: the index stores a title and a summary and nothing else, so
 * anything the caller has to hand over beyond that is something the index does not model.
 *
 * <p>{@code title} is NOT NULL in the schema — an entry without one cannot be indexed, and
 * the provider treats a blank title as "remove" rather than writing an unsearchable row.
 */
@Value
@Builder
public class SearchIndexEntry {
    String objectType;
    String objectId;
    String title;
    String summary;
}

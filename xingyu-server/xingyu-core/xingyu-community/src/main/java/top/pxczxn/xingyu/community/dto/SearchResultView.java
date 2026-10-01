package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/**
 * A search / feed hit.
 *
 * <p>{@code avatar} and {@code updatedAt} have always existed on this DTO but
 * only {@code SearchService} used to populate them. {@code HomeService} now fills
 * them too, along with {@code authorName} and the interaction counters, so the
 * home feed can render the same rich row as the search results.
 *
 * <p>All of these are optional on the wire: a producer that cannot resolve one
 * leaves it null rather than guessing, and the client must degrade.
 */
@Value
@Builder
public class SearchResultView {
    String objectType;
    String objectId;
    String title;
    String summary;
    String cover;
    String avatar;
    String updatedAt;

    // ---- presentation fields, filled by HomeFeedEnrichmentService ----
    String authorName;
    Long likeCount;
    Long commentCount;
    List<String> tags;
    /** Viewer-scoped: null when nobody is signed in. See ContentCardView#bookmarked. */
    Boolean bookmarked;
    /** Viewer-scoped like state. Null when nobody is signed in. */
    Boolean liked;
}

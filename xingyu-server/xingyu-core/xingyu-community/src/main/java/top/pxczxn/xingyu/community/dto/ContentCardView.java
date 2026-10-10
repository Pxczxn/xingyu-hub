package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

/**
 * One content card in a feed / list surface.
 *
 * <p>The first block is what the producing services fill in from
 * {@code search_document} plus their own domain lookups. The second block
 * ({@code authorName} / {@code avatar} / {@code likeCount} / {@code commentCount}
 * / {@code tags}) is filled by {@code HomeFeedEnrichmentService} in ONE batched
 * pass, so a feed of N rows costs a fixed number of queries rather than N —
 * never add a per-row lookup for these.
 *
 * <p>{@code chapterIndex} / {@code chapterCount} / {@code chapterTitle} are only
 * meaningful on SERIES cards produced by continue-reading; they describe how far
 * the reader got. They are derived from {@code series_chapter.position}, because
 * the schema has no per-chapter percentage — so the UI must describe progress in
 * CHAPTERS, never invent a percent number.
 */
@Value
@Builder(toBuilder = true)
public class ContentCardView {
    String id;
    String objectType;
    String title;
    String summary;
    String cover;
    String authorName;
    Instant updatedAt;

    /**
     * Whether this card is an EDITORIAL PICK, or null when the producing surface does not
     * classify at all.
     *
     * <p>Deliberately a tri-state rather than a primitive {@code boolean}: a primitive would
     * force every producer to answer, and the ones that do not know would have to answer
     * {@code false} — which is a claim, not an absence. Null means "this producer does not
     * sort content into picks and non-picks", which is true of continue-reading,
     * reading-history and the follow rails.
     *
     * <p>Set only by {@link top.pxczxn.xingyu.community.service.RecommendationService}, from a
     * real {@code featured_content} match — never from return position, an index bound, a
     * non-null sortOrder, or the current count of ACTIVE rows. A card that is BOTH an
     * editorial pick and a popular candidate keeps {@code featured = true}: the dedupe pass
     * keeps the first occurrence, and picks are appended before the popular fill.
     *
     * <p>Nothing about the ordering internals is exposed here on purpose. The client is told
     * one bit — "editorial pick or not" — and not rank, slot, source or strategy; those are
     * server-side ranking concerns and would freeze an implementation detail into the API.
     */
    Boolean featured;

    // ---- presentation fields, filled by HomeFeedEnrichmentService ----
    String avatar;
    Long likeCount;
    Long commentCount;
    List<String> tags;
    /**
     * Whether the VIEWER has bookmarked this object.
     *
     * <p>Null when nobody is signed in — "we do not know" must not be rendered as "not
     * bookmarked", or a guest would see an already-bookmarked item as un-bookmarked. Unlike
     * the counters above this field is viewer-scoped, which is why the enrichment pass takes
     * a viewer id.
     */
    Boolean bookmarked;
    /** Viewer-scoped like state. Null when nobody is signed in — see {@link #bookmarked}. */
    Boolean liked;

    // ---- continue-reading progress (SERIES only) ----
    /** 1-based position of the chapter the reader last opened, or null. */
    Integer chapterIndex;
    /** Total chapters in the series, or null when it cannot be determined. */
    Integer chapterCount;
    /** Title of the chapter the reader last opened, or null. */
    String chapterTitle;
}

/*
 * Truly cross-domain types shared by home / discover / search / topics.
 * Extracted from the Legacy community API module (NOT the whole file).
 * Domain-specific types live next to their API module.
 */

/**
 * A content row as the UI consumes it.
 *
 * The presentation fields below (`authorName` / `avatar` / `likeCount` /
 * `commentCount` / `tags`) are filled server-side by `HomeFeedEnrichmentService`
 * for the home rails. They are OPTIONAL on purpose: older payloads and other
 * surfaces (search, topics) do not carry all of them, and the UI must render a
 * missing value as absent rather than invent a placeholder.
 */
export type ContentSummary = {
  id: string;
  title: string;
  summary?: string;
  authorName?: string;
  updatedAt?: string;
  readMinutes?: number;
  cover?: string;
  avatar?: string;
  objectType?: string;
  /** Likes on this object. `undefined` means "not reported", which is not 0. */
  likeCount?: number;
  /** Visible comments only — matches what the detail page will list. */
  commentCount?: number;
  /** Topic names this content is filed under. Empty for series / moments. */
  tags?: string[];
  /**
   * Whether the VIEWER has bookmarked this. Viewer-scoped, so `undefined` means "nobody is
   * signed in" and is NOT the same as `false` — rendering an unknown as "not saved" would
   * show a signed-out reader the wrong toggle state.
   */
  bookmarked?: boolean;
  /** Viewer-scoped like state. `undefined` means "nobody is signed in" — see `bookmarked`. */
  liked?: boolean;
  /*
   * Whether this item is an EDITORIAL PICK.
   *
   * Tri-state on purpose, mirroring the server DTO:
   *   true      the producer matched it against `featured_content` — a real pick
   *   false     the producer classified it and it is NOT a pick
   *   undefined this surface does not classify at all (continue-reading, search,
   *             topic lists, reading history)
   *
   * Only `/api/v1/discover` sets it today, and it sets it on every item, so a
   * Discover list never hides an unclassified row behind `false`.
   *
   * The server tells us ONE bit. There is no slot / rank / source / strategy
   * field and there should not be: how the mix was assembled is a ranking
   * concern, and exposing it would freeze an implementation detail into the API.
   */
  featured?: boolean;
  /*
   * Continue-reading only, and only for SERIES rows.
   *
   * These describe the reader's position in CHAPTERS. There is no percentage in
   * the schema — `series_reader_state` stores just the last-read article — so no
   * surface may render a "%" figure; see ContinueReadingStrip.
   */
  chapterIndex?: number;
  chapterCount?: number;
  chapterTitle?: string;
};

export type PageResult<T> = {
  items: T[];
  nextCursor?: string | null;
  total?: number;
};

/** Raw shape of a home-composition row (`SearchResultView` on the wire). */
export type SearchHit = {
  objectType: string;
  objectId: string;
  title: string;
  summary?: string;
  cover?: string;
  avatar?: string;
  updatedAt?: string;
  authorName?: string;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  bookmarked?: boolean;
  liked?: boolean;
  /** See `ContentSummary.featured`. Absent on search hits — search does not classify. */
  featured?: boolean;
};

export type CursorInput = {
  cursor?: string;
  limit?: number;
};

export type AnnouncementSummary = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

/** Legacy maps SearchHit -> ContentSummary; kept identical so cards render the same data. */
export function toContentSummary(hit: SearchHit): ContentSummary {
  return {
    id: hit.objectId,
    objectType: hit.objectType,
    title: hit.title,
    summary: hit.summary,
    cover: hit.cover,
    avatar: hit.avatar,
    updatedAt: hit.updatedAt,
    authorName: hit.authorName,
    likeCount: hit.likeCount,
    commentCount: hit.commentCount,
    tags: hit.tags,
    bookmarked: hit.bookmarked,
    liked: hit.liked,
    featured: hit.featured,
  };
}

/** Wrap a plain array into the PageResult shape the UI expects. */
export function toPage<T>(items: T[], total?: number): PageResult<T> {
  return { items, nextCursor: null, total: total ?? items.length };
}

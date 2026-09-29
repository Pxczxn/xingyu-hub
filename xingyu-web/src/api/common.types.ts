/*
 * Truly cross-domain types shared by home / discover / search / topics.
 * Extracted from the Legacy community API module (NOT the whole file).
 * Domain-specific types live next to their API module.
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
};

export type PageResult<T> = {
  items: T[];
  nextCursor?: string | null;
  total?: number;
};

export type SearchHit = {
  objectType: string;
  objectId: string;
  title: string;
  summary?: string;
  cover?: string;
  avatar?: string;
  updatedAt?: string;
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
  };
}

/** Wrap a plain array into the PageResult shape the UI expects. */
export function toPage<T>(items: T[], total?: number): PageResult<T> {
  return { items, nextCursor: null, total: total ?? items.length };
}

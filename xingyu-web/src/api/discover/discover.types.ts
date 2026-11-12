/*
 * Discover + Search types. Search shares the backend discovery domain, so it
 * lives here rather than being split into a separate folder (per the brief).
 */

import type { CursorInput, PageResult, ContentSummary, SearchHit } from "@/api/common.types";

export type DiscoverSort = "latest" | "featured" | "interest";

export type DiscoverInput = CursorInput & {
  topic?: string;
  /** Server-side object type. `MOMENT` is a first-class discover result (see DiscoverService.nav). */
  type?: "ARTICLE" | "SERIES" | "MOMENT";
  /**
   * Omitted means latest. `featured` is the editorial keyset.
   * `interest` keeps the same recency cursor and only includes articles tagged
   * to the signed-in user's selected explore domains. Guests get 401.
   * `hot` is rejected: like counts are not a stable cursor.
   */
  sort?: DiscoverSort;
};

export type DiscoverNavTab = { key: string; label: string; defaultSelected?: boolean };

/**
 * Verified live response of GET /api/v1/discover/nav.
 * `domainTabs` / `sortTabs` still describe more sorts than /discover implements.
 * The page only sends `latest` (default) and `featured`.
 */
export type ExploreNav = {
  mode?: string;
  sectionTitle?: string;
  feedHint?: string;
  canManage?: boolean;
  domainTabs?: DiscoverNavTab[];
  sortTabs?: DiscoverNavTab[];
};

export type SearchSort = "hot" | "latest";
export type SearchType = "ALL" | "ARTICLE" | "SERIES" | "MOMENT" | "USER";

export type SearchParams = {
  q: string;
  type?: SearchType;
  sort?: SearchSort;
  limit?: number;
};

export type { CursorInput, PageResult, ContentSummary, SearchHit };

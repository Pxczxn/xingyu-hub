/*
 * Discover + Search types. Search shares the backend discovery domain, so it
 * lives here rather than being split into a separate folder (per the brief).
 */

import type { CursorInput, PageResult, ContentSummary, SearchHit } from "@/api/common.types";

export type DiscoverNavTab = { key: string; label: string; defaultSelected?: boolean };

/**
 * Verified live response of GET /api/v1/discover/nav.
 * `domainTabs` / `sortTabs` are returned but are NOT honored by
 * /api/v1/discover on the current backend, so they are not used as filters.
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
export type SearchType = "ALL" | "ARTICLE" | "SERIES" | "USER" | "TOPIC";

export type SearchParams = {
  q: string;
  type?: SearchType;
  sort?: SearchSort;
  limit?: number;
};

export type { CursorInput, PageResult, ContentSummary, SearchHit };

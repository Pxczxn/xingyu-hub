/*
 * Home domain types (extracted from the Legacy community API module — NOT the whole file).
 */

import type { ContentSummary, SearchHit } from "@/api/common.types";

/** Raw payload of GET /api/v1/home (guest). */
export type GuestHomeRaw = {
  unreadNotifications: number;
  continueReading: SearchHit[];
  followingUpdates: SearchHit[];
  discoveries: SearchHit[];
};

/** Mapped guest home view. */
export type GuestHomeView = {
  unreadNotifications: number;
  continueReading: ContentSummary[];
  followingUpdates: ContentSummary[];
  discoveries: ContentSummary[];
};

/*
 * `PendingActionView(String type, String title, String href)` — verified against the
 * backend DTO on 2026-09-28.
 *
 * ⚠️ THERE IS NO `id`. This type previously declared `id: string` as REQUIRED, which
 * was wrong (a guess that never got checked because nothing consumed the field yet).
 * Using it as a React key would have produced `key={undefined}`.
 *
 * ⚠️ `href` is non-null on the wire but is a RAW SERVER STRING, and the backend has
 * exactly one producer (`HomeService:84`, `type="REVIEW"`), which hardcodes
 * `"/studio/reviewing"` — a route V2 does not have. So `href` is server data that
 * may point nowhere in this app: resolve it through a known-route allowlist before
 * rendering it as a link rather than trusting it.
 */
export type PendingAction = {
  type: string;
  title: string;
  href?: string;
};

/** GET /api/v1/me/home (authenticated). */
export type MeHomeView = {
  continueReading: ContentSummary[];
  followUpdates: ContentSummary[];
  recommendations: ContentSummary[];
  draftArticles: ContentSummary[];
  pendingActions: PendingAction[];
};

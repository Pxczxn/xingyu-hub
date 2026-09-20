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

export type PendingAction = {
  id: string;
  kind: string;
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

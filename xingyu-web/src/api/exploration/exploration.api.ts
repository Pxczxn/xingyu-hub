/*
 * Exploration API (兴趣 / 我的探索) — Phase 3D.
 *
 * Endpoints (all under the community RFC9457 contract):
 *   GET  /api/v1/explore/map   → ExploreDomain[]   PUBLIC (probed 200 as guest)
 *   GET  /api/v1/explore/me    → UserExplore        session (see the ⚠️ note)
 *   PUT  /api/v1/explore/me    → UserExplore        session
 *
 * ⚠️ `/explore/me` IS A REAL BACKEND BUG, NOT A "NEEDS LOGIN" STATE.
 * `CommunityExploreController:56` declares `@RequestHeader("satoken")` WITHOUT
 * `required = false`. When the header is absent Spring raises
 * `MissingRequestHeaderException` BEFORE the controller body runs, so
 * `requireUser()` (which correctly throws AUTH_REQUIRED) is never reached. The
 * exception falls through to `CommunityApiExceptionHandler.handleOther` →
 * **500 INTERNAL_ERROR** ("系统繁忙，请稍后再试").
 *
 * Probed 2026-09-28 against the live backend:
 *   GET /explore/map  → 200
 *   GET /explore/nav  → 200 (correctly treats a missing header as guest)
 *   GET /explore/me   → 500 INTERNAL_ERROR   ← the bug
 *   GET /me/profile   → 401 AUTH_REQUIRED    ← contract does map 401 correctly,
 *                                              so the 500 is endpoint-specific.
 *
 * Consequence for the UI: this page is NOT routed for guests (RequireAuth), so
 * in practice the header is always sent. If a session expires mid-view, the
 * user sees "登录状态已过期" — which is the RIGHT thing to show. We do not paper
 * over the 500 with a fake message. See LEGACY-DELTA §三·补16.
 */
import { apiRequest } from "@/api/client";
import type { ExploreDomain, UserExplore } from "./exploration.types";

export type UpdateExploreInput = {
  domainIds?: string[];
  customLabels?: string[];
};

export const explorationApi = {
  /** PUBLIC: the official domain tree (roots carry `children`). */
  getMap: (): Promise<ExploreDomain[]> => apiRequest<ExploreDomain[]>("/api/v1/explore/map"),

  /** Session-scoped: the caller's selected official domains + personal labels. */
  getMine: (): Promise<UserExplore> => apiRequest<UserExplore>("/api/v1/explore/me"),

  /**
   * Full REPLACEMENT, not a merge (`updateUserExploration` deletes every link
   * row first, then archives personal domains whose name is absent from the
   * payload). So callers MUST send the complete desired state — sending only a
   * delta would silently clear the rest.
   */
  updateMine: (input: UpdateExploreInput): Promise<UserExplore> =>
    apiRequest<UserExplore>("/api/v1/explore/me", { method: "PUT", body: input }),
};

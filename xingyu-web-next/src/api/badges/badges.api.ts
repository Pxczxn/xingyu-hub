/*
 * `GET /api/v1/me/badges` — the session user's achievement badges.
 *
 * Returns a BARE array (not a PageResultView), like `/me/likes` and
 * `/me/comments`. There is no cursor and no total, so this wrapper exposes no
 * pagination surface: the server always returns the full fixed set of five.
 */
import { apiRequest } from "@/api/client";
import type { BadgeView } from "./badges.types";

export const badgesApi = {
  list: (): Promise<BadgeView[]> => apiRequest<BadgeView[]>("/api/v1/me/badges"),
};

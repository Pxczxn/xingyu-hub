/*
 * Public guide API (Phase 2B).
 *
 * VERIFIED live 2026-09-24 (isolated test DB):
 *   GET /api/v1/guide?limit=          bare JSON array (default limit 50)
 *   GET /api/v1/guide/{slug}          bare JSON object; missing -> 404 NOT_FOUND
 * /rules has no API: reuse GET /api/v1/guide/community-rules.
 */
import { apiRequest } from "@/api/client";
import { COMMUNITY_RULES_SLUG, type GuidePage } from "./guide.types";

export { COMMUNITY_RULES_SLUG };

export const guideApi = {
  list: (limit = 50): Promise<GuidePage[]> =>
    apiRequest<GuidePage[]>(`/api/v1/guide?limit=${encodeURIComponent(String(limit))}`),

  getBySlug: (slug: string): Promise<GuidePage> =>
    apiRequest<GuidePage>(`/api/v1/guide/${encodeURIComponent(slug)}`),

  getCommunityRules: (): Promise<GuidePage> =>
    apiRequest<GuidePage>(`/api/v1/guide/${encodeURIComponent(COMMUNITY_RULES_SLUG)}`),
};

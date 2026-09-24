/*
 * Public guide-page DTO (GuidePageView).
 * Probe 2026-09-24: { id, slug, title, body, publishedAt }. No summary.
 */
export type GuidePage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  publishedAt?: string;
};

export const COMMUNITY_RULES_SLUG = "community-rules";

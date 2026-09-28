/*
 * Public announcement DTO (AnnouncementView).
 * Probe 2026-09-24: { id, title, body, publishedAt } as a bare JSON object.
 * Structurally the same as AnnouncementSummary in common.types (home teaser).
 */
export type Announcement = {
  id: string;
  title: string;
  body?: string;
  publishedAt?: string;
};

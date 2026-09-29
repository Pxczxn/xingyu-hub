/*
 * Exploration (兴趣 / 我的探索) types — Phase 3D.
 *
 * BACKEND SHAPES (read from the records, not from Legacy's TS):
 *   ExploreDomainView  { id, slug, name, description, icon, parentId,
 *                        domainType, personal, children }
 *   UserExploreView    { domains: ExploreDomainView[], customLabels: string[] }
 *
 * `domainType` is "SYSTEM" for the official tree and "PERSONAL" for the
 * per-user labels the write endpoint materializes (ExplorationService:179).
 * `personal` is the boolean the server derives from that same field
 * (ExplorationService:102 / :319) — the two agree, so the UI keys off
 * `personal` for display and never needs to string-compare `domainType`.
 */

/** `SYSTEM` = official domain tree; `PERSONAL` = a label this user minted. */
export type DomainType = "SYSTEM" | "PERSONAL";

export type ExploreDomain = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  parentId?: string | null;
  domainType?: DomainType | string | null;
  personal?: boolean;
  children?: ExploreDomain[] | null;
};

export type UserExplore = {
  domains: ExploreDomain[];
  customLabels: string[];
};

/**
 * Server-side limits, read from ExplorationService.
 * `MAX_CUSTOM_LABELS` mirrors the write path's implicit bound: the service
 * accepts whatever `customLabels` array it is handed, but each new label is
 * inserted as a row, so the UI caps input rather than letting a user wedge the
 * transaction. Legacy had NO cap — the number below is a front-end guard, and
 * the constant name says so.
 */
export const MAX_CUSTOM_LABEL_LENGTH = 20;
export const MAX_CUSTOM_LABELS = 10;

/** A personal label is slugified server-side (`slugify(label) + "-" + userPrefix`). */
export function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

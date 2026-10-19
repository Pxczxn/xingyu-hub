import type { SeriesChapterRelation } from "@/api/series/series.types";

/**
 * One chapter in the local arrangement.
 *
 * Identity is the ARTICLE id — never the array index, never the relation row id.
 * The backend replaces the whole relation table on save (`series_chapter.id`
 * changes every time), and reader deep links / reading progress are keyed by
 * article id, so that is the only stable identity available to this page.
 */
export type ChapterEntry = {
  articleId: string;
  title: string | null;
};

/** Server chapters come back ordered, but position is the contract, so sort it. */
export function toChapterEntries(chapters: SeriesChapterRelation[]): ChapterEntry[] {
  const seen = new Set<string>();
  return [...chapters]
    .sort((left, right) => left.position - right.position)
    .filter((chapter) => {
      if (!chapter.articleId || seen.has(chapter.articleId)) return false;
      seen.add(chapter.articleId);
      return true;
    })
    .map((chapter) => ({ articleId: chapter.articleId, title: chapter.title }));
}

export function chapterIds(entries: ChapterEntry[]): string[] {
  return entries.map((entry) => entry.articleId);
}

/** Order comparison used to decide whether a save request is necessary at all. */
export function sameChapterOrder(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

/**
 * Drag result -> new array. Returns the ORIGINAL array when nothing changes, so
 * callers can treat reference equality as "not dirty" without re-comparing.
 */
export function reorderChapterEntries(
  entries: ChapterEntry[],
  activeId: string,
  overId: string,
): ChapterEntry[] {
  if (activeId === overId) return entries;
  const from = entries.findIndex((entry) => entry.articleId === activeId);
  const to = entries.findIndex((entry) => entry.articleId === overId);
  if (from < 0 || to < 0) return entries;
  const next = [...entries];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

/** Keyboard/button fallback for drag: a single-step move with boundary checks. */
export function moveChapterEntry(
  entries: ChapterEntry[],
  index: number,
  delta: number,
): ChapterEntry[] {
  const target = index + delta;
  if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) {
    return entries;
  }
  const next = [...entries];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}

/** Removes one article and reports where it sat, so the UI can undo exactly. */
export function removeChapterEntry(
  entries: ChapterEntry[],
  articleId: string,
): { next: ChapterEntry[]; removed: { entry: ChapterEntry; index: number } | null } {
  const index = entries.findIndex((entry) => entry.articleId === articleId);
  if (index < 0) return { next: entries, removed: null };
  const next = [...entries];
  const [entry] = next.splice(index, 1);
  return { next, removed: { entry, index } };
}

/** Re-inserts a removed chapter at its original position (or at the end). */
export function restoreChapterEntry(
  entries: ChapterEntry[],
  entry: ChapterEntry,
  index: number,
): ChapterEntry[] {
  if (entries.some((current) => current.articleId === entry.articleId)) return entries;
  const next = [...entries];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, entry);
  return next;
}

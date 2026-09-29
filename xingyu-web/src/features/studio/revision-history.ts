/*
 * Pure helpers for the article version-history page (Phase 2L).
 *
 * ⚠️ Read this before changing any label here. Legacy's version page called
 * these rows "自动保存" (auto-save) and claimed "自动保存每 3 分钟生成一次草稿版本".
 * BOTH ARE FALSE. `ArticleService.listRevisions` reads
 * `formalRevisionMapper.listByArticleId` — FORMAL revisions, which the backend
 * writes when an article is PUBLISHED. A draft that was merely saved has NO
 * versions at all. Calling them auto-saves would tell the user they have
 * safety-net snapshots they do not have.
 *
 * Legacy also branched on `revision.visibility === "PUBLISHED"`. That is dead
 * code: Visibility is PUBLIC / UNLISTED / PRIVATE (see articles.types.ts), so
 * the condition never holds and every row fell through to "自动保存". We do not
 * reproduce a branch that can never be taken.
 */
import type { ArticleRevision } from "@/api/articles/articles.types";

/**
 * How many revisions to show. The backend returns the full history with no
 * limit parameter, so this is a client-side cap to keep the rail scannable.
 */
export const REVISION_DISPLAY_LIMIT = 30;

/** Visibility labels. Unknown values echo back rather than guessing. */
const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "公开",
  UNLISTED: "仅链接可见",
  PRIVATE: "私密",
};

export function visibilityLabel(visibility: string | null | undefined): string {
  const key = (visibility ?? "").toUpperCase();
  return VISIBILITY_LABELS[key] ?? (visibility ?? "");
}

/**
 * Human label for a revision row.
 *
 * Deliberately says 「发布版本」 rather than 「自动保存」: these rows are created by
 * publishing, and the whole point of the page is to roll back to a published
 * state. The version number makes the ordering legible without implying more
 * granular history than exists.
 */
export function revisionLabel(revision: ArticleRevision): string {
  const number = revision.revisionNumber > 0 ? `第 ${revision.revisionNumber} 版` : "历史版本";
  return `发布版本 · ${number}`;
}

/**
 * Formats `frozenAt` for display.
 *
 * Returns null when the value is missing or unparseable so the caller can omit
 * the timestamp entirely — printing "Invalid Date" (or a bogus epoch) would be
 * worse than showing nothing.
 */
export function formatFrozenAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Heading for a revision row, falling back when the frozen title is null. */
export function revisionTitle(revision: ArticleRevision): string {
  const title = revision.title?.trim();
  return title && title.length > 0 ? title : "（该版本没有标题）";
}

/**
 * Whether restoring is allowed.
 *
 * The backend enforces `canEditDraft(article)`: ACTIVE lifecycle AND NORMAL
 * moderation AND NOT IN_REVIEW, else 409 「文章当前不可恢复版本」. We only know
 * the article's state from the owner list, so `status` is the resolved
 * `ArticleLifecycleStatus` (or null when it could not be resolved).
 *
 *  - PUBLISHED -> restorable. This is the headline use case (roll back a
 *    published piece); "published" is NOT the same as "not editable" here.
 *  - DRAFT     -> restorable.
 *  - IN_REVIEW -> NOT restorable: the piece is queued, so the backend refuses.
 *  - null      -> unknown, so we do NOT claim it is restorable.
 *
 * Moderation/frozen state is not exposed by the list, so a FROZEN article will
 * still 409 at the backend. That residual case is handled by surfacing the
 * server's message rather than by hiding the button on a guess.
 */
export function canRestore(status: string | null | undefined): boolean {
  const normalized = (status ?? "").toUpperCase();
  return normalized === "PUBLISHED" || normalized === "DRAFT";
}

/**
 * Explains the un-restorable state, or null when restoration is allowed.
 *
 * Kept separate from `canRestore` so the page can show a reason next to the
 * hidden control instead of silently omitting it — "why can't I do this" is
 * more useful answered than implied.
 */
export function restoreBlockedReason(status: string | null | undefined): string | null {
  if (canRestore(status)) return null;
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "IN_REVIEW") {
    return "稿件正在审核队列中，暂不能恢复历史版本。请等待审核结果，或先撤回投稿。";
  }
  return "暂时无法确认这篇稿件是否可恢复版本，因此不提供恢复操作。";
}

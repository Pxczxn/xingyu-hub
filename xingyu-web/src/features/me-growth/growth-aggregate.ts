/*
 * Pure helpers for /me/growth (Phase 3B).
 *
 * The page aggregates FOUR independent reads (reading history, comments, badges,
 * insights) plus one pending-action list. Two honesty rules come straight out of
 * that shape:
 *
 *   1. PARTIAL FAILURE MUST BE VISIBLE. Legacy fired all five in parallel and
 *      rendered `insights &&` / `badges && ...` guards, so a failed read simply
 *      made its section VANISH — indistinguishable from "you have none". This is
 *      the same failure mode as §三·补9 (analytics showing `—` for both error and
 *      zero). Each section therefore carries its own loading/error state here.
 *
 *   2. SERVER HREFS ARE NOT TRUSTED. The backend's only pending-action producer
 *      (`HomeService:84`) hardcodes `href="/studio/reviewing"`, and V2 has no such
 *      route. Rendering it would hand the user a guaranteed 404 after a real
 *      prompt — see `resolvePendingHref`.
 */
import type { PendingAction } from "@/api/home/home.types";

/**
 * V2 routes that a server-supplied pending-action href is allowed to point at.
 *
 * Deliberately an ALLOWLIST, not a "starts with /studio" heuristic: the server is
 * free to emit any path, and only a path we know exists should become a link.
 * Extend this as routes are actually created — never speculatively.
 */
export const KNOWN_PENDING_ROUTES: readonly string[] = [
  "/studio",
  "/studio/submissions",
  "/studio/series",
  "/studio/analytics",
  "/studio/categories",
  "/studio/collaboration",
  "/reports",
  "/messages",
  "/notifications",
];

/**
 * The href to link a pending action to, or null when the target is not a route
 * we ship.
 *
 * Returning null means "render this as plain text, not a link" — the action is
 * still shown (dropping it would hide a real prompt), it just is not clickable
 * at a path that 404s.
 */
export function resolvePendingHref(action: Pick<PendingAction, "href">): string | null {
  const href = action.href?.trim();
  if (!href) return null;
  // Tolerate a trailing slash so "/studio/" resolves to "/studio".
  const normalized = href.length > 1 && href.endsWith("/") ? href.slice(0, -1) : href;
  return KNOWN_PENDING_ROUTES.includes(normalized) ? normalized : null;
}

/**
 * A readable heading for a pending action.
 *
 * `title` is server copy and wins. The `type` is a raw enum (`REVIEW` today), so
 * it is used only as a last resort and echoed verbatim rather than translated —
 * the same containment rule as §三·补4 (unknown enums must stay visible).
 */
export function pendingTitle(action: Pick<PendingAction, "type" | "title">): string {
  const title = action.title?.trim();
  if (title) return title;
  return action.type?.trim() || "待处理事项";
}

/**
 * A React key for a pending action.
 *
 * ⚠️ There is NO `id` on `PendingActionView` (backend record is `type,title,href`).
 * An earlier V2 type wrongly declared `id` as required. The key therefore has to
 * be derived, and the index is folded in because the server can legitimately emit
 * the SAME (type,title,href) more than once — `HomeService:84` adds one REVIEW row
 * **per under-review article**, with no per-item identifier.
 */
export function pendingKey(
  action: Pick<PendingAction, "type" | "title" | "href">,
  index: number,
): string {
  return `${action.type ?? ""}|${action.title ?? ""}|${action.href ?? ""}|${index}`;
}

/**
 * De-duplicates pending actions for display.
 *
 * Because the server emits one identical `REVIEW` row per under-review article,
 * a user with five articles in review would otherwise see "文章审核中" five times
 * with no way to tell whether that means five articles or a rendering bug. The
 * count is surfaced alongside the kept row instead.
 *
 * `counts` is keyed by the RETAINED action's own derived key (`pendingKey(a, 0)`),
 * so a caller that has the deduped action in hand can look its count up without
 * re-deriving the key string and risking a mismatch.
 */
export function dedupePendingActions(actions: readonly PendingAction[]): {
  actions: PendingAction[];
  /** Raw rows collapsed into each retained action. */
  counts: Map<string, number>;
} {
  const counts = new Map<string, number>();
  const seen = new Map<string, PendingAction>();

  for (const action of actions) {
    const key = pendingKey(action, 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!seen.has(key)) seen.set(key, action);
  }

  return { actions: [...seen.values()], counts };
}

/** The lookup key a caller should use for an action returned by the dedupe pass. */
export function retainedPendingKey(action: Pick<PendingAction, "type" | "title" | "href">): string {
  return pendingKey(action, 0);
}

/** "3 项" style label for a collapsed group; empty string when there is only one. */
export function pendingCountLabel(count: number): string {
  return count > 1 ? `${count} 项` : "";
}

/*
 * Notification contract (Phase 2I-2, four-source confirmed 2026-09-27).
 *
 * Controller: CommunityNotificationController  @RequestMapping("/notifications")
 * DTO:        NotificationView {id, category, title, body, read, createdAt}
 *
 * Endpoints:
 *   GET   /api/v1/notifications?limit=N          -> Notification[]   (session)  BARE ARRAY
 *   PATCH /api/v1/notifications/{id}/read        -> Notification     (session)
 *   POST  /api/v1/notifications/read-all         -> 204 no content   (session)
 *
 * Three shapes that will bite if assumed wrong:
 *
 *  1. BARE ARRAY, NOT PageResultView. This endpoint returns `List<NotificationView>`
 *     directly. Reading `.items` yields `undefined` and blanks the page — the
 *     opposite mistake from the follow-graph endpoints (Phase 2I-1), which DO
 *     wrap in `{items, nextCursor, total}`. Do not copy that pattern here.
 *
 *  2. NO `targetRoute`. The Legacy `NotificationSummary.targetRoute?: string` is
 *     a frontend hallucination: a whole-backend grep for `getTargetRoute` /
 *     `targetRoute` returns zero hits, and the DTO has exactly six fields. It is
 *     deliberately NOT modelled here. Deep-linking a notification is therefore
 *     not possible from the payload alone — see `notificationFallbackHref`.
 *
 *  3. NO cursor paging. `NotificationMapper.listByUserId` orders by
 *     `created_at DESC` with `LIMIT #{limit}` and the service clamps non-positive
 *     limits to 50. There is no `nextCursor`, so a single window is fetched.
 *
 * Read-state semantics (NotificationService):
 *  - `markRead` throws NOT_FOUND (404) when the notification does not exist OR
 *    belongs to another user — so a 404 is "not yours / gone", never a leak.
 *  - It is idempotent: an already-read row is returned untouched.
 *  - `read` is derived server-side as `readAt != null`.
 *
 * Category coverage: the ONLY producer today is `NotificationService.notifyUserFollowed`
 * (`setCategory("FOLLOW")`) — a single `setCategory` call exists in the whole
 * backend. The other categories below come from the Legacy renderer and are
 * kept so that a future producer does not render as a blank row. Unknown
 * categories are shown verbatim rather than dropped.
 */

export type Notification = {
  id: string;
  /**
   * Free-form string. The backend emits whatever the producer set; only
   * "FOLLOW" exists today. Never assume a closed enum in a switch.
   */
  category: string;
  title: string;
  /** Optional: the mapper copies it straight off the row, and the DDL allows NULL. */
  body?: string | null;
  read: boolean;
  createdAt?: string | null;
};

/** The three reading buckets the UI offers. 全部 is the absence of a filter. */
export type NotificationBucket = "social" | "system";

export type NotificationTab = "all" | NotificationBucket;

/*
 * Category -> bucket. Additive matching (Legacy parity): each family lists the
 * categories it accepts, and the default is "social", because an interaction is
 * the most likely thing an unrecognised category represents.
 *
 * Deliberately NOT a lookup table with a throw: a backend that adds
 * `category = "MENTION"` must still render, not crash the list.
 */
const SYSTEM_CATEGORIES = new Set(["SYSTEM", "ANNOUNCE"]);

/** Normalises for comparison only — the raw value is what gets displayed. */
function normalizeCategory(category: string | null | undefined): string {
  return (category ?? "").trim().toUpperCase();
}

export function notificationBucket(category: string | null | undefined): NotificationBucket {
  const value = normalizeCategory(category);
  // Everything that is not explicitly a system message is an interaction —
  // including categories this build has never heard of.
  return SYSTEM_CATEGORIES.has(value) ? "system" : "social";
}

/**
 * Human label for a notification category.
 * An unknown category is rendered as-is (uppercased), never swallowed into
 * 「互动」 — showing "MENTION" beats showing the wrong word.
 */
export function notificationCategoryLabel(category: string | null | undefined): string {
  const value = normalizeCategory(category);
  switch (value) {
    case "LIKE":
    case "REACTION":
      return "点赞";
    case "COMMENT":
    case "REPLY":
      return "评论";
    case "FOLLOW":
      return "关注";
    case "MENTION":
      return "提及";
    case "SYSTEM":
      return "系统";
    case "ANNOUNCE":
      return "公告";
    default:
      return value;
  }
}

/*
 * Bucket counters for the tab strip. `all` is the list length rather than a sum
 * of the two buckets, so an unrecognised category (which falls into "social")
 * can never make the numbers disagree.
 */
export function countUnreadByBucket(items: Notification[]): Record<NotificationTab, number> {
  const counts: Record<NotificationTab, number> = { all: 0, social: 0, system: 0 };
  for (const item of items) {
    if (item.read) continue;
    counts.all += 1;
    counts[notificationBucket(item.category)] += 1;
  }
  return counts;
}

export function countUnread(items: Notification[]): number {
  return items.reduce((total, item) => (item.read ? total : total + 1), 0);
}

/**
 * Where a notification can send the reader, given that the payload carries no
 * `targetRoute`.
 *
 * - A follow notification is a person: the followers list is where they are
 *   visible, which is exactly what Legacy fell back to.
 * - Anything else has no safe destination, so it returns null and the row is
 *   rendered as plain text instead of a link. A dead link is worse than no link.
 */
export function notificationFallbackHref(
  category: string | null | undefined,
): string | null {
  const value = normalizeCategory(category);
  if (value === "FOLLOW") return "/me/followers";
  if (value === "ANNOUNCE") return "/announcements";
  return null;
}

/**
 * Defensive read of the list payload.
 *
 * The contract is a bare array, but tolerate an accidental envelope so a future
 * backend change cannot blank the page — same defensive posture as
 * `toFollowUsers` in the opposite direction.
 */
export function toNotifications(raw: Notification[] | null | undefined): Notification[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const items = (raw as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Notification[]) : [];
}

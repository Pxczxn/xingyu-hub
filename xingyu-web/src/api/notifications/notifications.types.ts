/*
 * Notification contract (contract recovery, 2026-10-06).
 *
 * Controller: CommunityNotificationController
 * DTO:        NotificationView {id, category, title, body, read, createdAt, actor}
 *
 * Endpoints:
 *   GET   /api/v1/notifications?limit=N          -> Notification[]   (session)  BARE ARRAY
 *   GET   /api/v1/notifications/unread-count     -> {unread:n}       (session)
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
 *  2. NO cursor paging. The backend orders by `created_at DESC, id DESC` and
 *     clamps `limit` to a 50 default / 100 ceiling. There is no `nextCursor`, so
 *     a single window is fetched. Pagination is an explicit, tracked debt — the
 *     UI must not claim it shows "all" notifications.
 *
 *  3. `actor` is the navigation payload. The old contract had no stable identity
 *     at all, so a FOLLOW row could only fall back to /me/followers. Now the row
 *     carries `actor.userId` (stable, written at produce time) plus the CURRENT
 *     `username` (resolved server-side at read time) — which is what makes the
 *     link survive a rename. `username` can be null (profile gone), in which case
 *     the row must NOT render a link rather than link to /u/null.
 *
 * Read-state semantics (NotificationService):
 *  - `markRead` throws NOT_FOUND (404) when the notification does not exist OR
 *    belongs to another user — so a 404 is "not yours / gone", never a leak.
 *  - It is idempotent: an already-read row is returned untouched.
 *  - `read` is derived server-side as `readAt != null`.
 *  - `read-all` is ACCOUNT-WIDE (every row for the session user), not just the
 *    fetched window. That is why the header badge may go to 0 after it.
 *
 * Category coverage: the ONLY producer today is `NotificationService.notifyUserFollowed`
 * (`setCategory("FOLLOW")`). Nothing else in the backend writes a notification, so the
 * UI deliberately does NOT offer category filters, and does not advertise 点赞/评论/系统.
 * `category` stays a free-form string and the renderer stays total (an unknown category
 * must still render), but no surface may claim those producers exist.
 */

/**
 * Structured actor — the person who triggered the notification.
 *
 * `userId` is the stable identity persisted on the row; `username` / `displayName`
 * are the CURRENT values resolved server-side at read time. That split is what makes
 * an old notification still open the actor's current profile after a rename.
 */
export type NotificationActor = {
  userId: string;
  /** Canonical username for /u/{username}; null when the profile cannot be resolved. */
  username: string | null;
  displayName: string | null;
};

export type Notification = {
  id: string;
  /**
   * Free-form string. The backend emits whatever the producer set; only
   * "FOLLOW" exists today. Never assume a closed enum in a switch.
   */
  category: string;
  /** Human sentence — 谁 · 做了什么. Rendered as the row's first line. */
  title: string;
  /** Optional second line; FOLLOW deliberately leaves it null to avoid restating the title. */
  body?: string | null;
  read: boolean;
  createdAt?: string | null;
  /** Null when the notification has no actor (system / legacy rows). */
  actor?: NotificationActor | null;
};

/** Page title. `all` is the list length, so it can never disagree with the list. */
export function countUnread(items: Notification[]): number {
  return items.reduce((total, item) => (item.read ? total : total + 1), 0);
}

/**
 * Where a notification sends the reader.
 *
 * The destination is DATA-DRIVEN, not category-driven:
 *  - a resolvable actor wins, and it is the actor's canonical profile. That is the
 *    whole point of the contract recovery: 「谁」 is clickable and rename-proof.
 *  - ANNOUNCE keeps its announcement-list destination (that page is a real, public
 *    route and the mapping predates this change).
 *  - everything else returns null, and the row renders as plain text. A dead link
 *    is worse than no link.
 *
 * Note this reads the ACTOR, not a stored username: never build the href from a
 * username that was captured at produce time.
 */
export function notificationHref(notification: Pick<Notification, "category" | "actor">): string | null {
  const username = notification.actor?.username?.trim();
  if (username) return `/u/${encodeURIComponent(username)}`;
  if ((notification.category ?? "").trim().toUpperCase() === "ANNOUNCE") return "/announcements";
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

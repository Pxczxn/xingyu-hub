/*
 * Cross-component sync for the unread-notification count.
 *
 * WHY THIS EXISTS
 * The notification page and the shell header are different components with no shared
 * store, and the app has no query client (see AppProviders). Reading a notification on
 * /notifications therefore used to leave the header badge stale until a full reload.
 *
 * WHY NOT A STORE
 * Deliberate: the project has exactly one cross-component sync mechanism already —
 * the `window` CustomEvent used by `lib/storage.ts` for auth changes. Reusing that
 * pattern costs one module and no new global state framework, which is the stated
 * constraint. If a query client ever lands, this is the seam to replace.
 *
 * CONTRACT — the payload is a SERVER-CONFIRMED absolute count, never a guess:
 *   - a producer may only call `notifyUnreadChanged` AFTER the server accepted the
 *     write, and with a number that came from the server (a fresh read of
 *     `GET /notifications/unread-count`, or 0 after a successful account-wide
 *     read-all, which is the endpoint's own semantics).
 *   - a FAILED write must publish nothing at all. That is what keeps a failed
 *     mark-read from silently decrementing the header badge.
 *   - consumers therefore apply the number verbatim; they must not do arithmetic on it.
 */

export const NOTIFICATIONS_CHANGED_EVENT = "xingyu-notifications-changed";

/**
 * Publish the server-confirmed unread count.
 *
 * Rejects negative and non-finite values rather than clamping: a negative count is a
 * producer bug, and quietly turning it into 0 would hide it.
 */
export function notifyUnreadChanged(unread: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(unread) || unread < 0) return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { unread } }));
}

/**
 * Subscribe to server-confirmed unread-count changes. Returns an unsubscribe function.
 *
 * A malformed event (missing/非 number detail) is ignored instead of being coerced —
 * the badge should keep its previous, server-derived value rather than show a guess.
 */
export function onUnreadChanged(handler: (unread: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ unread?: unknown }>).detail;
    const value = detail?.unread;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      handler(value);
    }
  };
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
}

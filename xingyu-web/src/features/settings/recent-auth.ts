/*
 * Short-lived re-authentication grant storage (Phase 3H).
 *
 * Ported from Legacy `xingyu-web/lib/recent-auth.ts`, with the same security
 * posture: **sessionStorage, not localStorage** — the grant dies with the tab
 * and is never written to disk. It is also validated on read, so an expired
 * grant is discarded rather than sent.
 *
 * Why it is needed at all: `POST /me/email/change` requires an `X-Recent-Auth`
 * header holding a grant minted by `POST /auth/re-authenticate`. The grant is
 * valid for 15 minutes, so a user who re-authenticates and then navigates to the
 * email form must not be forced to re-enter their password.
 */

const RECENT_AUTH_KEY = "xingyu-recent-auth";

export type StoredRecentAuth = {
  id: string;
  expiresAt: string;
};

export function getStoredRecentAuth(): StoredRecentAuth | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RECENT_AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredRecentAuth;
    if (!parsed.id || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(RECENT_AUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(RECENT_AUTH_KEY);
    return null;
  }
}

export function setStoredRecentAuth(id: string, expiresAt: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RECENT_AUTH_KEY, JSON.stringify({ id, expiresAt }));
}

export function clearStoredRecentAuth() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECENT_AUTH_KEY);
}

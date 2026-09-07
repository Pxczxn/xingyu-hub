const RECENT_AUTH_KEY = "xingyu-recent-auth";

type StoredRecentAuth = {
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

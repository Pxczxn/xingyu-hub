/*
 * Auth token storage (migrated from Legacy lib/api-client.ts).
 * Keeps the sa-token localStorage contract and the auth-changed event intact.
 */

export const TOKEN_KEY = "xingyu-satoken";
export const AUTH_CHANGED_EVENT = "xingyu-auth-changed";

/** Notify listeners (e.g. guard / nav) that the auth state changed. */
export function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  return getStoredToken() !== null;
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  notifyAuthChanged();
}

/** Subscribe to auth changes; returns an unsubscribe function. */
export function onAuthChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}

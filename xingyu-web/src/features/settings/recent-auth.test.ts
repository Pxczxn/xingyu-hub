import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoredRecentAuth, getStoredRecentAuth, setStoredRecentAuth } from "./recent-auth";

const KEY = "xingyu-recent-auth";

beforeEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("recent-auth storage", () => {
  it("round-trips a grant", () => {
    setStoredRecentAuth("ra-1", new Date(Date.now() + 600_000).toISOString());
    expect(getStoredRecentAuth()?.id).toBe("ra-1");
  });

  it("writes to sessionStorage, never localStorage", () => {
    // Security posture: the grant must die with the tab, not persist to disk.
    setStoredRecentAuth("ra-1", new Date(Date.now() + 600_000).toISOString());
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredRecentAuth()).toBeNull();
  });

  it("discards an EXPIRED grant and removes it", () => {
    setStoredRecentAuth("ra-1", new Date(Date.now() - 1000).toISOString());
    expect(getStoredRecentAuth()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("treats an exactly-now expiry as expired", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setStoredRecentAuth("ra-1", new Date(now).toISOString());
    expect(getStoredRecentAuth()).toBeNull();
    vi.useRealTimers();
  });

  it("discards malformed JSON", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(getStoredRecentAuth()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("discards a record missing id or expiresAt", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ id: "ra-1" }));
    expect(getStoredRecentAuth()).toBeNull();
    sessionStorage.setItem(KEY, JSON.stringify({ expiresAt: "2099-01-01T00:00:00Z" }));
    expect(getStoredRecentAuth()).toBeNull();
  });

  it("clears on demand", () => {
    setStoredRecentAuth("ra-1", new Date(Date.now() + 600_000).toISOString());
    clearStoredRecentAuth();
    expect(getStoredRecentAuth()).toBeNull();
  });
});

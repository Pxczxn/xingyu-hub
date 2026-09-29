/*
 * Shared block-state store (Phase 2A-2a).
 *
 * WHY THIS EXISTS — a real backend contract gap:
 *   Block state is exposed ONLY as the full list (`GET /me/blocks`). Neither
 *   `GET /users/{username}` (UserDetailView) nor any other endpoint reports
 *   whether the viewer has blocked someone, and there is no status endpoint
 *   (read from CommunityMeController + UserBlockService, 2026-09-23).
 *
 *   Re-downloading that list on every profile view is exactly what Phase 2A-2a
 *   rules out, so the profile page and /settings/blocks read block state through
 *   this one store: the list is fetched once per session and shared, and every
 *   mutation invalidates it so the next read re-syncs from the backend instead
 *   of us inventing the resulting relationship state locally.
 *
 * The cache is keyed by the stored auth token, so a different session/user can
 * never observe another account's block list.
 */
import { usersApi } from "@/api/users/users.api";
import type { BlockedUser } from "@/api/users/users.types";
import { getStoredToken } from "@/lib/storage";

type CacheEntry = { key: string; users: BlockedUser[] };

let cache: CacheEntry | null = null;
let inflight: { key: string; promise: Promise<BlockedUser[]> } | null = null;

function cacheKey(): string {
  return getStoredToken() ?? "anonymous";
}

/** Drop the cache so the next read hits the backend. */
export function invalidateBlockedUsers(): void {
  cache = null;
  inflight = null;
}

/** The cached list for this session, or null when nothing has been loaded yet. */
export function peekBlockedUsers(): BlockedUser[] | null {
  if (!cache || cache.key !== cacheKey()) return null;
  return cache.users;
}

/**
 * The viewer's blocked users. Cached per session; pass `force: true` to re-sync.
 * Concurrent callers share a single in-flight request.
 */
export async function loadBlockedUsers(options: { force?: boolean } = {}): Promise<BlockedUser[]> {
  const key = cacheKey();
  if (!options.force && cache && cache.key === key) return cache.users;
  if (inflight && inflight.key === key) return inflight.promise;

  const promise = (async () => {
    try {
      const users = await usersApi.listBlockedUsers();
      const list = users ?? [];
      cache = { key, users: list };
      return list;
    } finally {
      inflight = null;
    }
  })();

  inflight = { key, promise };
  return promise;
}

/** True when the viewer has blocked `username`. Reads the cache only. */
export function isBlockedUsername(username: string): boolean {
  return (peekBlockedUsers() ?? []).some((user) => user.username === username);
}

/**
 * Block a user. The 204 is the confirmation; the backend also removes any follow
 * in BOTH directions (UserBlockService.blockByUsername). The cache is dropped so
 * the next read re-syncs — the resulting follow/block state is never guessed.
 */
export async function blockUser(username: string): Promise<void> {
  await usersApi.blockUser(username);
  invalidateBlockedUsers();
}

/** Unblock a user. The backend does NOT restore follows that blocking removed. */
export async function unblockUser(username: string): Promise<void> {
  await usersApi.unblockUser(username);
  invalidateBlockedUsers();
}

/** Test-only: drop the cache between cases. */
export function __resetBlockedUsersForTests(): void {
  invalidateBlockedUsers();
}

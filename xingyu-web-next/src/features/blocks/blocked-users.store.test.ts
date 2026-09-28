import { beforeEach, describe, expect, it, vi } from "vitest";
import { usersApi } from "@/api/users/users.api";
import type { BlockedUser } from "@/api/users/users.types";
import { setStoredToken } from "@/lib/storage";
import {
  __resetBlockedUsersForTests,
  blockUser,
  invalidateBlockedUsers,
  isBlockedUsername,
  loadBlockedUsers,
  peekBlockedUsers,
  unblockUser,
} from "./blocked-users.store";

/*
 * The store exists because block state has no dedicated endpoint: it can only be
 * read as the whole list (GET /me/blocks). These tests pin the two properties the
 * pages depend on — fetch once per session and never invent post-mutation state —
 * plus the token keying that stops one session seeing another's block list.
 */

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    listBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

const mocked = vi.mocked(usersApi);

function blocked(username: string): BlockedUser {
  return {
    userId: `u-${username}`,
    username,
    displayName: username,
    blockedAt: "2026-09-23T00:00:00Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  mocked.listBlockedUsers.mockReset();
  mocked.blockUser.mockReset();
  mocked.unblockUser.mockReset();
  __resetBlockedUsersForTests();
});

describe("loadBlockedUsers", () => {
  it("fetches once and serves later reads from the cache", async () => {
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);

    await loadBlockedUsers();
    const second = await loadBlockedUsers();

    expect(mocked.listBlockedUsers).toHaveBeenCalledTimes(1);
    expect(second).toEqual([blocked("alice")]);
    expect(isBlockedUsername("alice")).toBe(true);
    expect(isBlockedUsername("bob")).toBe(false);
  });

  it("re-fetches when forced", async () => {
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);
    await loadBlockedUsers();

    mocked.listBlockedUsers.mockResolvedValue([]);
    const forced = await loadBlockedUsers({ force: true });

    expect(mocked.listBlockedUsers).toHaveBeenCalledTimes(2);
    expect(forced).toEqual([]);
  });

  it("shares one in-flight request between concurrent callers", async () => {
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);

    const [a, b] = await Promise.all([loadBlockedUsers(), loadBlockedUsers()]);

    expect(mocked.listBlockedUsers).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("tolerates a null payload", async () => {
    mocked.listBlockedUsers.mockResolvedValue(null as unknown as BlockedUser[]);

    await expect(loadBlockedUsers()).resolves.toEqual([]);
  });

  it("does not reuse another session's list (cache is keyed by the auth token)", async () => {
    setStoredToken("token-a");
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);
    await loadBlockedUsers();
    expect(isBlockedUsername("alice")).toBe(true);

    setStoredToken("token-b");
    expect(peekBlockedUsers()).toBeNull();
    expect(isBlockedUsername("alice")).toBe(false);

    mocked.listBlockedUsers.mockResolvedValue([]);
    await loadBlockedUsers();
    expect(mocked.listBlockedUsers).toHaveBeenCalledTimes(2);
  });

  it("surfaces a load failure and caches nothing", async () => {
    mocked.listBlockedUsers.mockRejectedValue(new Error("500"));

    await expect(loadBlockedUsers()).rejects.toThrow("500");
    expect(peekBlockedUsers()).toBeNull();
  });

  it("invalidateBlockedUsers drops the cache", async () => {
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);
    await loadBlockedUsers();

    invalidateBlockedUsers();

    expect(peekBlockedUsers()).toBeNull();
  });
});

describe("mutations", () => {
  it("blocks the user and invalidates the cache", async () => {
    mocked.listBlockedUsers.mockResolvedValue([]);
    await loadBlockedUsers();
    mocked.blockUser.mockResolvedValue(undefined);

    await blockUser("alice");

    expect(mocked.blockUser).toHaveBeenCalledWith("alice");
    expect(peekBlockedUsers()).toBeNull();
  });

  it("unblocks the user and invalidates the cache", async () => {
    mocked.unblockUser.mockResolvedValue(undefined);

    await unblockUser("alice");

    expect(mocked.unblockUser).toHaveBeenCalledWith("alice");
    expect(peekBlockedUsers()).toBeNull();
  });

  it("propagates a failed block and leaves the cache untouched", async () => {
    mocked.listBlockedUsers.mockResolvedValue([blocked("alice")]);
    await loadBlockedUsers();
    mocked.blockUser.mockRejectedValue(new Error("boom"));

    await expect(blockUser("bob")).rejects.toThrow("boom");

    // The previous list is still valid — nothing was changed server-side.
    expect(isBlockedUsername("alice")).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsApi } from "./notifications.api";
import { apiRequest } from "@/api/client";

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const mocked = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notificationsApi.list", () => {
  it("reads a BARE ARRAY, not a PageResult envelope", async () => {
    // This is the phase's signature trap: the follow endpoints wrap in
    // {items, nextCursor, total}, this one does not. If this module ever starts
    // reading `.items`, this test is what catches it.
    const rows = [{ id: "n1", category: "FOLLOW", title: "爱丽丝 关注了你", read: false }];
    mocked.mockResolvedValue(rows);

    await expect(notificationsApi.list()).resolves.toEqual(rows);
  });

  it("defaults the window to the backend ceiling of 50", async () => {
    mocked.mockResolvedValue([]);
    await notificationsApi.list();
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications?limit=50");
  });

  it("passes an explicit limit through", async () => {
    mocked.mockResolvedValue([]);
    await notificationsApi.list(10);
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications?limit=10");
  });

  it("sends no method override on the list read", async () => {
    mocked.mockResolvedValue([]);
    await notificationsApi.list();
    // apiRequest(path) only — GET is the transport default.
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications?limit=50");
    expect(mocked.mock.calls[0]).toHaveLength(1);
  });

  it("returns an empty array for an empty payload rather than undefined", async () => {
    mocked.mockResolvedValue([]);
    await expect(notificationsApi.list()).resolves.toEqual([]);
  });
});

describe("notificationsApi.markRead", () => {
  it("PATCHes the single-read endpoint and returns the updated view", async () => {
    const updated = { id: "n1", category: "FOLLOW", title: "t", read: true };
    mocked.mockResolvedValue(updated);

    await expect(notificationsApi.markRead("n1")).resolves.toEqual(updated);
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications/n1/read", { method: "PATCH" });
  });

  it("URL-encodes an id that needs it", async () => {
    mocked.mockResolvedValue({ id: "a/b", category: "FOLLOW", title: "t", read: true });
    await notificationsApi.markRead("a/b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications/a%2Fb/read", { method: "PATCH" });
  });
});

describe("notificationsApi.markAllRead", () => {
  it("POSTs read-all and resolves to undefined (204 no content)", async () => {
    mocked.mockResolvedValue(undefined);
    await expect(notificationsApi.markAllRead()).resolves.toBeUndefined();
    expect(mocked).toHaveBeenCalledWith("/api/v1/notifications/read-all", { method: "POST" });
  });
});

describe("notificationsApi surface", () => {
  it("exposes exactly the three notification operations", () => {
    // Guards against a second, drifting wrapper of the same endpoints.
    expect(Object.keys(notificationsApi)).toEqual(["list", "markRead", "markAllRead"]);
  });
});

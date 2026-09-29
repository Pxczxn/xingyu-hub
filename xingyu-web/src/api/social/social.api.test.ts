import { beforeEach, describe, expect, it, vi } from "vitest";
import { socialApi } from "./social.api";
import { apiRequest } from "@/api/client";

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const mocked = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("socialApi", () => {
  it("hits the /me endpoints with a limit and unwraps the envelope", async () => {
    mocked.mockResolvedValue({
      items: [{ userId: "u1", username: "alice" }],
      nextCursor: null,
      total: 1,
    });

    const following = await socialApi.listMyFollowing(30);

    expect(mocked).toHaveBeenCalledWith("/api/v1/me/following?limit=30");
    expect(following).toEqual([{ userId: "u1", username: "alice" }]);
  });

  it("defaults the limit to 20 for the /me lists", async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await socialApi.listMyFollowing();
    await socialApi.listMyFollowers();
    expect(mocked).toHaveBeenNthCalledWith(1, "/api/v1/me/following?limit=20");
    expect(mocked).toHaveBeenNthCalledWith(2, "/api/v1/me/followers?limit=20");
  });

  it("defaults the limit to 50 for another user's lists", async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await socialApi.listUserFollowing("alice");
    await socialApi.listUserFollowers("alice");
    expect(mocked).toHaveBeenNthCalledWith(1, "/api/v1/users/alice/following?limit=50");
    expect(mocked).toHaveBeenNthCalledWith(2, "/api/v1/users/alice/followers?limit=50");
  });

  it("URL-encodes a username that needs it", async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await socialApi.listUserFollowers("a b/c");
    expect(mocked).toHaveBeenCalledWith("/api/v1/users/a%20b%2Fc/followers?limit=50");
  });

  it("never issues a write — follow/unfollow live in usersApi", () => {
    // Guards against someone re-adding a second follow wrapper into this module.
    expect(Object.keys(socialApi)).toEqual([
      "listMyFollowing",
      "listMyFollowers",
      "listUserFollowing",
      "listUserFollowers",
    ]);
  });
});

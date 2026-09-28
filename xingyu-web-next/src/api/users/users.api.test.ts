import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { usersApi } from "@/api/users/users.api";

/*
 * Phase 2A-2a block endpoints. These are the ONLY wrappers for `/me/blocks`
 * (one wrapper per endpoint), so the exact method + path contract is pinned here:
 *   GET    /api/v1/me/blocks
 *   POST   /api/v1/me/blocks/{username}
 *   DELETE /api/v1/me/blocks/{username}
 * The path variable is a USERNAME, not a userId (verified against UserBlockService).
 */

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("usersApi block endpoints", () => {
  it("lists blocked users from GET /me/blocks", async () => {
    mockedRequest.mockResolvedValue([]);

    await usersApi.listBlockedUsers();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/blocks");
  });

  it("blocks a user by username via POST", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await usersApi.blockUser("alice");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/blocks/alice", { method: "POST" });
  });

  it("unblocks a user by username via DELETE", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await usersApi.unblockUser("alice");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/blocks/alice", { method: "DELETE" });
  });

  it("encodes the username in the path", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await usersApi.blockUser("a/b");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/blocks/a%2Fb", { method: "POST" });
  });
});

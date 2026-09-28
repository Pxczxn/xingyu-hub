import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/api/client";
import { savedMessagesApi } from "./saved-messages.api";
import { SAVED_MESSAGE_LIMIT } from "./saved-messages.types";

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return { ...actual, apiRequest: vi.fn() };
});

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("savedMessagesApi.list", () => {
  it("hits the /me/saved-messages path with the default limit", async () => {
    mockedRequest.mockResolvedValueOnce([]);
    await savedMessagesApi.list();
    expect(mockedRequest).toHaveBeenCalledWith(
      `/api/v1/me/saved-messages?limit=${SAVED_MESSAGE_LIMIT}`,
    );
  });

  it("passes an explicit limit through", async () => {
    mockedRequest.mockResolvedValueOnce([]);
    await savedMessagesApi.list(10);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/saved-messages?limit=10");
  });

  it("unwraps a bare array", async () => {
    mockedRequest.mockResolvedValueOnce([
      { id: "b1", messageId: "m1", conversationId: "c1", senderId: "u1" },
    ]);
    const rows = await savedMessagesApi.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].messageId).toBe("m1");
  });

  it("tolerates a null body instead of throwing", async () => {
    mockedRequest.mockResolvedValueOnce(null);
    await expect(savedMessagesApi.list()).resolves.toEqual([]);
  });
});

describe("savedMessagesApi.save", () => {
  it("POSTs {messageId} to the collection path", async () => {
    mockedRequest.mockResolvedValueOnce({ id: "b1", messageId: "m1" });
    await savedMessagesApi.save("m1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/saved-messages", {
      method: "POST",
      body: { messageId: "m1" },
    });
  });

  it("encodes a messageId that would otherwise break the request", async () => {
    mockedRequest.mockResolvedValueOnce({ id: "b1", messageId: "m/1" });
    await savedMessagesApi.save("m/1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/saved-messages", {
      method: "POST",
      body: { messageId: "m/1" },
    });
  });
});

describe("savedMessagesApi.remove", () => {
  it("DELETEs by MESSAGE id, not by the bookmark id", async () => {
    mockedRequest.mockResolvedValueOnce(undefined);
    await savedMessagesApi.remove("m1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/saved-messages/m1", {
      method: "DELETE",
    });
  });

  it("encodes the message id in the path", async () => {
    mockedRequest.mockResolvedValueOnce(undefined);
    await savedMessagesApi.remove("m 1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/saved-messages/m%201", {
      method: "DELETE",
    });
  });

  it("propagates the 404 a second removal produces", async () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "资源不存在",
      code: "NOT_FOUND",
    });
    mockedRequest.mockRejectedValueOnce(err);
    await expect(savedMessagesApi.remove("gone")).rejects.toBe(err);
  });
});

/*
 * The absence guard: this module must expose exactly the three operations the
 * backend supports. A fourth call (e.g. a "clear all" invented from the delete
 * route) would be a contract the server cannot answer. Pinning the key set
 * means an addition is a deliberate edit to this test, not a drive-by.
 */
describe("surface", () => {
  it("exposes exactly list / save / remove", () => {
    expect(Object.keys(savedMessagesApi).sort()).toEqual(["list", "remove", "save"]);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { myCommentsApi, myLikesApi } from "./me-activity.api";

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("myLikesApi", () => {
  it("GETs /me/likes with the default limit", async () => {
    await myLikesApi.list();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/likes?limit=20");
  });

  it("passes a custom limit through", async () => {
    await myLikesApi.list(5);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/likes?limit=5");
  });

  it("issues a GET — no method override is passed", async () => {
    await myLikesApi.list();
    const [, options] = mockedRequest.mock.calls[0] as [string, unknown];
    expect(options).toBeUndefined();
  });
});

describe("myCommentsApi", () => {
  it("GETs /me/comments with the default limit", async () => {
    await myCommentsApi.list();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/comments?limit=20");
  });

  it("passes a custom limit through", async () => {
    await myCommentsApi.list(50);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/comments?limit=50");
  });

  it("issues a GET — no method override is passed", async () => {
    await myCommentsApi.list();
    const [, options] = mockedRequest.mock.calls[0] as [string, unknown];
    expect(options).toBeUndefined();
  });
});

describe("no /me/history client exists", () => {
  it("does not expose a client for the non-existent /me/history route", () => {
    // `GET /me/history` 500s (no handler, no matching guard). NOTE this is NOT
    // the reading-history endpoint: that one is `/me/reading-history`, it DOES
    // exist (401), and it is not this module's concern.
    expect(Object.keys(myLikesApi)).not.toContain("history");
    expect(Object.keys(myLikesApi)).not.toContain("listHistory");
  });
});

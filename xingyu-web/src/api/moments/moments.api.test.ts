import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { momentsApi, meInsightsApi } from "@/api/moments/moments.api";

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

const VIEW = {
  id: "m-1",
  body: "一段动态",
  authorId: "u-1",
  createdAt: "2026-09-24T16:43:08Z",
};

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("momentsApi", () => {
  it("lists GET /api/v1/moments with a numeric limit", async () => {
    mockedRequest.mockResolvedValue([]);

    await momentsApi.list(20);

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/moments?limit=20");
  });

  it("creates POST /api/v1/moments with a body payload", async () => {
    mockedRequest.mockResolvedValue(VIEW);

    await momentsApi.create({ body: "一段动态" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/moments", {
      method: "POST",
      body: { body: "一段动态" },
    });
  });

  it("reads GET /api/v1/moments/{id}", async () => {
    mockedRequest.mockResolvedValue(VIEW);

    await momentsApi.getById("m-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/moments/m-1");
  });

  it("updates PATCH /api/v1/moments/{id}", async () => {
    mockedRequest.mockResolvedValue({ ...VIEW, body: "改过" });

    await momentsApi.update("m-1", { body: "改过" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/moments/m-1", {
      method: "PATCH",
      body: { body: "改过" },
    });
  });

  it("trashes POST /api/v1/moments/{id}/trash", async () => {
    mockedRequest.mockResolvedValue(VIEW);

    await momentsApi.trash("m-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/moments/m-1/trash", { method: "POST" });
  });

  it("lists mine via GET /api/v1/me/moments?limit=1000", async () => {
    mockedRequest.mockResolvedValue([VIEW]);

    await momentsApi.listMine(1000);

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/moments?limit=1000");
  });

  it("does not call /api/v1/me/moments/{id} mutation paths", () => {
    const serialized = JSON.stringify(momentsApi);
    expect(serialized).not.toContain("/me/moments/");
    expect(momentsApi.update.toString()).not.toContain("/me/moments/");
    expect(momentsApi.trash.toString()).not.toContain("/me/moments/");
  });
});

/*
 * Phase 2I-5: the owner-surface counters. Kept as its own client because the
 * payload counts articles/comments/likes, not just moments — a caller wanting
 * only the counters should not have to import a moments client to get them.
 */
describe("meInsightsApi", () => {
  it("reads GET /api/v1/me/insights", async () => {
    const payload = {
      articleCount: 3,
      draftCount: 1,
      followerCount: 12,
      followingCount: 7,
      commentCount: 5,
      likeCount: 42,
    };
    mockedRequest.mockResolvedValue(payload);

    await expect(meInsightsApi.get()).resolves.toEqual(payload);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/insights");
  });

  it("is a bare read — no method override, so it stays a GET", async () => {
    mockedRequest.mockResolvedValue({});
    await meInsightsApi.get();

    // A method key here would silently turn a read into a write.
    const [, options] = mockedRequest.mock.calls[0];
    expect(options).toBeUndefined();
  });
});

/*
 * Phase 2I-5: the owner-surface counters. Kept as its own client because the
 * payload counts articles/comments/likes, not just moments — a caller wanting
 * only the counters should not have to import a moments client to get them.
 */
describe("meInsightsApi", () => {
  it("reads GET /api/v1/me/insights", async () => {
    const payload = {
      articleCount: 3,
      draftCount: 1,
      followerCount: 12,
      followingCount: 7,
      commentCount: 5,
      likeCount: 42,
    };
    mockedRequest.mockResolvedValue(payload);

    await expect(meInsightsApi.get()).resolves.toEqual(payload);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/insights");
  });

  it("is a bare read — no method override, so it stays a GET", async () => {
    mockedRequest.mockResolvedValue({});
    await meInsightsApi.get();

    // A method key here would silently turn a read into a write.
    const [, options] = mockedRequest.mock.calls[0];
    expect(options).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { momentsApi } from "@/api/moments/moments.api";

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

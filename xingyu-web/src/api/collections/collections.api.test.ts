import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { collectionsApi } from "@/api/collections/collections.api";
import {
  COLLECTION_VISIBILITIES,
  isCollectionVisibility,
} from "@/api/collections/collections.types";

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("collectionsApi", () => {
  it("lists GET /api/v1/me/collections", async () => {
    mockedRequest.mockResolvedValue([]);

    await collectionsApi.listMine();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/collections");
  });

  it("creates POST /api/v1/me/collections with a typed visibility", async () => {
    mockedRequest.mockResolvedValue({
      id: "col-1",
      title: "读物",
      visibility: "PRIVATE",
      itemCount: 0,
    });

    await collectionsApi.create({ title: "读物", visibility: "PRIVATE" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/collections", {
      method: "POST",
      body: { title: "读物", visibility: "PRIVATE" },
    });
  });

  it("reads GET /api/v1/collections/{id}", async () => {
    mockedRequest.mockResolvedValue({
      id: "col-1",
      title: "读物",
      description: null,
      visibility: "PUBLIC",
      items: [],
    });

    await collectionsApi.getById("col-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/collections/col-1");
  });

  it("updates PATCH /api/v1/me/collections/{id}", async () => {
    mockedRequest.mockResolvedValue({
      id: "col-1",
      title: "改名",
      visibility: "UNLISTED",
      itemCount: 0,
    });

    await collectionsApi.update("col-1", { title: "改名", visibility: "UNLISTED" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/collections/col-1", {
      method: "PATCH",
      body: { title: "改名", visibility: "UNLISTED" },
    });
  });

  it("deletes DELETE /api/v1/me/collections/{id} and accepts 204", async () => {
    mockedRequest.mockResolvedValue(undefined);

    await expect(collectionsApi.remove("col-1")).resolves.toBeUndefined();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/collections/col-1", { method: "DELETE" });
  });

  it("treats only PRIVATE, PUBLIC, and UNLISTED as legal visibilities", () => {
    expect(COLLECTION_VISIBILITIES).toEqual(["PRIVATE", "PUBLIC", "UNLISTED"]);
    expect(isCollectionVisibility("PRIVATE")).toBe(true);
    expect(isCollectionVisibility("PUBLIC")).toBe(true);
    expect(isCollectionVisibility("UNLISTED")).toBe(true);
    expect(isCollectionVisibility("INVALID_WEB_V2_TEST")).toBe(false);
  });

  it("does not expose item or bookmark wrappers", () => {
    expect(collectionsApi).not.toHaveProperty("addItem");
    expect(collectionsApi).not.toHaveProperty("removeItem");
    expect(collectionsApi).not.toHaveProperty("moveItem");
    expect(collectionsApi).not.toHaveProperty("bookmark");
  });
});

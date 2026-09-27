import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";

vi.mock("@/api/client", () => ({ apiRequest: vi.fn() }));

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("seriesApi", () => {
  it("lists GET /api/v1/me/series", async () => {
    mockedRequest.mockResolvedValue([]);

    await seriesApi.listMine();

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/series");
  });

  it("creates POST /api/v1/me/series with title, slug, and description", async () => {
    mockedRequest.mockResolvedValue({
      id: "ser-1",
      title: "[WEB-V2 TEST] 星语开发日志",
      slug: "xing-yu-kai-fa-ri-zhi",
      description: "intro",
      status: "ACTIVE",
      lockVersion: 0,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
    });

    await seriesApi.create({
      title: "[WEB-V2 TEST] 星语开发日志",
      slug: "xing-yu-kai-fa-ri-zhi",
      description: "intro",
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/series", {
      method: "POST",
      body: {
        title: "[WEB-V2 TEST] 星语开发日志",
        slug: "xing-yu-kai-fa-ri-zhi",
        description: "intro",
      },
    });
  });

  it("reads GET /api/v1/me/series/{id}", async () => {
    mockedRequest.mockResolvedValue({
      id: "ser-1",
      title: "t",
      slug: "s",
      description: null,
      status: "ACTIVE",
      lockVersion: 0,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
    });

    await seriesApi.getMine("ser-1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/series/ser-1");
  });

  it("updates PUT /api/v1/me/series/{id} with lockVersion", async () => {
    mockedRequest.mockResolvedValue({
      id: "ser-1",
      title: "t",
      slug: "s",
      description: "d",
      status: "ARCHIVED",
      lockVersion: 1,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
    });

    await seriesApi.update("ser-1", {
      title: "t",
      description: "d",
      status: "ARCHIVED",
      lockVersion: 0,
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/series/ser-1", {
      method: "PUT",
      body: {
        title: "t",
        description: "d",
        status: "ARCHIVED",
        lockVersion: 0,
      },
    });
  });

  it("binds articles via PUT chapterArticleIds and lockVersion", async () => {
    mockedRequest.mockResolvedValue({
      id: "ser-1",
      title: "t",
      slug: "s",
      description: null,
      status: "ACTIVE",
      lockVersion: 4,
      chapters: [],
      updatedAt: "2026-09-25T14:15:36Z",
    });

    await seriesApi.update("ser-1", {
      chapterArticleIds: ["a1", "a2"],
      lockVersion: 3,
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/series/ser-1", {
      method: "PUT",
      body: { chapterArticleIds: ["a1", "a2"], lockVersion: 3 },
    });
  });

  it("does not expose chapter REST or public series wrappers", () => {
    expect(seriesApi).not.toHaveProperty("listChapters");
    expect(seriesApi).not.toHaveProperty("createChapter");
    expect(seriesApi).not.toHaveProperty("listPublic");
    expect(seriesApi).not.toHaveProperty("getPublic");
  });
});

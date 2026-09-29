import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";
import { articlesApi, normalizeLifecycleStatus } from "./articles.api";

/*
 * Article API unit tests (Phase 1C-3).
 *
 * `articlesApi` is mocked in every page test, so this is the only place the real
 * implementation of the lifecycle helpers is exercised.
 */

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeLifecycleStatus", () => {
  it("accepts the three real editorial statuses", () => {
    expect(normalizeLifecycleStatus("DRAFT")).toBe("DRAFT");
    expect(normalizeLifecycleStatus("IN_REVIEW")).toBe("IN_REVIEW");
    expect(normalizeLifecycleStatus("PUBLISHED")).toBe("PUBLISHED");
  });

  it("is case-insensitive and tolerates nullish input", () => {
    expect(normalizeLifecycleStatus("in_review")).toBe("IN_REVIEW");
    expect(normalizeLifecycleStatus(null)).toBe("DRAFT");
    expect(normalizeLifecycleStatus(undefined)).toBe("DRAFT");
    expect(normalizeLifecycleStatus("")).toBe("DRAFT");
  });

  it("falls back to DRAFT for unknown values rather than inventing a state", () => {
    expect(normalizeLifecycleStatus("ARCHIVED")).toBe("DRAFT");
  });
});

describe("listMine", () => {
  it("lists GET /api/v1/me/articles", async () => {
    apiRequestMock.mockResolvedValue([]);

    await articlesApi.listMine();

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles");
  });
});

describe("getMyArticleStatus", () => {
  it("reads the status of one article from the owner list", async () => {
    apiRequestMock.mockResolvedValue([
      { id: "other", status: "PUBLISHED", title: "x", categoryId: null, updatedAt: "" },
      { id: "a1", status: "IN_REVIEW", title: "y", categoryId: null, updatedAt: "" },
    ]);

    await expect(articlesApi.getMyArticleStatus("a1")).resolves.toBe("IN_REVIEW");
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles");
  });

  it("returns null when the article is not in the owner list", async () => {
    apiRequestMock.mockResolvedValue([]);

    await expect(articlesApi.getMyArticleStatus("missing")).resolves.toBeNull();
  });
});

describe("submitForReview", () => {
  it("POSTs to the submit endpoint and returns the submission id", async () => {
    apiRequestMock.mockResolvedValue({ submissionId: "sub-1" });

    await expect(articlesApi.submitForReview("a1")).resolves.toEqual({ submissionId: "sub-1" });
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles/a1/submit", {
      method: "POST",
    });
  });

  it("encodes the article id", async () => {
    apiRequestMock.mockResolvedValue({ submissionId: "sub-1" });

    await articlesApi.submitForReview("a/1 b");

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles/a%2F1%20b/submit", {
      method: "POST",
    });
  });
});

describe("listRevisions (Phase 2L)", () => {
  it("reads GET /api/v1/me/articles/{id}/revisions", async () => {
    const rows = [
      {
        id: "r1",
        revisionNumber: 2,
        title: "第二次发布",
        summary: "摘要",
        visibility: "PUBLIC",
        frozenAt: "2026-09-20T10:00:00Z",
      },
    ];
    apiRequestMock.mockResolvedValue(rows);

    await expect(articlesApi.listRevisions("a1")).resolves.toEqual(rows);
    // A GET carries no options object — assert the single-argument form.
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles/a1/revisions");
  });

  it("encodes the article id", async () => {
    apiRequestMock.mockResolvedValue([]);

    await articlesApi.listRevisions("a/1 b");

    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles/a%2F1%20b/revisions");
  });

  it("passes through an empty history (never-published draft)", async () => {
    // Formal revisions are only written on publish, so [] is a NORMAL answer,
    // not an error — the caller must not treat it as a failure.
    apiRequestMock.mockResolvedValue([]);

    await expect(articlesApi.listRevisions("draft-only")).resolves.toEqual([]);
  });
});

describe("restoreRevision (Phase 2L)", () => {
  it("POSTs to the restore endpoint and returns the updated draft", async () => {
    const draft = {
      articleId: "a1",
      title: "恢复后的标题",
      lockVersion: 5,
    };
    apiRequestMock.mockResolvedValue(draft);

    await expect(articlesApi.restoreRevision("a1", "r1")).resolves.toEqual(draft);
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/me/articles/a1/revisions/r1/restore", {
      method: "POST",
    });
  });

  it("encodes both ids independently", async () => {
    apiRequestMock.mockResolvedValue({});

    await articlesApi.restoreRevision("a/1", "r/2");

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/v1/me/articles/a%2F1/revisions/r%2F2/restore",
      { method: "POST" },
    );
  });

  it("surfaces the 409 CONFLICT used for a non-editable article", async () => {
    // `@/api/client` is mocked wholesale here, so the real ApiError class is not
    // available. What matters for this layer is only that the rejection is
    // passed through untouched — the page layer is what interprets `status`.
    const conflict = Object.assign(new Error("文章当前不可恢复版本"), {
      name: "ApiError",
      problem: {
        type: "about:blank",
        title: "冲突",
        status: 409,
        detail: "文章当前不可恢复版本",
        code: "CONFLICT",
      },
    });
    apiRequestMock.mockRejectedValue(conflict);

    await expect(articlesApi.restoreRevision("a1", "r1")).rejects.toBe(conflict);
  });
});

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

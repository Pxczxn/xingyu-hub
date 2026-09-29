import { beforeEach, describe, expect, it, vi } from "vitest";
import { recommendationFeedbackApi } from "./recommendation-feedback.api";
import { RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT } from "./recommendation-feedback.types";

/*
 * Surface + wire-shape tests. `apiRequest` is mocked (house pattern) so these
 * pin the REQUEST SHAPE and the SURFACE, not transport behaviour.
 */

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("recommendationFeedbackApi surface", () => {
  it("exposes exactly list + submit", () => {
    expect(Object.keys(recommendationFeedbackApi).sort()).toEqual(["list", "submit"]);
  });

  it("exposes no delete/edit — the backend has neither", () => {
    // The controller defines GET and POST only. A "撤销反馈" control would be
    // a button with no endpoint behind it.
    const keys = Object.keys(recommendationFeedbackApi);
    for (const absent of ["remove", "delete", "update", "edit"]) {
      expect(keys).not.toContain(absent);
    }
  });
});

describe("recommendationFeedbackApi.list", () => {
  it("GETs the me-scoped path with the default limit", async () => {
    await recommendationFeedbackApi.list();
    expect(mockedRequest).toHaveBeenCalledWith(
      `/api/v1/me/recommendation-feedback?limit=${RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT}`,
    );
  });

  it("sends an explicit limit and no cursor (there is no cursor)", async () => {
    await recommendationFeedbackApi.list(50);
    const [url] = mockedRequest.mock.calls[0] as [string];
    expect(url).toBe("/api/v1/me/recommendation-feedback?limit=50");
    expect(url).not.toContain("cursor");
  });

  it("returns the bare array unchanged (no unwrapping)", async () => {
    mockedRequest.mockResolvedValue([
      { id: "f1", body: "推荐太偏技术了", createdAt: "2026-09-28T10:00:00Z" },
    ]);
    const rows = await recommendationFeedbackApi.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("推荐太偏技术了");
  });

  it("propagates a failure rather than inventing an empty list", async () => {
    mockedRequest.mockRejectedValue(new Error("请先登录"));
    await expect(recommendationFeedbackApi.list()).rejects.toThrow("请先登录");
  });
});

describe("recommendationFeedbackApi.submit", () => {
  it("POSTs ONLY { body } to the me-scoped path", async () => {
    mockedRequest.mockResolvedValue({ id: "f9", body: "希望多点设计", createdAt: "2026-09-28T10:00:00Z" });
    await recommendationFeedbackApi.submit("希望多点设计");

    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/recommendation-feedback", {
      method: "POST",
      // Only `body` — the service reads no other field. Sending a rating or a
      // target id would imply capability the endpoint does not have.
      body: { body: "希望多点设计" },
    });
  });

  it("returns the stored row (server-minted id)", async () => {
    mockedRequest.mockResolvedValue({ id: "f9", body: "x", createdAt: "2026-09-28T10:00:00Z" });
    const row = await recommendationFeedbackApi.submit("x");
    expect(row.id).toBe("f9");
  });

  it("propagates the server's validation error", async () => {
    mockedRequest.mockRejectedValue(new Error("body: 反馈内容不能为空"));
    await expect(recommendationFeedbackApi.submit("   ")).rejects.toThrow("反馈内容不能为空");
  });
});

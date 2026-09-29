import { describe, expect, it, vi, beforeEach } from "vitest";
import { submissionsApi } from "./submissions.api";
import {
  canWithdraw,
  isSubmissionPending,
  submissionArticleHref,
  submissionFeedback,
  submissionStatusDescription,
  submissionStatusLabel,
  submissionTitle,
} from "./submissions.types";

const mockedRequest = vi.fn();

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, apiRequest: (...args: unknown[]) => mockedRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue([]);
});

describe("submissionsApi", () => {
  it("GETs /me/submissions with the default limit", async () => {
    await submissionsApi.listMine();
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/submissions?limit=20");
  });

  it("passes a custom limit through", async () => {
    await submissionsApi.listMine(50);
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/submissions?limit=50");
  });

  it("GETs a submission detail and encodes the id", async () => {
    await submissionsApi.getById("a b/c");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/submissions/a%20b%2Fc");
  });

  it("POSTs to the withdraw path with NO body", async () => {
    // The controller takes only the path variable.
    await submissionsApi.withdraw("s1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/submissions/s1/withdraw", {
      method: "POST",
    });
  });

  it("encodes the id on the withdraw path too", async () => {
    await submissionsApi.withdraw("a/b");
    expect(mockedRequest).toHaveBeenCalledWith("/api/v1/me/submissions/a%2Fb/withdraw", {
      method: "POST",
    });
  });
});

describe("submissionStatusLabel — the exact five statuses", () => {
  it("maps every status the backend can write", () => {
    // Confirmed by grepping each setStatus in ReviewService.
    expect(submissionStatusLabel("PENDING")).toBe("待审核");
    expect(submissionStatusLabel("APPROVED")).toBe("已通过");
    expect(submissionStatusLabel("REJECTED")).toBe("未通过");
    expect(submissionStatusLabel("RETURNED")).toBe("已退回");
    expect(submissionStatusLabel("WITHDRAWN")).toBe("已撤回");
  });

  it("is case-insensitive", () => {
    expect(submissionStatusLabel("pending")).toBe("待审核");
  });

  it("echoes an unknown status verbatim instead of mislabelling it", () => {
    // Legacy defaulted unknown to the PENDING copy — that would silently claim
    // an unrecognised state is queued for review.
    expect(submissionStatusLabel("ESCALATED")).toBe("ESCALATED");
  });
});

describe("submissionStatusDescription", () => {
  it("describes each known status", () => {
    expect(submissionStatusDescription("PENDING")).toContain("审核队列");
    expect(submissionStatusDescription("APPROVED")).toContain("符合社区规范");
  });

  it("does NOT borrow another status's copy for an unknown value", () => {
    const unknown = submissionStatusDescription("ESCALATED");
    expect(unknown).toBe("当前状态暂无法识别。");
    expect(unknown).not.toContain("审核队列");
  });
});

describe("isSubmissionPending", () => {
  it("is true only for PENDING", () => {
    expect(isSubmissionPending("PENDING")).toBe(true);
    for (const s of ["APPROVED", "REJECTED", "RETURNED", "WITHDRAWN", "ESCALATED"]) {
      expect(isSubmissionPending(s)).toBe(false);
    }
  });
});

describe("canWithdraw", () => {
  it("allows only PENDING — the server rejects everything else", () => {
    expect(canWithdraw("PENDING")).toBe(true);
    expect(canWithdraw("pending")).toBe(true);
    for (const s of ["APPROVED", "REJECTED", "RETURNED", "WITHDRAWN"]) {
      expect(canWithdraw(s)).toBe(false);
    }
  });

  it("treats an empty status as not withdrawable", () => {
    expect(canWithdraw("")).toBe(false);
  });
});

describe("submissionArticleHref", () => {
  it("links APPROVED content to its public article page", () => {
    expect(submissionArticleHref("APPROVED", "a1")).toBe("/articles/a1");
  });

  it("links non-approved content back to the editor", () => {
    expect(submissionArticleHref("PENDING", "a1")).toBe("/studio/content/a1");
    expect(submissionArticleHref("WITHDRAWN", "a1")).toBe("/studio/content/a1");
  });

  it("returns null for a missing articleId rather than building /articles/undefined", () => {
    // Legacy's version would produce a broken link here.
    expect(submissionArticleHref("APPROVED", null)).toBeNull();
    expect(submissionArticleHref("APPROVED", "")).toBeNull();
    expect(submissionArticleHref("APPROVED", undefined)).toBeNull();
  });

  it("encodes the article id", () => {
    expect(submissionArticleHref("APPROVED", "a/b")).toBe("/articles/a%2Fb");
  });
});

describe("submissionFeedback", () => {
  it("returns the trimmed comment", () => {
    expect(submissionFeedback({ decisionComment: "  标题需要修改  " })).toBe("标题需要修改");
  });

  it("returns null when there is no comment — the page shows its own empty note", () => {
    // Returning a filler sentence would invent a reviewer opinion.
    expect(submissionFeedback({ decisionComment: null })).toBeNull();
    expect(submissionFeedback({ decisionComment: "" })).toBeNull();
    expect(submissionFeedback({ decisionComment: "   " })).toBeNull();
    expect(submissionFeedback({})).toBeNull();
  });
});

describe("submissionTitle", () => {
  it("uses the title when present", () => {
    expect(submissionTitle({ title: "我的文章", articleId: "a1" })).toBe("我的文章");
  });

  it("falls back for a null title, naming the article id", () => {
    // `toDetailView` returns a null title when the formal revision row is gone.
    expect(submissionTitle({ title: null, articleId: "a1" })).toBe("未命名投稿（a1）");
    expect(submissionTitle({ title: "   ", articleId: "a1" })).toBe("未命名投稿（a1）");
  });
});

import { describe, expect, it } from "vitest";
import {
  resolveArticleHref,
  resolveReviewFeedback,
  resolveReviewStatusMeta,
  resolveReviewStepStates,
} from "./review-detail-meta";

describe("review-detail-meta", () => {
  it("maps pending status to waiting copy and step 1", () => {
    expect(resolveReviewStatusMeta("PENDING")).toMatchObject({
      title: "已提交审核，排队等待中",
      pulse: true,
      tone: "pending",
    });
    expect(resolveReviewStepStates("PENDING")).toEqual(["current", "upcoming", "upcoming"]);
    expect(resolveReviewFeedback("PENDING")).toBe("审核尚未完成，请耐心等待。");
  });

  it("maps approved status to completed steps", () => {
    expect(resolveReviewStepStates("APPROVED")).toEqual(["done", "done", "done"]);
    expect(resolveArticleHref("APPROVED", "abc")).toBe("/articles/abc");
  });

  it("prefers decision comment in feedback", () => {
    expect(resolveReviewFeedback("REJECTED", "标题不符合规范")).toBe("标题不符合规范");
  });

  it("routes non-approved articles to editor", () => {
    expect(resolveArticleHref("PENDING", "abc")).toBe("/studio/content/abc");
  });
});

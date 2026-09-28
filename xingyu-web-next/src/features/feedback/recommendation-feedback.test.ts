import { describe, expect, it } from "vitest";
import {
  RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT,
  RECOMMENDATION_FEEDBACK_MAX_LENGTH,
  RECOMMENDATION_FEEDBACK_MAX_LIMIT,
} from "@/api/recommendation-feedback/recommendation-feedback.types";
import type { RecommendationFeedback } from "@/api/recommendation-feedback/recommendation-feedback.types";
import {
  FEEDBACK_SCOPE_NOTE,
  checkFeedbackBody,
  clampLimit,
  formatFeedbackTime,
  isJustSubmitted,
  prependFeedback,
  remainingChars,
} from "./recommendation-feedback";

function row(over: Partial<RecommendationFeedback> = {}): RecommendationFeedback {
  return { id: "f1", body: "推荐太偏技术", createdAt: "2026-09-28T10:00:00Z", ...over };
}

describe("checkFeedbackBody", () => {
  it("trims and accepts a normal body", () => {
    expect(checkFeedbackBody("  希望多点设计  ")).toEqual({ ok: true, body: "希望多点设计" });
  });

  it("rejects whitespace-only input (mirrors the server's isBlank check)", () => {
    const result = checkFeedbackBody("   \n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty");
      expect(result.message).toContain("请输入");
    }
  });

  it("rejects an empty body", () => {
    expect(checkFeedbackBody("").ok).toBe(false);
  });

  it("accepts a body exactly at the 2000-char limit", () => {
    const result = checkFeedbackBody("x".repeat(RECOMMENDATION_FEEDBACK_MAX_LENGTH));
    expect(result.ok).toBe(true);
  });

  it("rejects one char past the limit and names the real number", () => {
    const result = checkFeedbackBody("x".repeat(RECOMMENDATION_FEEDBACK_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_long");
      expect(result.message).toContain(String(RECOMMENDATION_FEEDBACK_MAX_LENGTH));
    }
  });

  it("counts TRIMMED length, so trailing spaces cannot push a valid body over", () => {
    const body = "x".repeat(RECOMMENDATION_FEEDBACK_MAX_LENGTH);
    expect(checkFeedbackBody(`${body}     `).ok).toBe(true);
  });
});

describe("remainingChars", () => {
  it("counts down from the limit", () => {
    expect(remainingChars("abc")).toBe(RECOMMENDATION_FEEDBACK_MAX_LENGTH - 3);
  });

  it("floors at 0 rather than going negative", () => {
    expect(remainingChars("x".repeat(RECOMMENDATION_FEEDBACK_MAX_LENGTH + 50))).toBe(0);
  });

  it("returns the full budget for an empty string", () => {
    expect(remainingChars("")).toBe(RECOMMENDATION_FEEDBACK_MAX_LENGTH);
  });
});

describe("clampLimit", () => {
  it("mirrors the server's Math.min(Math.max(limit, 1), 50)", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-10)).toBe(1);
    expect(clampLimit(20)).toBe(20);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(999)).toBe(RECOMMENDATION_FEEDBACK_MAX_LIMIT);
  });

  it("falls back to the default for a non-finite value", () => {
    expect(clampLimit(Number.NaN)).toBe(RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT);
    expect(clampLimit(Number.POSITIVE_INFINITY)).toBe(RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT);
  });

  it("truncates a fractional value", () => {
    expect(clampLimit(12.9)).toBe(12);
  });
});

describe("prependFeedback", () => {
  it("prepends the new entry", () => {
    const result = prependFeedback([row({ id: "a" })], row({ id: "b" }));
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("de-duplicates by id, keeping the NEW entry's position", () => {
    const result = prependFeedback([row({ id: "a" }), row({ id: "b" })], row({ id: "b" }));
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
    expect(result).toHaveLength(2);
  });

  it("bounds the list to the limit so it cannot grow past a refresh", () => {
    const current = Array.from({ length: 20 }, (_, i) => row({ id: `old-${i}` }));
    const result = prependFeedback(current, row({ id: "new" }), 20);
    expect(result).toHaveLength(20);
    expect(result[0].id).toBe("new");
    // The OLDEST entry is the one dropped, not the newest.
    expect(result.map((r) => r.id)).not.toContain("old-19");
  });

  it("clamps a bogus limit instead of producing a nonsense window", () => {
    const current = [row({ id: "a" }), row({ id: "b" })];
    expect(prependFeedback(current, row({ id: "c" }), 0)).toHaveLength(1);
    expect(prependFeedback(current, row({ id: "c" }), 999)).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const current = [row({ id: "a" })];
    prependFeedback(current, row({ id: "b" }));
    expect(current.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("isJustSubmitted", () => {
  it("is true when the entry's id is present", () => {
    expect(isJustSubmitted(row({ id: "a" }), [row({ id: "a" })])).toBe(true);
  });

  it("is false when it is absent (e.g. a fresh fetch replaced the list)", () => {
    expect(isJustSubmitted(row({ id: "a" }), [row({ id: "z" })])).toBe(false);
  });

  it("is false for a null entry", () => {
    expect(isJustSubmitted(null, [row({ id: "a" })])).toBe(false);
  });

  it("compares ids, NOT body text (two identical complaints are legitimate)", () => {
    const same = row({ id: "a", body: "太偏技术" });
    const other = row({ id: "b", body: "太偏技术" });
    // Same text, different row -> must NOT be treated as the one just submitted.
    expect(isJustSubmitted(other, [same])).toBe(false);
  });
});

describe("formatFeedbackTime", () => {
  it("returns '' for a missing value", () => {
    expect(formatFeedbackTime(null)).toBe("");
    expect(formatFeedbackTime(undefined)).toBe("");
    expect(formatFeedbackTime("")).toBe("");
  });

  it("returns the raw string for an unparseable value rather than 'Invalid Date'", () => {
    expect(formatFeedbackTime("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO timestamp", () => {
    const label = formatFeedbackTime("2026-09-28T10:00:00Z");
    expect(label).toBeTruthy();
    expect(label).not.toBe("Invalid Date");
  });
});

describe("FEEDBACK_SCOPE_NOTE", () => {
  it("states that this is about the whole recommender, not one article", () => {
    // Guards the copy that prevents the most likely user misunderstanding.
    expect(FEEDBACK_SCOPE_NOTE).toContain("整个推荐系统");
    expect(FEEDBACK_SCOPE_NOTE).toContain("不是针对某一篇文章");
  });

  it("warns that submission cannot be undone (the backend has no delete)", () => {
    expect(FEEDBACK_SCOPE_NOTE).toContain("无法修改或删除");
  });
});

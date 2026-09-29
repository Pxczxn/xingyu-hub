import { describe, expect, it } from "vitest";
import type { ArticleRevision } from "@/api/articles/articles.types";
import {
  canRestore,
  formatFrozenAt,
  restoreBlockedReason,
  revisionLabel,
  revisionTitle,
  visibilityLabel,
} from "./revision-history";

function revision(overrides: Partial<ArticleRevision> = {}): ArticleRevision {
  return {
    id: "r1",
    revisionNumber: 3,
    title: "标题",
    summary: "摘要",
    visibility: "PUBLIC",
    frozenAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

describe("visibilityLabel", () => {
  it("labels the three real visibility values", () => {
    expect(visibilityLabel("PUBLIC")).toBe("公开");
    expect(visibilityLabel("UNLISTED")).toBe("仅链接可见");
    expect(visibilityLabel("PRIVATE")).toBe("私密");
  });

  it("is case-insensitive", () => {
    expect(visibilityLabel("public")).toBe("公开");
  });

  it("echoes an unknown value instead of guessing", () => {
    expect(visibilityLabel("ARCHIVED")).toBe("ARCHIVED");
  });

  it("tolerates nullish input", () => {
    expect(visibilityLabel(null)).toBe("");
    expect(visibilityLabel(undefined)).toBe("");
  });

  it("never renders PUBLISHED as a visibility — that is not a real value", () => {
    // Legacy branched on `visibility === "PUBLISHED"` (dead code). If the
    // backend ever sent it we would echo it, but we must not translate it into
    // a friendly label that implies we understand it.
    expect(visibilityLabel("PUBLISHED")).toBe("PUBLISHED");
  });
});

describe("revisionLabel", () => {
  it("describes the row as a published version with its number", () => {
    expect(revisionLabel(revision({ revisionNumber: 3 }))).toBe("发布版本 · 第 3 版");
  });

  it("never claims these are auto-saves", () => {
    // The single most important assertion on this page: formal revisions are
    // written on publish, NOT every 3 minutes.
    const label = revisionLabel(revision());
    expect(label).not.toContain("自动保存");
    expect(label).toContain("发布版本");
  });

  it("falls back when the number is missing or zero", () => {
    expect(revisionLabel(revision({ revisionNumber: 0 }))).toBe("发布版本 · 历史版本");
  });
});

describe("formatFrozenAt", () => {
  it("formats a valid ISO instant", () => {
    const formatted = formatFrozenAt("2026-09-20T10:00:00Z");
    expect(formatted).toBeTruthy();
    expect(formatted).toMatch(/2026/);
  });

  it("returns null for a missing value rather than printing Invalid Date", () => {
    expect(formatFrozenAt(null)).toBeNull();
    expect(formatFrozenAt(undefined)).toBeNull();
    expect(formatFrozenAt("")).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(formatFrozenAt("not-a-date")).toBeNull();
  });
});

describe("revisionTitle", () => {
  it("returns the frozen title", () => {
    expect(revisionTitle(revision({ title: "初稿" }))).toBe("初稿");
  });

  it("falls back for a null or blank title", () => {
    expect(revisionTitle(revision({ title: null }))).toBe("（该版本没有标题）");
    expect(revisionTitle(revision({ title: "   " }))).toBe("（该版本没有标题）");
  });
});

describe("canRestore", () => {
  it("allows PUBLISHED — rolling back a published piece is the headline case", () => {
    expect(canRestore("PUBLISHED")).toBe(true);
  });

  it("allows DRAFT", () => {
    expect(canRestore("DRAFT")).toBe(true);
  });

  it("refuses IN_REVIEW because the backend returns 409 for it", () => {
    expect(canRestore("IN_REVIEW")).toBe(false);
  });

  it("refuses when the status is unknown rather than assuming it is fine", () => {
    expect(canRestore(null)).toBe(false);
    expect(canRestore(undefined)).toBe(false);
    expect(canRestore("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(canRestore("published")).toBe(true);
  });
});

describe("restoreBlockedReason", () => {
  it("returns null when restoration is allowed", () => {
    expect(restoreBlockedReason("PUBLISHED")).toBeNull();
    expect(restoreBlockedReason("DRAFT")).toBeNull();
  });

  it("explains the review-queue case specifically", () => {
    const reason = restoreBlockedReason("IN_REVIEW");
    expect(reason).toContain("审核");
  });

  it("explains the unknown case without pretending to know the state", () => {
    const reason = restoreBlockedReason(null);
    expect(reason).toContain("无法确认");
  });

  it("always returns a non-empty reason when blocked", () => {
    for (const status of ["IN_REVIEW", null, undefined, "", "WEIRD"]) {
      expect(restoreBlockedReason(status)).toBeTruthy();
    }
  });
});

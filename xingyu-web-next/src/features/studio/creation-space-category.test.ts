import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import type { CreationSpaceCategory } from "@/api/creation-space/creation-space.types";
import {
  categoryPathHint,
  countArchived,
  deriveSlug,
  describeCategoryError,
  effectiveSlug,
  optionalSlug,
  shouldReloadAfterFailure,
  sortForDisplay,
  statusLabel,
  statusTone,
  validateName,
  validateSlug,
} from "./creation-space-category";

/*
 * Pure logic for the category manager (Phase 2N).
 *
 * The slug helpers mirror `CreationSpaceCategoryService` exactly, so the point of
 * most of these is PARITY with the server's own normalisation and validation —
 * the client should reject the same inputs, for the same stated reason, before
 * spending a round trip.
 */

function category(overrides: Partial<CreationSpaceCategory> = {}): CreationSpaceCategory {
  return {
    id: "c1",
    name: "散文",
    slug: "essay",
    status: "ACTIVE",
    lockVersion: 0,
    sortOrder: 0,
    ...overrides,
  };
}

function apiError(status: number, detail: string): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "",
    status,
    detail,
    code: "X",
  });
}

describe("deriveSlug (mirrors server normalizeSlug)", () => {
  it("lowercases and turns spaces into dashes", () => {
    expect(deriveSlug("My Essay")).toBe("my-essay");
  });

  it("trims first", () => {
    expect(deriveSlug("  padded  ")).toBe("padded");
  });

  it("collapses nothing else — punctuation survives, then fails validation", () => {
    // Deliberate: reproducing the server means we reject what the server rejects.
    expect(deriveSlug("散文集")).toBe("散文集");
    expect(validateSlug(deriveSlug("散文集"))).not.toBeNull();
  });
});

describe("validateName", () => {
  it("accepts a normal name", () => {
    expect(validateName("散文")).toBeNull();
  });

  it("rejects blank and whitespace-only names with the server's wording", () => {
    expect(validateName("")).toContain("不能为空");
    expect(validateName("   ")).toContain("不能为空");
  });

  it("rejects names past the limit", () => {
    expect(validateName("a".repeat(65))).toContain("不能超过");
    expect(validateName("a".repeat(64))).toBeNull();
  });
});

describe("validateSlug", () => {
  it("treats blank as legal — the server derives one", () => {
    expect(validateSlug("")).toBeNull();
    expect(validateSlug("   ")).toBeNull();
  });

  it("accepts the documented pattern", () => {
    expect(validateSlug("my-essay-2")).toBeNull();
    expect(validateSlug("ab")).toBeNull();
  });

  it("rejects single characters (pattern is {2,64})", () => {
    expect(validateSlug("a")).not.toBeNull();
  });

  it("rejects uppercase, underscores and CJK", () => {
    expect(validateSlug("Essay")).not.toBeNull();
    expect(validateSlug("my_essay")).not.toBeNull();
    expect(validateSlug("散文")).not.toBeNull();
  });

  it("rejects over-long slugs", () => {
    expect(validateSlug("a".repeat(65))).not.toBeNull();
    expect(validateSlug("a".repeat(64))).toBeNull();
  });
});

describe("effectiveSlug", () => {
  it("prefers the typed slug", () => {
    expect(effectiveSlug("散文", "prose")).toBe("prose");
  });

  it("derives from the name when the slug is blank", () => {
    expect(effectiveSlug("My Essay", "")).toBe("my-essay");
  });

  it("lowercases a typed slug so the preview matches what is sent", () => {
    expect(effectiveSlug("散文", "PRose")).toBe("prose");
  });
});

describe("optionalSlug", () => {
  it("returns undefined for blank so we do not send a pointless empty string", () => {
    expect(optionalSlug("  ")).toBeUndefined();
  });

  it("returns the lowercased value otherwise", () => {
    expect(optionalSlug(" Prose ")).toBe("prose");
  });
});

describe("categoryPathHint", () => {
  it("uses the real V2 profile path", () => {
    expect(categoryPathHint("alice", "essay")).toBe("/u/alice/works/essay");
  });

  it("degrades to a relative hint when the username is unknown", () => {
    expect(categoryPathHint(null, "essay")).toBe("/works/essay");
    expect(categoryPathHint("   ", "essay")).toBe("/works/essay");
  });
});

describe("statusLabel / statusTone", () => {
  it("translates the two known statuses", () => {
    expect(statusLabel("ACTIVE")).toBe("使用中");
    expect(statusLabel("ARCHIVED")).toBe("已归档");
  });

  it("is case-insensitive", () => {
    expect(statusLabel("active")).toBe("使用中");
    expect(statusTone("archived")).toBe("archived");
  });

  it("echoes an unknown status rather than guessing", () => {
    expect(statusLabel("WEIRD")).toBe("WEIRD");
    expect(statusTone("WEIRD")).toBe("unknown");
    expect(statusLabel("")).toBe("未知状态");
  });
});

describe("sortForDisplay", () => {
  it("lifts archived rows to the bottom, preserving order within groups", () => {
    const rows = sortForDisplay([
      category({ id: "a", status: "ARCHIVED" }),
      category({ id: "b", status: "ACTIVE" }),
      category({ id: "c", status: "ARCHIVED" }),
      category({ id: "d", status: "ACTIVE" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("keeps unknown statuses between active and archived", () => {
    const rows = sortForDisplay([
      category({ id: "a", status: "ARCHIVED" }),
      category({ id: "b", status: "WEIRD" }),
      category({ id: "c", status: "ACTIVE" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input", () => {
    const rows = [category({ id: "a", status: "ARCHIVED" }), category({ id: "b" })];
    const snapshot = rows.map((r) => r.id);
    sortForDisplay(rows);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
  });
});

describe("countArchived", () => {
  it("counts only archived rows", () => {
    expect(
      countArchived([
        category({ status: "ACTIVE" }),
        category({ status: "ARCHIVED" }),
        category({ status: "ARCHIVED" }),
      ]),
    ).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(countArchived([])).toBe(0);
  });
});

describe("describeCategoryError", () => {
  it("prefers the server's own sentence, which is already user-facing", () => {
    // "别名已被占用" is more useful than anything generic we could write.
    expect(describeCategoryError(apiError(422, "别名已被占用"), "保存失败")).toBe("别名已被占用");
  });

  it("falls back to a status-specific sentence when detail is empty", () => {
    expect(describeCategoryError(apiError(409, ""), "保存失败")).toContain("刷新");
    expect(describeCategoryError(apiError(404, ""), "保存失败")).toContain("不存在");
    expect(describeCategoryError(apiError(401, ""), "保存失败")).toContain("登录");
  });

  it("uses the caller's fallback for a plain Error", () => {
    expect(describeCategoryError(new Error("boom"), "保存失败")).toBe("保存失败");
  });

  it("tolerates a non-Error rejection", () => {
    expect(describeCategoryError("nope", "保存失败")).toBe("保存失败");
  });
});

describe("shouldReloadAfterFailure", () => {
  it("says reload on 409 — the optimistic lock rejected our stale version", () => {
    expect(shouldReloadAfterFailure(apiError(409, ""))).toBe(true);
  });

  it("says reload on 404 — the row is gone", () => {
    expect(shouldReloadAfterFailure(apiError(404, ""))).toBe(true);
  });

  it("does NOT say reload for a network-ish failure — retrying the same body may work", () => {
    expect(shouldReloadAfterFailure(apiError(500, ""))).toBe(false);
    expect(shouldReloadAfterFailure(new Error("offline"))).toBe(false);
  });
});

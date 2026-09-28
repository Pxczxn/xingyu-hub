import { describe, expect, it } from "vitest";
import type { ProfileDetail } from "@/api/users/users.types";
import {
  VISIBILITY_OPTIONS,
  buildProfilePatch,
  findClearAttempts,
  hasProfileChanges,
  toProfileFormValues,
  toVisibilityChoice,
  validateWebsiteUrlInput,
  type ProfileFormValues,
} from "@/features/settings/settings-form";

/*
 * Pure-logic tests for the Settings profile form.
 * These cover the parts that are easy to get subtly wrong: the patch payload
 * shape and the "backend cannot clear a field" guard.
 */

function profile(overrides: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    username: "tester",
    displayName: "测试昵称",
    bio: "一段简介",
    websiteUrl: "https://example.com",
    visibility: "PUBLIC",
    followersVisibility: "PRIVATE",
    lockVersion: 3,
    ...overrides,
  };
}

function form(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    displayName: "测试昵称",
    bio: "一段简介",
    websiteUrl: "https://example.com",
    visibility: "PUBLIC",
    ...overrides,
  };
}

describe("toProfileFormValues", () => {
  it("maps nulls to empty strings and folds a missing visibility onto 不列出", () => {
    const values = toProfileFormValues(
      profile({ displayName: null, bio: null, websiteUrl: null, visibility: undefined }),
    );
    expect(values).toEqual({
      displayName: "",
      bio: "",
      websiteUrl: "",
      visibility: "UNLISTED",
    });
  });

  it("passes through a known visibility value", () => {
    expect(toProfileFormValues(profile({ visibility: "UNLISTED" })).visibility).toBe("UNLISTED");
  });

  it("folds the stored PRIVATE default onto 不列出 (behaviourally identical)", () => {
    expect(toProfileFormValues(profile({ visibility: "PRIVATE" })).visibility).toBe("UNLISTED");
  });

  it("folds an unrecognised visibility onto the safe 不列出 side, never PUBLIC", () => {
    expect(toProfileFormValues(profile({ visibility: "WHATEVER" })).visibility).toBe("UNLISTED");
  });
});

describe("hasProfileChanges", () => {
  it("is false when nothing changed", () => {
    expect(hasProfileChanges(form(), form())).toBe(false);
  });

  it("ignores whitespace-only differences (the backend trims)", () => {
    expect(hasProfileChanges(form(), form({ displayName: "  测试昵称  " }))).toBe(false);
  });

  it("detects a real text change", () => {
    expect(hasProfileChanges(form(), form({ bio: "新简介" }))).toBe(true);
  });

  it("detects a visibility change", () => {
    expect(hasProfileChanges(form(), form({ visibility: "UNLISTED" }))).toBe(true);
  });
});

describe("findClearAttempts", () => {
  it("flags a field the user blanked out", () => {
    expect(findClearAttempts(form(), form({ bio: "" }))).toEqual(["bio"]);
  });

  it("flags whitespace-only as an attempt to clear", () => {
    expect(findClearAttempts(form(), form({ displayName: "   " }))).toEqual(["displayName"]);
  });

  it("reports every offending field", () => {
    expect(findClearAttempts(form(), form({ bio: "", websiteUrl: "" }))).toEqual([
      "bio",
      "websiteUrl",
    ]);
  });

  it("does NOT flag filling in an empty field (the supported direction)", () => {
    const baseline = form({ bio: "", websiteUrl: "" });
    const current = form({ bio: "补上了", websiteUrl: "https://example.com" });
    expect(findClearAttempts(baseline, current)).toEqual([]);
  });

  it("never flags visibility — an enum always holds a value", () => {
    expect(findClearAttempts(form(), form({ visibility: "UNLISTED" }))).toEqual([]);
  });
});

describe("buildProfilePatch", () => {
  it("always includes lockVersion so concurrent edits surface as 409", () => {
    const patch = buildProfilePatch(form(), form({ bio: "新" }), 7);
    expect(patch.lockVersion).toBe(7);
  });

  it("includes ONLY the changed keys", () => {
    const patch = buildProfilePatch(form(), form({ bio: "新简介" }), 1);
    expect(patch).toEqual({ lockVersion: 1, bio: "新简介" });
    expect("displayName" in patch).toBe(false);
    expect("websiteUrl" in patch).toBe(false);
    expect("visibility" in patch).toBe(false);
  });

  it("trims values before sending them", () => {
    expect(buildProfilePatch(form(), form({ displayName: "  昵称  " }), 1).displayName).toBe("昵称");
  });

  it("sends no field keys at all when nothing changed", () => {
    expect(buildProfilePatch(form(), form(), 4)).toEqual({ lockVersion: 4 });
  });

  it("sends visibility on its own when only that changed", () => {
    expect(buildProfilePatch(form(), form({ visibility: "UNLISTED" }), 2)).toEqual({
      lockVersion: 2,
      visibility: "UNLISTED",
    });
  });
});

describe("validateWebsiteUrlInput", () => {
  it("accepts blank (whether blank may be submitted is the clear-guard's job)", () => {
    expect(validateWebsiteUrlInput("")).toBeNull();
  });

  it("accepts http and https", () => {
    expect(validateWebsiteUrlInput("https://example.com")).toBeNull();
    expect(validateWebsiteUrlInput("http://example.com/a?b=1")).toBeNull();
  });

  it("rejects a non-http scheme with the backend's own wording", () => {
    expect(validateWebsiteUrlInput("ftp://example.com")).toBe("仅支持 http/https 链接");
  });

  it("rejects a scheme-less value", () => {
    expect(validateWebsiteUrlInput("example.com")).toBe("仅支持 http/https 链接");
  });

  it("rejects embedded whitespace (illegal in a URI)", () => {
    expect(validateWebsiteUrlInput("https://exa mple.com")).toBe("链接格式无效");
  });
});

/*
 * The visibility honesty guarantee.
 *
 * Live-verified 2026-09-22: the backend's `getPublicProfile` guards with
 * `if (visibility != Visibility.PRIVATE)`, which skips the AccessPolicy deny
 * branch for PRIVATE. So a PRIVATE profile is still served to strangers, and
 * scrubbing the echoed `visibility` string makes PRIVATE and UNLISTED
 * responses byte-identical (detail / works / followers / following).
 *
 * PRIVATE is also the registration default. Offering it as a third option
 * labelled "仅自己" would promise privacy the backend does not deliver, and
 * the choice would have no observable effect. These tests keep it out.
 */
describe("visibility options — no dead distinction, no false promise", () => {
  it("offers exactly the two behaviours that actually differ", () => {
    expect(VISIBILITY_OPTIONS.map((option) => option.value)).toEqual(["PUBLIC", "UNLISTED"]);
  });

  it("never exposes PRIVATE as a selectable option", () => {
    // Compare as strings: the type already forbids PRIVATE, so a plain === would
    // be a compile error. Widening to string keeps this a runtime guard against
    // someone re-adding the value later.
    expect(VISIBILITY_OPTIONS.map((option) => String(option.value))).not.toContain("PRIVATE");
  });

  it("promises nothing about privacy — PRIVATE was the only option that did", () => {
    const labels = VISIBILITY_OPTIONS.map((option) => `${option.label}${option.hint}`);
    for (const text of labels) {
      expect(text).not.toContain("仅自己");
      expect(text).not.toContain("仅我");
    }
  });

  it("describes the real, verified effect: search visibility", () => {
    const unlisted = VISIBILITY_OPTIONS.find((option) => option.value === "UNLISTED");
    expect(unlisted?.hint).toContain("搜索");
    // and is honest that a direct link still works
    expect(unlisted?.hint).toContain("链接");
  });
});

describe("toVisibilityChoice", () => {
  it("keeps PUBLIC public", () => {
    expect(toVisibilityChoice("PUBLIC")).toBe("PUBLIC");
  });

  it("folds PRIVATE onto UNLISTED (indistinguishable in practice)", () => {
    expect(toVisibilityChoice("PRIVATE")).toBe("UNLISTED");
  });

  it("folds null / undefined / junk onto the non-public side", () => {
    expect(toVisibilityChoice(null)).toBe("UNLISTED");
    expect(toVisibilityChoice(undefined)).toBe("UNLISTED");
    expect(toVisibilityChoice("WHATEVER")).toBe("UNLISTED");
  });

  it("is case-sensitive: only the exact PUBLIC string is public", () => {
    expect(toVisibilityChoice("public")).toBe("UNLISTED");
  });
});

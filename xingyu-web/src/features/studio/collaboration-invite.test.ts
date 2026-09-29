import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_BOUNDARY_NOTE,
  INVITE_NOTE_MAX_LENGTH,
  absoluteInviteUrl,
  acceptedHeadline,
  formatExpiry,
  inviteLifetimeHint,
  inviteProblem,
  inviterDisplayName,
  inviterSpaceHref,
  normalizeNote,
} from "./collaboration-invite";

describe("inviterDisplayName", () => {
  it("prefers the display name", () => {
    expect(inviterDisplayName({ inviterUsername: "alice", inviterDisplayName: "爱丽丝" })).toBe(
      "爱丽丝",
    );
  });

  it("falls back to the username", () => {
    expect(inviterDisplayName({ inviterUsername: "alice", inviterDisplayName: null })).toBe(
      "alice",
    );
  });

  it("falls back to a neutral phrase when both are absent", () => {
    // Map.of() throws on null, so either name can be MISSING, not just null.
    expect(inviterDisplayName({})).toBe("一位创作者");
  });

  it("treats whitespace as absent", () => {
    expect(inviterDisplayName({ inviterUsername: "  ", inviterDisplayName: "   " })).toBe(
      "一位创作者",
    );
  });
});

describe("inviteProblem", () => {
  it("passes a valid invite", () => {
    expect(inviteProblem({ valid: true, inviterUsername: "alice" })).toBeNull();
  });

  it("explains an invalid invite without calling it a network failure", () => {
    // {valid:false} arrives as HTTP 200 — a normal answer, not an error.
    const reason = inviteProblem({ valid: false });
    expect(reason).toContain("失效");
  });

  it("explains a missing invite", () => {
    expect(inviteProblem(null)).toBeTruthy();
  });
});

describe("absoluteInviteUrl", () => {
  it("prefixes a relative path with the origin", () => {
    expect(absoluteInviteUrl("/studio/collaboration/accept?token=abc", "https://x.test")).toBe(
      "https://x.test/studio/collaboration/accept?token=abc",
    );
  });

  it("does not double-prefix an already absolute url", () => {
    // Guards "https://x.testhttps://y.test/..." which is what a naive
    // concatenation produces.
    expect(absoluteInviteUrl("https://y.test/a", "https://x.test")).toBe("https://y.test/a");
  });

  it("handles an origin with a trailing slash", () => {
    expect(absoluteInviteUrl("/a", "https://x.test/")).toBe("https://x.test/a");
  });

  it("tolerates a path without a leading slash", () => {
    expect(absoluteInviteUrl("a/b", "https://x.test")).toBe("https://x.test/a/b");
  });

  it("returns empty for an empty path", () => {
    expect(absoluteInviteUrl("", "https://x.test")).toBe("");
  });
});

describe("formatExpiry", () => {
  it("formats a valid instant", () => {
    expect(formatExpiry("2026-10-05T00:00:00Z")).toMatch(/2026/);
  });

  it("returns null rather than Invalid Date", () => {
    expect(formatExpiry(null)).toBeNull();
    expect(formatExpiry(undefined)).toBeNull();
    expect(formatExpiry("nope")).toBeNull();
  });
});

describe("normalizeNote", () => {
  it("trims a real note", () => {
    expect(normalizeNote("  一起来  ")).toBe("一起来");
  });

  it("collapses a blank note to undefined", () => {
    expect(normalizeNote("   ")).toBeUndefined();
    expect(normalizeNote("")).toBeUndefined();
  });
});

describe("inviteLifetimeHint", () => {
  it("states the real 7-day lifetime", () => {
    expect(inviteLifetimeHint()).toContain("7 天");
  });
});

describe("the acceptance boundary disclosure", () => {
  it("exists and says no permission is granted", () => {
    expect(ACCEPTANCE_BOUNDARY_NOTE).toContain("不会因此获得任何协作权限");
  });

  it("is not phrased as a successful collaboration", () => {
    // Old wording implied membership; the new one must not.
    expect(ACCEPTANCE_BOUNDARY_NOTE).toContain("尚未实现");
  });
});

describe("acceptedHeadline", () => {
  it("names the inviter", () => {
    expect(acceptedHeadline({ accepted: true, inviterUsername: "alice" })).toBe(
      "已确认 alice 的邀请",
    );
  });

  it("says 已确认 rather than 已加入协作", () => {
    const headline = acceptedHeadline({ accepted: true, inviterUsername: "alice" });
    expect(headline).not.toContain("加入");
    expect(headline).toContain("确认");
  });

  it("degrades gracefully with no result", () => {
    expect(acceptedHeadline(null)).toBe("已确认邀请");
  });
});

describe("inviterSpaceHref", () => {
  it("targets /u/:username, which is the route that actually exists", () => {
    expect(inviterSpaceHref({ inviterUsername: "alice" })).toBe("/u/alice");
  });

  it("never produces Legacy's /u/:username/works dead link", () => {
    // V2 has no /works sub-route; /u/:username already shows 公开作品.
    expect(inviterSpaceHref({ inviterUsername: "alice" })).not.toContain("/works");
  });

  it("returns null when the username is unknown, so the caller hides the link", () => {
    expect(inviterSpaceHref({})).toBeNull();
    expect(inviterSpaceHref(null)).toBeNull();
    expect(inviterSpaceHref({ inviterUsername: "  " })).toBeNull();
  });

  it("encodes the username", () => {
    expect(inviterSpaceHref({ inviterUsername: "a b" })).toBe("/u/a%20b");
  });
});

describe("INVITE_NOTE_MAX_LENGTH", () => {
  it("matches the backend column width", () => {
    expect(INVITE_NOTE_MAX_LENGTH).toBe(512);
  });
});

import { describe, expect, it } from "vitest";
import type { Conversation } from "@/api/messages/messages.types";
import {
  MAX_GROUP_TITLE_LENGTH,
  canAdminister,
  filterGroups,
  groupHref,
  groupTitle,
  groupUpdatedLabel,
  joinModeNote,
  roleLabel,
  validateGroupTitle,
} from "./my-groups";

function conv(over: Partial<Conversation> = {}): Conversation {
  return { id: "c1", type: "GROUP", title: "前端交流", unreadCount: 0, ...over };
}

describe("filterGroups", () => {
  it("keeps GROUP rows and drops DIRECT ones, preserving server order", () => {
    const list = [
      conv({ id: "g1", type: "GROUP", title: "G1" }),
      conv({ id: "d1", type: "DIRECT", title: null }),
      conv({ id: "g2", type: "GROUP", title: "G2" }),
    ];
    expect(filterGroups(list).map((c) => c.id)).toEqual(["g1", "g2"]);
  });

  it("returns [] for an all-DIRECT mailbox", () => {
    expect(filterGroups([conv({ id: "d1", type: "DIRECT" })])).toEqual([]);
  });

  it("returns [] for an empty list", () => {
    expect(filterGroups([])).toEqual([]);
  });
});

describe("groupTitle", () => {
  it("uses the title when present", () => {
    expect(groupTitle(conv({ title: "前端交流" }))).toBe("前端交流");
  });

  it("falls back to 「未命名群聊」 when the title is null", () => {
    expect(groupTitle(conv({ title: null }))).toBe("未命名群聊");
  });

  it("falls back when the title is whitespace-only (never renders a blank row)", () => {
    expect(groupTitle(conv({ title: "   " }))).toBe("未命名群聊");
  });
});

describe("canAdminister", () => {
  it("is true for OWNER and ADMIN", () => {
    expect(canAdminister(conv({ myRole: "OWNER" }))).toBe(true);
    expect(canAdminister(conv({ myRole: "ADMIN" }))).toBe(true);
  });

  it("is false for MEMBER — matching the backend's requireOwnerOrAdmin", () => {
    expect(canAdminister(conv({ myRole: "MEMBER" }))).toBe(false);
  });

  it("is false for a missing or unknown role", () => {
    expect(canAdminister(conv({ myRole: null }))).toBe(false);
    expect(canAdminister(conv({ myRole: undefined }))).toBe(false);
    expect(canAdminister(conv({ myRole: "SUPERUSER" }))).toBe(false);
  });
});

describe("roleLabel", () => {
  it("maps the three known roles", () => {
    expect(roleLabel("OWNER")).toBe("群主");
    expect(roleLabel("ADMIN")).toBe("管理员");
    expect(roleLabel("MEMBER")).toBe("成员");
  });

  it("returns null for null/undefined rather than inventing a role", () => {
    expect(roleLabel(null)).toBeNull();
    expect(roleLabel(undefined)).toBeNull();
  });

  it("echoes an UNKNOWN role verbatim (containment, not a guessed label)", () => {
    expect(roleLabel("MODERATOR")).toBe("MODERATOR");
  });
});

describe("joinModeNote", () => {
  it("maps both known modes", () => {
    expect(joinModeNote("OPEN")).toBe("开放加入");
    expect(joinModeNote("APPROVAL")).toBe("需审批加入");
  });

  it("returns null when absent", () => {
    expect(joinModeNote(null)).toBeNull();
    expect(joinModeNote(undefined)).toBeNull();
  });

  it("echoes an unknown mode verbatim", () => {
    expect(joinModeNote("INVITE_ONLY")).toBe("INVITE_ONLY");
  });
});

describe("validateGroupTitle", () => {
  it("accepts and trims a normal title", () => {
    expect(validateGroupTitle("  前端交流  ")).toEqual({ ok: true, title: "前端交流" });
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(validateGroupTitle("").ok).toBe(false);
    const result = validateGroupTitle("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("empty");
      expect(result.message).toContain("请输入");
    }
  });

  it("rejects a title past the front-end cap and names the limit", () => {
    const result = validateGroupTitle("x".repeat(MAX_GROUP_TITLE_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_long");
      expect(result.message).toContain(String(MAX_GROUP_TITLE_LENGTH));
    }
  });

  it("accepts a title exactly at the cap", () => {
    expect(validateGroupTitle("x".repeat(MAX_GROUP_TITLE_LENGTH)).ok).toBe(true);
  });
});

describe("groupHref", () => {
  it("points at the SHARED /messages/:id route (no /group/ segment)", () => {
    expect(groupHref(conv({ id: "abc" }))).toBe("/messages/abc");
  });

  it("encodes the id", () => {
    expect(groupHref(conv({ id: "a/b c" }))).toBe("/messages/a%2Fb%20c");
  });

  it("never produces Legacy's unrouted /messages/group/{id} shape", () => {
    expect(groupHref(conv({ id: "x" }))).not.toContain("/messages/group/");
  });
});

describe("groupUpdatedLabel", () => {
  it("returns null for a missing value (a brand-new group has no updatedAt)", () => {
    expect(groupUpdatedLabel(null)).toBeNull();
    expect(groupUpdatedLabel(undefined)).toBeNull();
    expect(groupUpdatedLabel("")).toBeNull();
  });

  it("returns the raw string for an unparseable value rather than 'Invalid Date'", () => {
    expect(groupUpdatedLabel("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO timestamp", () => {
    const label = groupUpdatedLabel("2026-09-28T10:00:00Z");
    expect(label).toBeTruthy();
    expect(label).not.toBe("Invalid Date");
  });
});

import { describe, expect, it } from "vitest";
import {
  countUnread,
  countUnreadByBucket,
  notificationBucket,
  notificationCategoryLabel,
  notificationFallbackHref,
  toNotifications,
  type Notification,
} from "./notifications.types";

function makeItem(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    category: "FOLLOW",
    title: "标题",
    read: false,
    ...overrides,
  };
}

describe("notificationBucket", () => {
  it("puts interactions in the social bucket", () => {
    for (const category of ["LIKE", "REACTION", "COMMENT", "REPLY", "FOLLOW", "MENTION"]) {
      expect(notificationBucket(category)).toBe("social");
    }
  });

  it("puts system announcements in the system bucket", () => {
    expect(notificationBucket("SYSTEM")).toBe("system");
    expect(notificationBucket("ANNOUNCE")).toBe("system");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(notificationBucket("follow")).toBe("social");
    expect(notificationBucket("  announce ")).toBe("system");
  });

  it("defaults an unknown category to social instead of throwing", () => {
    // A future backend producer must not blank the list.
    expect(notificationBucket("SOMETHING_NEW")).toBe("social");
    expect(notificationBucket("")).toBe("social");
    expect(notificationBucket(null)).toBe("social");
    expect(notificationBucket(undefined)).toBe("social");
  });
});

describe("notificationCategoryLabel", () => {
  it("maps the known families", () => {
    expect(notificationCategoryLabel("LIKE")).toBe("点赞");
    expect(notificationCategoryLabel("REACTION")).toBe("点赞");
    expect(notificationCategoryLabel("COMMENT")).toBe("评论");
    expect(notificationCategoryLabel("REPLY")).toBe("评论");
    expect(notificationCategoryLabel("FOLLOW")).toBe("关注");
    expect(notificationCategoryLabel("MENTION")).toBe("提及");
    expect(notificationCategoryLabel("SYSTEM")).toBe("系统");
    expect(notificationCategoryLabel("ANNOUNCE")).toBe("公告");
  });

  it("echoes an unknown category rather than mislabelling it", () => {
    // Showing the raw value beats showing the wrong word.
    expect(notificationCategoryLabel("MENTION_V2")).toBe("MENTION_V2");
    expect(notificationCategoryLabel("weird")).toBe("WEIRD");
  });

  it("returns an empty string for a missing category", () => {
    expect(notificationCategoryLabel(null)).toBe("");
    expect(notificationCategoryLabel(undefined)).toBe("");
  });
});

describe("countUnread / countUnreadByBucket", () => {
  const items: Notification[] = [
    makeItem({ id: "1", category: "FOLLOW", read: false }),
    makeItem({ id: "2", category: "LIKE", read: true }),
    makeItem({ id: "3", category: "ANNOUNCE", read: false }),
    makeItem({ id: "4", category: "UNKNOWN_FUTURE", read: false }),
  ];

  it("counts only unread rows", () => {
    expect(countUnread(items)).toBe(3);
    expect(countUnread([])).toBe(0);
    expect(countUnread([makeItem({ read: true })])).toBe(0);
  });

  it("splits unread counts across the tabs", () => {
    expect(countUnreadByBucket(items)).toEqual({ all: 3, social: 2, system: 1 });
  });

  it("keeps `all` equal to the sum of the buckets even for unknown categories", () => {
    // The unknown row falls into "social", so all === social + system holds.
    const counts = countUnreadByBucket(items);
    expect(counts.all).toBe(counts.social + counts.system);
  });
});

describe("notificationFallbackHref", () => {
  it("sends a follow notification to the followers list", () => {
    expect(notificationFallbackHref("FOLLOW")).toBe("/me/followers");
  });

  it("sends an announcement notification to the announcement centre", () => {
    expect(notificationFallbackHref("ANNOUNCE")).toBe("/announcements");
  });

  it("returns null when there is no safe destination", () => {
    // No `targetRoute` exists in the payload, so returning null is the honest
    // answer — the row renders as text instead of a dead link.
    expect(notificationFallbackHref("LIKE")).toBeNull();
    expect(notificationFallbackHref("COMMENT")).toBeNull();
    expect(notificationFallbackHref("UNKNOWN_FUTURE")).toBeNull();
    expect(notificationFallbackHref(null)).toBeNull();
  });
});

describe("toNotifications", () => {
  it("passes a bare array through", () => {
    const rows = [makeItem()];
    expect(toNotifications(rows)).toBe(rows);
  });

  it("still unwraps an envelope if the backend ever adds one", () => {
    // Defensive in the opposite direction from toFollowUsers, which expects one.
    const rows = [makeItem()];
    expect(toNotifications({ items: rows } as unknown as Notification[])).toEqual(rows);
  });

  it("treats null / undefined / malformed input as empty rather than throwing", () => {
    expect(toNotifications(null)).toEqual([]);
    expect(toNotifications(undefined)).toEqual([]);
    expect(toNotifications({ items: "nope" } as unknown as Notification[])).toEqual([]);
  });
});

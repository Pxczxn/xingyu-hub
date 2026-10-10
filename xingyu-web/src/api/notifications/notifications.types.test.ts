import { describe, expect, it } from "vitest";
import {
  countUnread,
  notificationHref,
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

describe("notificationHref", () => {
  it("sends a follow notification to the ACTOR's canonical profile", () => {
    expect(
      notificationHref({
        category: "FOLLOW",
        actor: { userId: "u1", username: "alice", displayName: null },
      }),
    ).toBe("/u/alice");
  });

  it("percent-encodes the username instead of pasting it raw into the path", () => {
    expect(
      notificationHref({
        category: "FOLLOW",
        actor: { userId: "u1", username: "a b/c", displayName: null },
      }),
    ).toBe("/u/a%20b%2Fc");
  });

  it("returns null when the actor has no resolvable username", () => {
    // 有 actor 但 profile 查不到：宁可不可点，也不要给出 /u/null。
    expect(
      notificationHref({
        category: "FOLLOW",
        actor: { userId: "u1", username: null, displayName: "X" },
      }),
    ).toBeNull();
    expect(
      notificationHref({
        category: "FOLLOW",
        actor: { userId: "u1", username: "   ", displayName: null },
      }),
    ).toBeNull();
  });

  it("returns null when there is no actor at all", () => {
    expect(notificationHref({ category: "FOLLOW", actor: null })).toBeNull();
    expect(notificationHref({ category: "FOLLOW" })).toBeNull();
  });

  it("keeps the announcement list as the destination for ANNOUNCE", () => {
    expect(notificationHref({ category: "ANNOUNCE", actor: null })).toBe("/announcements");
  });

  it("ignores a category that has no real destination", () => {
    // LIKE / COMMENT / REPLY / SYSTEM 都还没有 producer，不该凭空给一个链接。
    for (const category of ["LIKE", "COMMENT", "REPLY", "SYSTEM", "SOMETHING_NEW"]) {
      expect(notificationHref({ category, actor: null })).toBeNull();
    }
  });

  it("prefers the actor over the category when both exist", () => {
    expect(
      notificationHref({
        category: "ANNOUNCE",
        actor: { userId: "u1", username: "alice", displayName: null },
      }),
    ).toBe("/u/alice");
  });
});

describe("countUnread", () => {
  it("counts only unread rows", () => {
    const items: Notification[] = [
      makeItem({ id: "1", read: false }),
      makeItem({ id: "2", read: true }),
      makeItem({ id: "3", read: false }),
      makeItem({ id: "4", read: true }),
    ];
    expect(countUnread(items)).toBe(2);
  });

  it("is 0 for an empty list", () => {
    expect(countUnread([])).toBe(0);
    expect(countUnread([makeItem({ read: true })])).toBe(0);
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

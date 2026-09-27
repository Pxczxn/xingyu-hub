import { describe, expect, it } from "vitest";
import {
  conversationLabel,
  countUnreadConversations,
  isRecalled,
  mergeMessages,
  sortBySequence,
  toConversations,
  toMessages,
  type ChatMessage,
  type Conversation,
} from "./messages.types";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    type: "DIRECT",
    title: "爱丽丝",
    unreadCount: 0,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    senderId: "u1",
    sequenceNumber: 1,
    body: "hi",
    messageType: "TEXT",
    ...overrides,
  };
}

describe("toConversations", () => {
  it("passes a bare array through (the real shape of GET /messages)", () => {
    const rows = [makeConversation()];
    expect(toConversations(rows)).toBe(rows);
  });

  it("still unwraps an envelope defensively", () => {
    const rows = [makeConversation()];
    expect(toConversations({ items: rows } as unknown as Conversation[])).toEqual(rows);
  });

  it("treats null / undefined / malformed input as empty", () => {
    expect(toConversations(null)).toEqual([]);
    expect(toConversations(undefined)).toEqual([]);
    expect(toConversations({ items: "nope" } as unknown as Conversation[])).toEqual([]);
  });
});

describe("toMessages", () => {
  it("unwraps the PageResult (the real shape of the message page)", () => {
    const rows = [makeMessage()];
    expect(toMessages({ items: rows, nextCursor: "1", total: 1 })).toEqual(rows);
  });

  it("tolerates a bare array too", () => {
    const rows = [makeMessage()];
    expect(toMessages(rows)).toBe(rows);
  });

  it("treats null / undefined / malformed input as empty", () => {
    expect(toMessages(null)).toEqual([]);
    expect(toMessages(undefined)).toEqual([]);
    expect(toMessages({ items: 7 } as unknown as ChatMessage[])).toEqual([]);
  });
});

describe("countUnreadConversations", () => {
  it("sums the per-conversation unread counts", () => {
    // There is no mailbox-wide unread endpoint; this sum is the only total.
    const rows = [
      makeConversation({ id: "c1", unreadCount: 3 }),
      makeConversation({ id: "c2", unreadCount: 0 }),
      makeConversation({ id: "c3", unreadCount: 2 }),
    ];
    expect(countUnreadConversations(rows)).toBe(5);
  });

  it("returns 0 for an empty mailbox", () => {
    expect(countUnreadConversations([])).toBe(0);
  });

  it("treats a missing unreadCount as 0 instead of NaN", () => {
    expect(countUnreadConversations([{ ...makeConversation(), unreadCount: undefined as unknown as number }])).toBe(0);
  });
});

describe("isRecalled", () => {
  it("is true only when recalledAt is set", () => {
    expect(isRecalled(makeMessage({ recalledAt: "2026-09-27T00:00:00Z" }))).toBe(true);
    expect(isRecalled(makeMessage({ recalledAt: null }))).toBe(false);
    expect(isRecalled(makeMessage())).toBe(false);
  });

  it("still counts a recalled message as recalled when its body was blanked", () => {
    // The backend rewrites body to 「[消息已撤回]」 and nulls attachments; the
    // tombstone is driven by recalledAt, never by sniffing the body text.
    const recalled = makeMessage({ body: "[消息已撤回]", recalledAt: "2026-09-27T00:00:00Z" });
    expect(isRecalled(recalled)).toBe(true);
  });
});

describe("conversationLabel", () => {
  it("uses the server title when present", () => {
    expect(conversationLabel(makeConversation({ title: "读书会" }))).toBe("读书会");
  });

  it("falls back per type when the title is blank", () => {
    // The backend can emit a blank DIRECT title when no profile/username resolves.
    expect(conversationLabel(makeConversation({ title: "" }))).toBe("私信");
    expect(conversationLabel(makeConversation({ type: "GROUP", title: "  " }))).toBe("未命名群聊");
  });
});

describe("sortBySequence / mergeMessages", () => {
  it("orders ascending by sequenceNumber", () => {
    const list = [makeMessage({ id: "b", sequenceNumber: 3 }), makeMessage({ id: "a", sequenceNumber: 1 })];
    expect(sortBySequence(list).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("prepends older history and keeps ascending order", () => {
    const current = [makeMessage({ id: "m3", sequenceNumber: 3 }), makeMessage({ id: "m4", sequenceNumber: 4 })];
    const older = [makeMessage({ id: "m1", sequenceNumber: 1 }), makeMessage({ id: "m2", sequenceNumber: 2 })];
    expect(mergeMessages(current, older).map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("de-duplicates by id at a page boundary instead of duplicating a row", () => {
    // nextCursor is the oldest loaded sequence, so pages can legitimately overlap.
    const current = [makeMessage({ id: "m2", sequenceNumber: 2, body: "old" })];
    const incoming = [makeMessage({ id: "m2", sequenceNumber: 2, body: "new" })];
    const merged = mergeMessages(current, incoming);
    expect(merged).toHaveLength(1);
    // The incoming copy wins, so an edited/recalled row refreshes.
    expect(merged[0].body).toBe("new");
  });

  it("does not mutate its inputs", () => {
    const current = [makeMessage({ id: "m2", sequenceNumber: 2 })];
    const older = [makeMessage({ id: "m1", sequenceNumber: 1 })];
    mergeMessages(current, older);
    expect(current.map((m) => m.id)).toEqual(["m2"]);
    expect(older.map((m) => m.id)).toEqual(["m1"]);
  });
});

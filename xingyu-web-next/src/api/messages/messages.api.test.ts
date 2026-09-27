import { beforeEach, describe, expect, it, vi } from "vitest";
import { messagesApi } from "./messages.api";
import { apiRequest } from "@/api/client";

vi.mock("@/api/client", () => ({
  apiRequest: vi.fn(),
}));

const mocked = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("messagesApi.listConversations", () => {
  it("reads a BARE ARRAY, like the notification list and unlike the message page", async () => {
    const rows = [{ id: "c1", type: "DIRECT", title: "爱丽丝", unreadCount: 2 }];
    mocked.mockResolvedValue(rows);
    await expect(messagesApi.listConversations()).resolves.toEqual(rows);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages");
  });

  it("returns an empty array rather than undefined for an empty mailbox", async () => {
    mocked.mockResolvedValue([]);
    await expect(messagesApi.listConversations()).resolves.toEqual([]);
  });

  it("never issues a write", () => {
    expect(mocked.mock.calls).toHaveLength(0);
  });
});

describe("messagesApi direct reads", () => {
  it("reads a direct conversation by conversationId", async () => {
    mocked.mockResolvedValue({ id: "c1", type: "DIRECT", title: "爱丽丝", unreadCount: 0 });
    await messagesApi.getDirect("c1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/direct/c1");
  });

  it("encodes the conversationId", async () => {
    mocked.mockResolvedValue({ id: "a/b", type: "DIRECT", title: "t", unreadCount: 0 });
    await messagesApi.getDirect("a/b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/direct/a%2Fb");
  });
});

describe("messagesApi.openDirect", () => {
  it("POSTs to the same path prefix to create/open a conversation", async () => {
    // The same prefix serves both "read conversation" (GET) and "open with user"
    // (POST) — the difference is the method, so this test pins the method.
    mocked.mockResolvedValue({ id: "c9", type: "DIRECT", title: "鲍勃", unreadCount: 0 });
    await messagesApi.openDirect("u2");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/direct/u2", { method: "POST" });
  });

  it("encodes a username with characters that need it", async () => {
    mocked.mockResolvedValue({ id: "c9", type: "DIRECT", title: "t", unreadCount: 0 });
    await messagesApi.openDirect("a b");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/direct/a%20b", { method: "POST" });
  });
});

describe("messagesApi group reads and sends", () => {
  it("reads a group conversation", async () => {
    mocked.mockResolvedValue({ id: "g1", type: "GROUP", title: "读书会", unreadCount: 0 });
    await messagesApi.getGroup("g1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/group/g1");
  });

  it("sends into a direct conversation with the payload as the body", async () => {
    mocked.mockResolvedValue({ id: "m1", sequenceNumber: 1, body: "hi", messageType: "TEXT" });
    await messagesApi.sendDirect("c1", { body: "hi", clientMessageId: "k1" });
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/direct/c1/messages", {
      method: "POST",
      body: { body: "hi", clientMessageId: "k1" },
    });
  });

  it("sends into a group conversation", async () => {
    mocked.mockResolvedValue({ id: "m2", sequenceNumber: 2, body: "yo", messageType: "TEXT" });
    await messagesApi.sendGroup("g1", { body: "yo" });
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/group/g1/messages", {
      method: "POST",
      body: { body: "yo" },
    });
  });
});

describe("messagesApi.listMessages", () => {
  it("unwraps the PageResult and reports the next cursor", async () => {
    mocked.mockResolvedValue({
      items: [{ id: "m1", sequenceNumber: 5, body: "a" }],
      nextCursor: "5",
      total: 1,
    });

    const page = await messagesApi.listMessages("c1");

    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/messages?limit=50");
    expect(page.messages).toEqual([{ id: "m1", sequenceNumber: 5, body: "a" }]);
    expect(page.nextCursor).toBe("5");
  });

  it("passes an explicit cursor and limit", async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    await messagesApi.listMessages("c1", { cursor: "42", limit: 20 });
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/messages?limit=20&cursor=42");
  });

  it("reports a null cursor when the page is exhausted", async () => {
    mocked.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    const page = await messagesApi.listMessages("c1");
    expect(page.nextCursor).toBeNull();
  });

  it("tolerates a bare array instead of a PageResult", async () => {
    mocked.mockResolvedValue([{ id: "m1", sequenceNumber: 1, body: "a" }]);
    const page = await messagesApi.listMessages("c1");
    expect(page.messages).toHaveLength(1);
  });
});

describe("messagesApi.markRead", () => {
  it("PATCHes with no body to mark the whole conversation read", async () => {
    mocked.mockResolvedValue(undefined);
    await messagesApi.markRead("c1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/read", {
      method: "PATCH",
      body: undefined,
    });
  });

  it("sends the sequence number as a STRING when given one", async () => {
    // The controller reads it out of a Map<String,String>, so it must be a string.
    mocked.mockResolvedValue(undefined);
    await messagesApi.markRead("c1", 17);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/read", {
      method: "PATCH",
      body: { sequenceNumber: "17" },
    });
  });
});

describe("messagesApi.recallMessage", () => {
  it("POSTs to the recall sub-resource", async () => {
    mocked.mockResolvedValue({ id: "m1", recalledAt: "2026-09-27T00:00:00Z" });
    await messagesApi.recallMessage("c1", "m1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/messages/m1/recall", {
      method: "POST",
    });
  });

  it("encodes both ids", async () => {
    mocked.mockResolvedValue({ id: "a/b", recalledAt: "x" });
    await messagesApi.recallMessage("a/b", "m/1");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/a%2Fb/messages/m%2F1/recall", {
      method: "POST",
    });
  });
});

describe("messagesApi surface", () => {
  it("exposes exactly the send/receive core, with group admin absent", () => {
    // Guards against group administration (members/announcement/join-requests)
    // or the search/saved-message reads creeping in before 2I-3b.
    expect(Object.keys(messagesApi)).toEqual([
      "listConversations",
      "getDirect",
      "openDirect",
      "getGroup",
      "sendDirect",
      "sendGroup",
      "listMessages",
      "markRead",
      "recallMessage",
    ]);
  });
});

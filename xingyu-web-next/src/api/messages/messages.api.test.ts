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
  it("exposes the send/receive core plus attachments, search, join requests and group creation", () => {
    // 2I-3b added upload wiring, /media, /files and /search. Phase 3C added
    // `listMyGroupJoinRequests` — the APPLICANT's own view. Phase 3E added
    // `createGroup` — `POST /messages/group`, which the "我的群聊" page needs.
    //
    // Still deliberately absent (the boundary this assertion keeps):
    //   - group ADMINISTRATION beyond creation: members / announcement /
    //     join-request approve+reject / leave / remove-member. `createGroup` is
    //     NOT that — it only mints a group and seats the caller as OWNER.
    //     `listMyGroupJoinRequests` is also not that: it reads
    //     `/me/group-join-requests` (who I asked), while the admin queue is
    //     `/messages/group/{id}/join-requests` (who asked me).
    //   - `/me/saved-messages`.
    expect(Object.keys(messagesApi)).toEqual([
      "listConversations",
      "getDirect",
      "openDirect",
      "getGroup",
      "createGroup",
      "sendDirect",
      "sendGroup",
      "listMessages",
      "markRead",
      "recallMessage",
      "sendAttachment",
      "listMedia",
      "listFiles",
      "search",
      "listMyGroupJoinRequests",
    ]);
  });

  it("still has no group-admin writes beyond creation", () => {
    // Guards the distinction the previous test explains: approving/rejecting and
    // the other owner capabilities must not sneak in alongside creation.
    const keys = Object.keys(messagesApi);
    for (const admin of [
      "approveJoinRequest",
      "rejectJoinRequest",
      "leaveGroup",
      "removeMember",
      "updateGroupSettings",
      "updateGroupAnnouncement",
      "listGroupMembers",
    ]) {
      expect(keys).not.toContain(admin);
    }
  });
});

describe("messagesApi.createGroup", () => {
  it("POSTs ONLY the title to /api/v1/messages/group", async () => {
    mocked.mockResolvedValue({ id: "g1", type: "GROUP", title: "前端交流", unreadCount: 0 });
    await messagesApi.createGroup("前端交流");

    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/group", {
      method: "POST",
      // The service reads ONLY `title`; sending more would imply capability the
      // endpoint does not have (there is no invitee list).
      body: { title: "前端交流" },
    });
  });

  it("returns the created ConversationView unchanged", async () => {
    mocked.mockResolvedValue({ id: "g9", type: "GROUP", title: "新群", unreadCount: 0 });
    const created = await messagesApi.createGroup("新群");
    expect(created.id).toBe("g9");
    expect(created.type).toBe("GROUP");
  });

  it("propagates the server's 400 on a blank title", async () => {
    mocked.mockRejectedValue(new Error("title: 群聊标题不能为空"));
    await expect(messagesApi.createGroup("   ")).rejects.toThrow("群聊标题不能为空");
  });
});

describe("messagesApi.sendAttachment", () => {
  it("sends into a DIRECT conversation with the uploaded url and declared type", async () => {
    mocked.mockResolvedValue({ id: "m1" });
    await messagesApi.sendAttachment("c1", "DIRECT", {
      url: "/api/v1/admin/files/community/messages/a.png",
      name: "照片.png",
      messageType: "IMAGE",
    });

    expect(mocked).toHaveBeenCalledWith(
      "/api/v1/messages/direct/c1/messages",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          type: "IMAGE",
          attachmentUrl: "/api/v1/admin/files/community/messages/a.png",
          attachmentName: "照片.png",
        }),
      }),
    );
  });

  it("sends into a GROUP conversation when the conversation is a group", async () => {
    mocked.mockResolvedValue({ id: "m1" });
    await messagesApi.sendAttachment("c9", "GROUP", {
      url: "/x.pdf",
      name: "报告.pdf",
      messageType: "FILE",
    });

    expect(mocked).toHaveBeenCalledWith(
      "/api/v1/messages/group/c9/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("attaches an idempotency key so a retry cannot double-post", async () => {
    mocked.mockResolvedValue({ id: "m1" });
    await messagesApi.sendAttachment("c1", "DIRECT", {
      url: "/x.png",
      name: "a.png",
      messageType: "IMAGE",
    });

    const body = mocked.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(typeof body.clientMessageId).toBe("string");
    expect(String(body.clientMessageId).length).toBeGreaterThan(0);
  });

  it("does not put the url in the body — the backend renders from attachmentUrl", async () => {
    mocked.mockResolvedValue({ id: "m1" });
    await messagesApi.sendAttachment("c1", "DIRECT", {
      url: "/x.png",
      name: "a.png",
      messageType: "IMAGE",
    });

    const body = mocked.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.body).toBeUndefined();
  });
});

describe("messagesApi.listMedia / listFiles", () => {
  it("reads media as a BARE ARRAY, not a page", async () => {
    const rows = [{ id: "m1", messageType: "IMAGE" }];
    mocked.mockResolvedValue(rows);
    await expect(messagesApi.listMedia("c1")).resolves.toEqual(rows);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/media?limit=50");
  });

  it("reads files as a BARE ARRAY, with the same default cap", async () => {
    mocked.mockResolvedValue([]);
    await expect(messagesApi.listFiles("c1")).resolves.toEqual([]);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/files?limit=50");
  });

  it("passes an explicit limit through", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.listMedia("c1", 100);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/c1/media?limit=100");
  });

  it("encodes the conversation id in both", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.listMedia("a/b");
    await messagesApi.listFiles("a/b");
    expect(mocked).toHaveBeenNthCalledWith(1, "/api/v1/messages/a%2Fb/media?limit=50");
    expect(mocked).toHaveBeenNthCalledWith(2, "/api/v1/messages/a%2Fb/files?limit=50");
  });

  it("tolerates an envelope instead of a bare array", async () => {
    mocked.mockResolvedValue({ items: [{ id: "m1" }] });
    await expect(messagesApi.listMedia("c1")).resolves.toEqual([{ id: "m1" }]);
  });
});

describe("messagesApi.search", () => {
  it("reads results as a BARE ARRAY and passes the query", async () => {
    const rows = [{ id: "m1", conversationType: "GROUP" }];
    mocked.mockResolvedValue(rows);
    await expect(messagesApi.search("你好")).resolves.toEqual(rows);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/search?q=%E4%BD%A0%E5%A5%BD&limit=50");
  });

  it("encodes a query with reserved characters", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.search("a&b=c");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/search?q=a%26b%3Dc&limit=50");
  });

  it("still calls the endpoint for a blank query — the server decides, not us", async () => {
    // The service short-circuits a blank query to []. Suppressing the call here
    // would hide that contract and make the page's "no query" state ambiguous.
    mocked.mockResolvedValue([]);
    await messagesApi.search("   ");
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/search?q=+++&limit=50");
  });

  it("passes an explicit limit through", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.search("x", 10);
    expect(mocked).toHaveBeenCalledWith("/api/v1/messages/search?q=x&limit=10");
  });
});

describe("messagesApi.listMyGroupJoinRequests", () => {
  it("reads the caller's OWN requests from /me, as a bare array", async () => {
    const rows = [
      {
        id: "r1",
        conversationId: "g1",
        conversationTitle: "读书会",
        joinMode: "APPROVAL",
        message: "想加入",
        status: "PENDING",
        createdAt: "2026-09-01T10:00:00Z",
        resolvedAt: null,
      },
    ];
    mocked.mockResolvedValue(rows);
    await expect(messagesApi.listMyGroupJoinRequests()).resolves.toEqual(rows);
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/group-join-requests?limit=20");
  });

  it("passes an explicit limit through", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.listMyGroupJoinRequests(50);
    expect(mocked).toHaveBeenCalledWith("/api/v1/me/group-join-requests?limit=50");
  });

  it("hits /me/group-join-requests, NOT the owner-side /messages/group/{id} queue", async () => {
    // Two different audiences: the applicant's own view vs the owner's
    // approve/reject queue. The latter is deliberately out of scope.
    mocked.mockResolvedValue([]);
    await messagesApi.listMyGroupJoinRequests();
    const [url] = mocked.mock.calls[0] as [string];
    expect(url).toContain("/me/group-join-requests");
    expect(url).not.toContain("/messages/group/");
  });

  it("issues a GET — no method override", async () => {
    mocked.mockResolvedValue([]);
    await messagesApi.listMyGroupJoinRequests();
    const [, options] = mocked.mock.calls[0] as [string, unknown];
    expect(options).toBeUndefined();
  });

  it("returns the applicant-shaped row unchanged (title + resolvedAt survive)", async () => {
    // The MyGroupJoinRequestView fields. If someone swaps in the owner-side
    // GroupJoinRequestView, these two would be undefined.
    mocked.mockResolvedValue([
      {
        id: "r1",
        conversationId: "g1",
        conversationTitle: "读书会",
        status: "APPROVED",
        createdAt: "2026-09-01T10:00:00Z",
        resolvedAt: "2026-09-02T10:00:00Z",
      },
    ]);
    const [row] = await messagesApi.listMyGroupJoinRequests();
    expect(row.conversationTitle).toBe("读书会");
    expect(row.resolvedAt).toBe("2026-09-02T10:00:00Z");
  });
});

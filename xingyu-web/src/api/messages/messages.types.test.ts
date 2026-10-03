import { describe, expect, it } from "vitest";
import {
  MESSAGE_ATTACHMENT_MAX_BYTES,
  attachmentMessageType,
  conversationLabel,
  countUnreadConversations,
  isRecalled,
  mergeMessages,
  sortBySequence,
  toConversations,
  toMessages,
  validateMessageAttachment,
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
    expect(
      countUnreadConversations([
        { ...makeConversation(), unreadCount: undefined as unknown as number },
      ]),
    ).toBe(0);
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

  /*
   * Added 2026-10-03 with the backend's `counterpartDisplayName`. Before it,
   * every direct surface printed 「私信」 — and on the thread screen that was also
   * the page heading, so the reader saw the same word twice and never learned
   * who they were talking to.
   */
  it("prefers the counterpart name for a DIRECT conversation", () => {
    expect(
      conversationLabel(
        makeConversation({ type: "DIRECT", title: null, counterpartDisplayName: "爱丽丝" }),
      ),
    ).toBe("爱丽丝");
  });

  it("still prefers a real title over the counterpart name", () => {
    // A titled conversation keeps its title; the counterpart field is a fallback,
    // not an override.
    expect(
      conversationLabel(
        makeConversation({ type: "DIRECT", title: "读书会", counterpartDisplayName: "爱丽丝" }),
      ),
    ).toBe("读书会");
  });

  it("ignores a blank counterpart name", () => {
    expect(
      conversationLabel(
        makeConversation({ type: "DIRECT", title: null, counterpartDisplayName: "  " }),
      ),
    ).toBe("私信");
  });

  it("tolerates a backend that has not shipped the field yet", () => {
    // Additive field: the frontend must be deployable ahead of the server.
    expect(conversationLabel(makeConversation({ type: "DIRECT", title: null }))).toBe("私信");
  });
});

describe("sortBySequence / mergeMessages", () => {
  it("orders ascending by sequenceNumber", () => {
    const list = [
      makeMessage({ id: "b", sequenceNumber: 3 }),
      makeMessage({ id: "a", sequenceNumber: 1 }),
    ];
    expect(sortBySequence(list).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("prepends older history and keeps ascending order", () => {
    const current = [
      makeMessage({ id: "m3", sequenceNumber: 3 }),
      makeMessage({ id: "m4", sequenceNumber: 4 }),
    ];
    const older = [
      makeMessage({ id: "m1", sequenceNumber: 1 }),
      makeMessage({ id: "m2", sequenceNumber: 2 }),
    ];
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

/*
 * Attachment rules (Phase 2I-3b). Every accepted extension and every limit here
 * mirrors `CommunityMessageController.COMMUNITY_ATTACHMENT_EXTENSIONS` and
 * `sys_config_group.storage.maxSize`, not a guess.
 */
describe("attachmentMessageType", () => {
  it("classifies the whitelisted images as IMAGE", () => {
    for (const name of ["a.png", "a.jpg", "a.jpeg", "a.gif", "a.webp"]) {
      expect(attachmentMessageType(name)).toBe("IMAGE");
    }
  });

  it("classifies every other whitelisted extension as FILE", () => {
    for (const name of [
      "a.pdf",
      "a.doc",
      "a.docx",
      "a.xls",
      "a.xlsx",
      "a.ppt",
      "a.pptx",
      "a.txt",
      "a.md",
      "a.csv",
      "a.zip",
    ]) {
      expect(attachmentMessageType(name)).toBe("FILE");
    }
  });

  it("is case-insensitive, because the backend lower-cases before comparing", () => {
    expect(attachmentMessageType("PHOTO.PNG")).toBe("IMAGE");
    expect(attachmentMessageType("Report.PDF")).toBe("FILE");
  });

  it("returns null for a type the backend would reject", () => {
    // SVG is a real trap: it is a plausible image the whitelist does NOT accept.
    for (const name of ["a.svg", "a.bmp", "a.ico", "a.tiff", "a.exe", "a.mp4"]) {
      expect(attachmentMessageType(name)).toBeNull();
    }
  });

  it("returns null when there is no usable extension", () => {
    expect(attachmentMessageType("noext")).toBeNull();
    expect(attachmentMessageType("trailing.")).toBeNull();
    expect(attachmentMessageType(".hidden")).toBeNull();
    expect(attachmentMessageType("")).toBeNull();
  });

  it("uses the LAST extension, so a double extension is judged by the tail", () => {
    expect(attachmentMessageType("archive.zip.png")).toBe("IMAGE");
    expect(attachmentMessageType("photo.png.exe")).toBeNull();
  });
});

describe("validateMessageAttachment", () => {
  /**
   * A plain `{name, size, type}` stand-in: `validateMessageAttachment` reads
   * exactly those three properties, and constructing a real File of 100 MB in a
   * unit test would be wasteful.
   */
  function fakeFile(name: string, size: number, type = ""): File {
    return { name, size, type } as unknown as File;
  }

  it("accepts a whitelisted file", () => {
    expect(validateMessageAttachment(fakeFile("a.png", 1024))).toBeNull();
    expect(validateMessageAttachment(fakeFile("a.pdf", 1024))).toBeNull();
    expect(validateMessageAttachment(fakeFile("a.zip", 1024))).toBeNull();
  });

  it("rejects a type outside the whitelist with a readable reason", () => {
    expect(validateMessageAttachment(fakeFile("a.svg", 1024))).toContain("附件");
    expect(validateMessageAttachment(fakeFile("a.mp4", 1024))).toContain("附件");
  });

  it("rejects an empty file — the transport would happily store it", () => {
    expect(validateMessageAttachment(fakeFile("a.png", 0))).toContain("空");
  });

  it("accepts exactly the limit and rejects one byte more", () => {
    // `validateFileSize` compares `size > max`, so exactly 100 MB passes.
    expect(validateMessageAttachment(fakeFile("a.png", MESSAGE_ATTACHMENT_MAX_BYTES))).toBeNull();
    expect(
      validateMessageAttachment(fakeFile("a.png", MESSAGE_ATTACHMENT_MAX_BYTES + 1)),
    ).toContain("附件");
  });

  it("ignores an empty MIME type rather than blocking a good file", () => {
    // Some platforms hand back "" for a perfectly valid file; the extension is
    // what the backend checks, so an empty type must not fail validation.
    expect(validateMessageAttachment(fakeFile("a.png", 1024, ""))).toBeNull();
  });
});

describe("toMessages on the bare-array endpoints", () => {
  it("passes a bare array through unchanged", () => {
    const rows = [makeMessage({ id: "m1" }), makeMessage({ id: "m2" })];
    expect(toMessages(rows)).toEqual(rows);
  });

  it("unwraps an envelope if one ever appears", () => {
    expect(toMessages({ items: [makeMessage({ id: "m1" })] }).map((m) => m.id)).toEqual(["m1"]);
  });

  it("returns an empty array for null/undefined rather than throwing", () => {
    expect(toMessages(null)).toEqual([]);
    expect(toMessages(undefined)).toEqual([]);
  });
});

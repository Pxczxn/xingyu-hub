import { describe, expect, it } from "vitest";
import {
  SAVED_MESSAGE_LIMIT,
  SAVED_MESSAGE_MAX_LIMIT,
  formatSavedTime,
  savedAttachmentKind,
  savedBodyRepeatsAttachment,
  savedConversationHref,
  savedConversationLabel,
  savedMessageBody,
  savedSenderLabel,
  toSavedMessages,
  type SavedMessageView,
} from "./saved-messages.types";

function row(overrides: Partial<SavedMessageView> = {}): SavedMessageView {
  return {
    id: "bookmark-1",
    messageId: "msg-1",
    conversationId: "conv-1",
    senderId: "user-1",
    ...overrides,
  };
}

describe("constant caps", () => {
  it("mirrors the endpoint default and the service cap", () => {
    expect(SAVED_MESSAGE_LIMIT).toBe(50);
    expect(SAVED_MESSAGE_MAX_LIMIT).toBe(100);
  });
});

describe("toSavedMessages", () => {
  it("passes a bare array through", () => {
    expect(toSavedMessages([row()])).toHaveLength(1);
  });

  it("unwraps an envelope if one ever appears", () => {
    expect(toSavedMessages({ items: [row()] } as unknown as SavedMessageView[])).toHaveLength(1);
  });

  it("returns [] for null / undefined / a non-array", () => {
    expect(toSavedMessages(null)).toEqual([]);
    expect(toSavedMessages(undefined)).toEqual([]);
    expect(toSavedMessages({} as unknown as SavedMessageView[])).toEqual([]);
  });
});

describe("savedConversationLabel", () => {
  it("uses a group title when present", () => {
    expect(
      savedConversationLabel(row({ conversationType: "GROUP", conversationTitle: "观测站" })),
    ).toBe("观测站");
  });

  it("falls back to 私信 for a DIRECT conversation with a null title", () => {
    expect(
      savedConversationLabel(row({ conversationType: "DIRECT", conversationTitle: null })),
    ).toBe("私信");
  });

  it("falls back to 未命名群聊 for a title-less group", () => {
    expect(savedConversationLabel(row({ conversationType: "GROUP", conversationTitle: "" }))).toBe(
      "未命名群聊",
    );
  });

  it("treats a whitespace-only title as absent", () => {
    expect(
      savedConversationLabel(row({ conversationType: "GROUP", conversationTitle: "   " })),
    ).toBe("未命名群聊");
  });
});

describe("savedBodyRepeatsAttachment", () => {
  it("is true only when the body equals the attachment URL", () => {
    expect(savedBodyRepeatsAttachment(row({ body: "/a.png", attachmentUrl: "/a.png" }))).toBe(true);
    expect(savedBodyRepeatsAttachment(row({ body: "看这个", attachmentUrl: "/a.png" }))).toBe(
      false,
    );
  });

  it("is false when either side is missing", () => {
    expect(savedBodyRepeatsAttachment(row({ body: "/a.png" }))).toBe(false);
    expect(savedBodyRepeatsAttachment(row({ attachmentUrl: "/a.png" }))).toBe(false);
  });
});

describe("savedMessageBody", () => {
  it("returns plain text", () => {
    expect(savedMessageBody(row({ body: "你好" }))).toBe("你好");
  });

  it("suppresses a body that is only the attachment URL", () => {
    expect(
      savedMessageBody(row({ body: "/a.png", attachmentUrl: "/a.png", messageType: "IMAGE" })),
    ).toBeNull();
  });

  it("keeps the server's tombstone text — it is the served string", () => {
    expect(savedMessageBody(row({ body: "[消息已撤回]" }))).toBe("[消息已撤回]");
  });

  it("returns null for an empty or missing body", () => {
    expect(savedMessageBody(row({ body: "" }))).toBeNull();
    expect(savedMessageBody(row({ body: null }))).toBeNull();
    expect(savedMessageBody(row())).toBeNull();
  });
});

describe("savedAttachmentKind", () => {
  it("classifies IMAGE and FILE", () => {
    expect(savedAttachmentKind(row({ messageType: "IMAGE", attachmentUrl: "/a.png" }))).toBe(
      "image",
    );
    expect(savedAttachmentKind(row({ messageType: "FILE", attachmentUrl: "/a.pdf" }))).toBe("file");
  });

  it("returns null without a URL, and for an unrecognised type", () => {
    expect(savedAttachmentKind(row({ messageType: "IMAGE" }))).toBeNull();
    expect(savedAttachmentKind(row({ messageType: "TEXT", attachmentUrl: "/a.txt" }))).toBeNull();
  });
});

describe("savedSenderLabel", () => {
  it("shortens a long opaque id", () => {
    expect(savedSenderLabel("abcdefghijklmno")).toBe("abcdefgh…");
  });

  it("keeps a short id and falls back for a blank one", () => {
    expect(savedSenderLabel("user-1")).toBe("user-1");
    expect(savedSenderLabel("")).toBe("某位成员");
  });
});

describe("formatSavedTime", () => {
  it("formats an ISO timestamp in Beijing time", () => {
    expect(formatSavedTime("2026-09-28T03:04:00Z")).toBe("09/28 11:04");
  });

  it("returns null for missing or unparseable input", () => {
    expect(formatSavedTime(null)).toBeNull();
    expect(formatSavedTime(undefined)).toBeNull();
    expect(formatSavedTime("not-a-date")).toBeNull();
  });
});

describe("savedConversationHref", () => {
  it("deep-links into the mailbox thread route", () => {
    expect(savedConversationHref(row({ conversationId: "conv-1" }))).toBe("/messages/conv-1");
  });

  it("encodes the id", () => {
    expect(savedConversationHref(row({ conversationId: "a/b" }))).toBe("/messages/a%2Fb");
  });
});

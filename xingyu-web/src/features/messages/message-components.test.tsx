import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { ConversationRow, formatConversationTime } from "./ConversationRow";
import {
  MessageBubble,
  formatMessageTime,
  senderName,
  senderProfileHref,
} from "./MessageBubble";
import { messagesApi } from "@/api/messages/messages.api";

/*
 * The two presentational pieces of the message centre (Phase 2I-3). They are
 * where the backend's already-made decisions get rendered, so these tests pin
 * the rendering contract rather than any business logic.
 */

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    type: "DIRECT",
    title: null,
    updatedAt: "2026-09-27T02:00:00Z",
    lastMessage: "你好",
    unreadCount: 0,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: null,
    messages: [],
    ...overrides,
  };
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "u-2",
    // 2026-10-06: structured sender, resolved server-side at read time.
    sender: { userId: "u-2", username: "them", displayName: "小明", avatar: null },
    sequenceNumber: 1,
    body: "你好",
    messageType: "TEXT",
    attachmentUrl: null,
    attachmentName: null,
    attachmentFileId: null,
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

describe("formatConversationTime", () => {
  it("formats in Asia/Shanghai regardless of the runner's timezone", () => {
    // 02:00 UTC == 10:00 in Shanghai, on the 27th.
    expect(formatConversationTime("2026-09-27T02:00:00Z")).toBe("09/27 10:00");
  });

  it("returns null for a missing or unparseable value, never 'Invalid Date'", () => {
    expect(formatConversationTime(null)).toBeNull();
    expect(formatConversationTime(undefined)).toBeNull();
    expect(formatConversationTime("nope")).toBeNull();
  });
});

describe("ConversationRow", () => {
  it("uses the DIRECT fallback label when the backend sent no title", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ title: null })} active={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("私信")).toBeInTheDocument();
  });

  it("prefers the real group title over the fallback", () => {
    render(
      <MemoryRouter>
        <ConversationRow
          conversation={conversation({ type: "GROUP", title: "读书会" })}
          active={false}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("读书会")).toBeInTheDocument();
    expect(screen.queryByText("私信")).not.toBeInTheDocument();
  });

  it("shows the unread badge with a readable label", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ unreadCount: 3 })} active={false} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("3 条未读")).toBeInTheDocument();
  });

  it("caps a hot conversation at 99+ but keeps the real number in the label", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ unreadCount: 250 })} active={false} />
      </MemoryRouter>,
    );
    const badge = screen.getByLabelText("250 条未读");
    expect(badge).toHaveTextContent("99+");
  });

  it("hides the badge entirely at zero unread", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ unreadCount: 0 })} active={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(/条未读/)).not.toBeInTheDocument();
  });

  it("marks the active row for assistive tech", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ id: "c9" })} active />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/messages/c9");
  });

  it("escapes a conversation id when building the link", () => {
    render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ id: "a/b" })} active={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/messages/a%2Fb");
  });

  it("renders no timestamp when updatedAt is missing instead of a bogus one", () => {
    const { container } = render(
      <MemoryRouter>
        <ConversationRow conversation={conversation({ updatedAt: null })} active={false} />
      </MemoryRouter>,
    );
    expect(container.querySelector("time")).toBeNull();
  });
});

describe("senderName / senderProfileHref", () => {
  it("prefers the display name, then the username", () => {
    expect(senderName(message())).toBe("小明");
    expect(
      senderName(message({ sender: { userId: "u", username: "them", displayName: null } })),
    ).toBe("them");
  });

  it("returns null when the profile is gone, so the UI can say 已注销用户", () => {
    // Never the raw id: an opaque uuid tells the reader nothing and used to be
    // exactly what a group bubble showed.
    expect(senderName(message({ sender: null }))).toBeNull();
    expect(senderProfileHref(message({ sender: null }))).toBeNull();
  });

  it("builds the canonical profile href from the CURRENT username", () => {
    expect(senderProfileHref(message())).toBe("/u/them");
  });
});

describe("formatMessageTime", () => {
  it("formats a real timestamp", () => {
    expect(formatMessageTime("2026-09-27T02:00:00Z")).toBe("09/27 10:00");
  });

  it("returns null for bad input", () => {
    expect(formatMessageTime(null)).toBeNull();
    expect(formatMessageTime("garbage")).toBeNull();
  });
});

describe("MessageBubble", () => {
  function renderBubble(props: Partial<Parameters<typeof MessageBubble>[0]> = {}) {
    // A Router is required now that the sender label is a <Link> to the canonical
    // profile (2026-10-06) rather than a plain span.
    return render(
      <MemoryRouter>
      <ul>
        <MessageBubble
          message={message()}
          conversationId="c1"
          mine={false}
          showSender={false}
          canRecall={false}
          pending={false}
          onRecall={vi.fn()}
          {...props}
        />
      </ul>
      </MemoryRouter>,
    );
  }

  it("renders plain text", () => {
    renderBubble();
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("renders a recalled message as a tombstone driven by recalledAt", () => {
    // The body is deliberately NOT the server's tombstone copy: rendering must
    // key off `recalledAt`, so a server-side wording change cannot resurrect it.
    renderBubble({
      message: message({ body: "随便写的内容", recalledAt: "2026-09-27T03:00:00Z" }),
    });

    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-recalled", "true");
    expect(screen.getByText("随便写的内容")).toBeInTheDocument();
  });

  it("offers 撤回 only when the page grants it", () => {
    // `canRecall` is the switch — the page computes it as `mine && !isRecalled`,
    // so the component itself does not re-derive ownership from `mine`.
    const { unmount } = renderBubble({ mine: false, canRecall: false });
    expect(screen.queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    unmount();

    renderBubble({ mine: true, canRecall: true });
    expect(screen.getByRole("button", { name: "撤回" })).toBeInTheDocument();
  });

  it("renders a recalled message as a tombstone even when canRecall was granted", () => {
    renderBubble({
      mine: true,
      canRecall: true,
      message: message({ body: "[消息已撤回]", recalledAt: "2026-09-27T03:00:00Z" }),
    });
    // The page's rule (`mine && !isRecalled`) is what keeps this from happening;
    // the component honours the flag it is given and shows the tombstone styling.
    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-recalled", "true");
  });

  /*
   * 2026-10-06: attachments are fetched WITH the session token and handed to the DOM
   * as an object URL. The raw `attachmentUrl` pointed at an unauthenticated static path
   * (measured 200 with no token), so it must not be used as a src any more.
   */
  it("renders an image attachment from the authenticated download, not the raw url", async () => {
    const download = vi
      .spyOn(messagesApi, "downloadAttachment")
      .mockResolvedValue(new Blob(["x"]) as never);
    const createObjectURL = vi.fn(() => "blob:member-only");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    renderBubble({
      message: message({
        messageType: "IMAGE",
        attachmentUrl: "https://cdn.example/x.png",
        attachmentName: "照片",
        attachmentFileId: 42,
        body: "https://cdn.example/x.png",
      }),
    });

    const img = await screen.findByRole("img", { name: "照片" });
    expect(download).toHaveBeenCalledWith("c1", "m1");
    expect(img).toHaveAttribute("src", "blob:member-only");
    vi.unstubAllGlobals();
    download.mockRestore();
  });

  it("says the attachment is loading instead of rendering a broken image", () => {
    vi.spyOn(messagesApi, "downloadAttachment").mockReturnValue(new Promise(() => {}) as never);
    renderBubble({
      message: message({ messageType: "IMAGE", attachmentName: "照片", attachmentFileId: 42 }),
    });
    expect(screen.getByText("图片加载中…")).toBeInTheDocument();
  });

  it("suppresses a body that merely repeats the attachment URL", () => {
    renderBubble({
      message: message({
        messageType: "IMAGE",
        attachmentUrl: "https://cdn.example/x.png",
        body: "https://cdn.example/x.png",
      }),
    });
    expect(screen.queryByText("https://cdn.example/x.png")).not.toBeInTheDocument();
  });

  it("keeps a caption that differs from the attachment URL", () => {
    renderBubble({
      message: message({
        messageType: "IMAGE",
        attachmentUrl: "https://cdn.example/x.png",
        body: "看这个",
      }),
    });
    expect(screen.getByText("看这个")).toBeInTheDocument();
  });

  it("renders a file attachment as an authenticated download link", async () => {
    const download = vi
      .spyOn(messagesApi, "downloadAttachment")
      .mockResolvedValue(new Blob(["x"]) as never);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:file"), revokeObjectURL: vi.fn() });

    renderBubble({
      message: message({
        messageType: "FILE",
        attachmentUrl: "https://cdn.example/a.pdf",
        attachmentName: "报告.pdf",
        attachmentFileId: 7,
        // `body` is typed non-null: the service stores the attachment URL there
        // when no caption was given, so an attachment-only message arrives as a
        // URL/URL pair, not as an empty body.
        body: "https://cdn.example/a.pdf",
      }),
    });

    const link = await screen.findByRole("link", { name: "报告.pdf" });
    expect(download).toHaveBeenCalledWith("c1", "m1");
    expect(link).toHaveAttribute("href", "blob:file");
    expect(link).toHaveAttribute("download", "报告.pdf");
    vi.unstubAllGlobals();
    download.mockRestore();
  });

  it("shows a linked sender label only when asked (2026-10-06)", () => {
    const { unmount } = renderBubble({ showSender: true, mine: false });
    // A real name that links to the canonical profile, not a truncated id.
    expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute("href", "/u/them");
    unmount();

    renderBubble({ showSender: false, mine: false });
    expect(screen.queryByRole("link", { name: "小明" })).not.toBeInTheDocument();
  });

  it("does not link a sender whose username cannot be resolved", () => {
    renderBubble({ showSender: true, mine: false, message: message({ sender: null }) });
    const row = within(screen.getByRole("listitem"));
    expect(row.getByText("已注销用户")).toBeInTheDocument();
    expect(row.queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks a pending recall and disables the button", () => {
    renderBubble({ mine: true, canRecall: true, pending: true });
    expect(screen.getByRole("button", { name: "撤回中…" })).toBeDisabled();
  });

  it("calls back with the message when 撤回 is pressed", () => {
    const onRecall = vi.fn();
    renderBubble({ mine: true, canRecall: true, onRecall });

    fireEvent.click(screen.getByRole("button", { name: "撤回" }));
    expect(onRecall).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
  });
});

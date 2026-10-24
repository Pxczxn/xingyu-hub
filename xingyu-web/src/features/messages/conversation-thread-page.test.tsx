import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import { ApiError } from "@/api/client";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import {
  chatSocket,
  emitChatEvent,
  resetChatSocketDouble,
} from "@/features/chat/chat-socket.test-double";
import { ConversationThreadPage, scrollStrategyOf } from "./pages/ConversationThreadPage";
import { formatMessageTimeShort, isRecallable, senderName } from "./MessageBubble";
import { shouldShowMessageTime } from "@/api/messages/messages.types";

/*
 * The shared chat provider is mocked as a controllable double: these tests care about
 * what happens when a frame arrives, not about the socket itself (the provider has its
 * own test for that).
 */
vi.mock("@/features/chat/chat-socket.context", async () => {
  const actual = await vi.importActual<typeof import("@/features/chat/chat-socket.context")>(
    "@/features/chat/chat-socket.context",
  );
  const double = await import("@/features/chat/chat-socket.test-double");
  return { ...actual, useChatSocket: double.chatSocketValue };
});

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: vi.fn(),
    getDirect: vi.fn(),
    openDirect: vi.fn(),
    getGroup: vi.fn(),
    sendDirect: vi.fn(),
    sendGroup: vi.fn(),
    listMessages: vi.fn(),
    listMessagesAfter: vi.fn(),
    listMessagesAround: vi.fn(),
    downloadAttachment: vi.fn(),
    markRead: vi.fn(),
    recallMessage: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

const ME = "user-me";
const THEM = "user-them";

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "GROUP",
    senderId: THEM,
    // 2026-10-06: messages now carry a structured sender resolved from the profile.
    sender: { userId: THEM, username: "them", displayName: "小明", avatar: null },
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

function conversation(messages: ChatMessage[]): Conversation {
  return {
    id: "c1",
    type: "GROUP",
    title: "测试群",
    updatedAt: "2026-09-27T02:00:00Z",
    lastMessage: "你好",
    unreadCount: 2,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: "MEMBER",
    messages,
  };
}

function notFound(): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "资源不存在",
    status: 404,
    detail: "资源不存在",
    code: "NOT_FOUND",
  });
}

function renderThread(path = "/messages/c1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/messages" element={<div>会话列表</div>} />
        {/* The param is load-bearing: the page reads `conversationId` from the
            route and returns early when it is absent, so a literal path here
            would leave it stuck on the loading state. */}
        <Route path="/messages/:conversationId" element={<ConversationThreadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Renders the thread with the provider already knowing who we are. */
async function renderConnected(messages: ChatMessage[]) {
  chatSocket.myUserId = ME;
  mocked.getDirect.mockRejectedValue(notFound());
  mocked.getGroup.mockResolvedValue(conversation(messages));
  const view = renderThread();
  if (messages.length > 0) {
    await screen.findByLabelText("消息列表");
  } else {
    await screen.findByTestId("page-state-empty");
  }
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
  mocked.markRead.mockResolvedValue(undefined);
  mocked.listMessagesAfter.mockResolvedValue({ messages: [], hasMore: false });
  mocked.listMessagesAround.mockResolvedValue({ messages: [], found: false, sequence: 0 });
});

describe("ConversationThreadPage — loading", () => {
  it("falls back from the DIRECT detail to the GROUP detail on 404", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([]));
    renderThread();

    await screen.findByTestId("page-state-empty");
    expect(mocked.getDirect).toHaveBeenCalledWith("c1");
    expect(mocked.getGroup).toHaveBeenCalledWith("c1");
  });

  it("marks the conversation read on open and reconciles the shared list", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([]));
    renderThread();

    await screen.findByTestId("page-state-empty");
    expect(mocked.markRead).toHaveBeenCalledWith("c1");
    // The row badge and the header badge read the shared list, so a read that the
    // server accepted has to be followed by a re-read of it.
    await waitFor(() => expect(chatSocket.refreshConversations).toHaveBeenCalled());
  });
});

describe("ConversationThreadPage — own-message detection", () => {
  it("shows a neutral bubble before the provider names us, and never claims a message is ours", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([message({ senderId: ME })]));
    renderThread();

    const list = await screen.findByLabelText("消息列表");
    // The id is unknown, so no sender label is rendered (we cannot rule
    // ourselves out) and no 撤回 is offered (we cannot prove it is ours).
    expect(within(list).queryByText(ME)).not.toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
  });

  it("offers 撤回 only on our own message once the provider says who we are", async () => {
    await renderConnected([
      message({ id: "mine", senderId: ME, sequenceNumber: 1 }),
      message({ id: "theirs", senderId: THEM, sequenceNumber: 2 }),
    ]);

    const list = screen.getByLabelText("消息列表");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    // Our own row: recallable, and NOT labelled with our own name.
    expect(within(rows[0]).getByRole("button", { name: "撤回" })).toBeInTheDocument();
    expect(within(rows[0]).queryByText("小明")).not.toBeInTheDocument();

    // Their row: named (2026-10-06 — no more truncated ids) and not recallable.
    expect(within(rows[1]).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("小明")).toBeInTheDocument();
  });

  it("does not offer 撤回 on our own recalled message (it is already a tombstone)", async () => {
    await renderConnected([
      message({
        id: "mine",
        senderId: ME,
        recalledAt: "2026-09-27T03:00:00Z",
        body: "[消息已撤回]",
      }),
    ]);

    const list = screen.getByLabelText("消息列表");
    expect(within(list).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    expect(within(list).getAllByText(/消息已撤回/).length).toBeGreaterThan(0);
  });

  it("names the sender in a group but not in a direct thread", async () => {
    chatSocket.myUserId = ME;
    mocked.getDirect.mockResolvedValue({
      ...conversation([message({ senderId: THEM })]),
      type: "DIRECT",
      title: null,
    });
    renderThread();

    await screen.findByLabelText("消息列表");

    // DIRECT: the other party is implied by the thread itself.
    expect(screen.queryByText("小明")).not.toBeInTheDocument();
  });
});

describe("ConversationThreadPage — sender identity", () => {
  it("links a group sender to their canonical profile", async () => {
    await renderConnected([message({ senderId: THEM })]);

    // `sender.username` is the CURRENT one, resolved server-side at read time — so a
    // rename is reflected here without touching the stored message.
    expect(screen.getByRole("link", { name: "小明" })).toHaveAttribute("href", "/u/them");
  });

  it("renders a neutral label instead of a raw id when the profile is gone", async () => {
    await renderConnected([message({ senderId: "deleted-user", sender: null })]);

    expect(screen.getByText("已注销用户")).toBeInTheDocument();
    expect(screen.queryByText(/deleted-user/)).not.toBeInTheDocument();
  });

  it("falls back from displayName to username", () => {
    expect(
      senderName(message({ sender: { userId: "u", username: "them", displayName: null } })),
    ).toBe("them");
  });
});

describe("ConversationThreadPage — realtime", () => {
  it("ignores frames for another conversation", async () => {
    await renderConnected([message({ id: "m1", sequenceNumber: 1 })]);

    emitChatEvent({
      kind: "message",
      conversationId: "other-conversation",
      message: message({ id: "m2", sequenceNumber: 9 }),
    });

    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("merges an incoming message once, even if it also arrives via the send response", async () => {
    await renderConnected([]);

    const incoming = message({ id: "m2", senderId: THEM, sequenceNumber: 2 });
    emitChatEvent({ kind: "message", conversationId: "c1", message: incoming });
    emitChatEvent({ kind: "message", conversationId: "c1", message: incoming });

    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("turns a message into a tombstone when a recall frame arrives", async () => {
    await renderConnected([message({ id: "m1", senderId: ME, sequenceNumber: 1 })]);

    emitChatEvent({
      kind: "recall",
      conversationId: "c1",
      message: message({
        id: "m1",
        senderId: ME,
        sequenceNumber: 1,
        body: "[消息已撤回]",
        recalledAt: "2026-09-27T04:00:00Z",
      }),
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("消息列表").querySelector("[data-recalled='true']"),
      ).not.toBeNull();
    });
  });

  /*
   * The provider backfills missed messages after a reconnect and dispatches them as
   * ordinary `message` events, so the thread must render them through the same path —
   * no refresh, no duplicate.
   */
  it("renders a backfilled message through the same path as a live one", async () => {
    await renderConnected([message({ id: "m1", sequenceNumber: 1 })]);

    const missed = message({ id: "m9", senderId: THEM, sequenceNumber: 9, body: "断线期间的消息" });
    emitChatEvent({ kind: "message", conversationId: "c1", message: missed });
    // A duplicate delivery (REST backfill racing the socket) must not double it.
    emitChatEvent({ kind: "message", conversationId: "c1", message: missed });

    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("断线期间的消息")).toBeInTheDocument();
  });

  it("tells the provider how far this conversation has got, so a reconnect can backfill", async () => {
    await renderConnected([message({ id: "m1", sequenceNumber: 7 })]);

    await waitFor(() =>
      expect(chatSocket.watched).toContainEqual({ conversationId: "c1", knownMaxSequence: 7 }),
    );
  });

  it("shows a reconnect hint while the socket is down", async () => {
    chatSocket.connection = "reconnecting";
    await renderConnected([message()]);

    expect(screen.getByText(/连接中断/)).toBeInTheDocument();
  });
});

describe("ConversationThreadPage — send", () => {
  it("sends with a clientMessageId and does not double-render the returned message", async () => {
    await renderConnected([]);

    const created = message({ id: "m9", senderId: ME, sequenceNumber: 5, body: "在吗" });
    mocked.sendGroup.mockResolvedValue(created);
    // The socket delivers it first, as it does in production.
    emitChatEvent({ kind: "message", conversationId: "c1", message: created });

    // `fireEvent.change` rather than `user.type`: typing advances a timer per
    // keystroke and, with asyncUtilTimeout == the test timeout, a slow settle
    // turns into a hard 5 s hang instead of a readable failure. The submit path
    // is what is under test, not the keystroke handling.
    fireEvent.change(screen.getByLabelText("消息内容"), { target: { value: "在吗" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalled());
    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(mocked.sendGroup).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ body: "在吗", clientMessageId: expect.any(String) }),
    );
  });
});

describe("ConversationThreadPage — attachment entry points", () => {
  it("links to the shared media and files views for the open conversation", async () => {
    await renderConnected([message()]);

    expect(screen.getByRole("link", { name: "图片" })).toHaveAttribute(
      "href",
      "/messages/c1/media",
    );
    expect(screen.getByRole("link", { name: "文件" })).toHaveAttribute(
      "href",
      "/messages/c1/files",
    );
  });

  it("renders the attachment control so a file can be sent", async () => {
    await renderConnected([]);
    expect(screen.getByRole("button", { name: "添加附件" })).toBeInTheDocument();
  });
});

describe("ConversationThreadPage — errors", () => {
  it("shows the backend's own reason when a send is rejected", async () => {
    await renderConnected([]);

    mocked.sendGroup.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "无法发送",
        status: 409,
        detail: "无法向该用户发送私信",
        code: "CONFLICT",
      }),
    );

    fireEvent.change(screen.getByLabelText("消息内容"), { target: { value: "在吗" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("无法向该用户发送私信");
  });

  it("shows 会话不存在 on a 404 from both detail endpoints", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockRejectedValue(notFound());
    renderThread();

    expect(await screen.findByText("会话不存在")).toBeInTheDocument();
  });
});

/*
 * 2026-10-06 — the scroll strategy, the timestamp rule, the recall window and the
 * search landing. All four were measured defects, and all four live in small helpers
 * or a single request so they can be pinned here: jsdom has no layout, so a rule
 * buried inside a component could only be "tested" by asserting nothing.
 */
describe("scrollStrategyOf — which element is actually scrolling", () => {
  it("scrolls the message viewport when IT overflows (the >= lg case)", () => {
    // 2026-10-06 regression: unconditionally scrolling the document here is what
    // dragged the page header and the left column off screen (measured 345px).
    expect(scrollStrategyOf({ scrollHeight: 3326, clientHeight: 409 })).toBe("viewport");
  });

  it("scrolls the document when the viewport does NOT overflow (the < lg case)", () => {
    // Below lg the thread sits in normal document flow: the message area is not a
    // scroller, so "scroll the viewport" is a no-op, and a 28-message thread opened on
    // the OLDEST message with the composer 1392px below the fold.
    expect(scrollStrategyOf({ scrollHeight: 409, clientHeight: 409 })).toBe("document");
  });

  it("is decided by layout, not by a user-agent string", () => {
    // Same question, opposite answers depending only on the measurements.
    expect(scrollStrategyOf({ scrollHeight: 900, clientHeight: 400 })).toBe("viewport");
    expect(scrollStrategyOf({ scrollHeight: 400, clientHeight: 400 })).toBe("document");
  });
});

describe("shouldShowMessageTime — no more repeated identical timestamps", () => {
  const at = (iso: string, id: string) =>
    ({ id, createdAt: iso }) as unknown as Parameters<typeof shouldShowMessageTime>[0];

  it("shows the time on the first message of the list", () => {
    expect(shouldShowMessageTime(at("2026-10-06T02:00:00Z", "a"), undefined)).toBe(true);
  });

  it("omits it for the rest of a run inside the same minute", () => {
    // The measured evidence: a screen of six messages from the same minute rendered
    // six identical timestamps.
    expect(
      shouldShowMessageTime(at("2026-10-06T02:00:30Z", "b"), at("2026-10-06T02:00:00Z", "a")),
    ).toBe(false);
  });

  it("shows it again once the minute changes", () => {
    expect(
      shouldShowMessageTime(at("2026-10-06T02:01:00Z", "c"), at("2026-10-06T02:00:30Z", "b")),
    ).toBe(true);
  });

  it("shows it when a timestamp is unusable, rather than silently dropping it", () => {
    expect(shouldShowMessageTime(at("nonsense", "d"), at("2026-10-06T02:00:00Z", "a"))).toBe(true);
  });
});

describe("formatMessageTimeShort", () => {
  /*
   * `now` is injected, not read from the wall clock. The formatter's "today" is a
   * Shanghai calendar day, so a sample built as `Date.now() - 60_000` stops being
   * today for one minute every night — the function then correctly returns
   * "MM/DD HH:mm" while a `/^\d{2}:\d{2}$/` assertion still expects the bare time.
   * That window is what made this file fail intermittently; the fix is to pin the
   * instant the formatter compares against.
   */

  /** 2026-10-25 00:30 CST — just inside a Shanghai day, so "same day" is unambiguous. */
  const MIDDAY_NOW = new Date("2026-10-24T16:30:00Z");

  it("drops the date for a message from the same Shanghai day", () => {
    expect(formatMessageTimeShort("2026-10-24T16:29:00Z", MIDDAY_NOW)).toBe("00:29");
  });

  it("keeps the date for a message from the previous Shanghai day", () => {
    expect(formatMessageTimeShort("2026-10-24T15:59:00Z", MIDDAY_NOW)).toBe("10/24 23:59");
  });

  /*
   * The exact boundary that used to break: one minute after Shanghai midnight the
   * "a minute ago" sample has already crossed into yesterday. Keeping the date is
   * the correct answer here, and it is pinned rather than left to luck.
   */
  it("crosses midnight correctly instead of assuming a minute ago is today", () => {
    const justAfterMidnight = new Date("2026-10-24T16:00:30Z"); // 2026-10-25 00:00:30 CST
    expect(formatMessageTimeShort("2026-10-24T15:59:30Z", justAfterMidnight)).toBe("10/24 23:59");
    expect(formatMessageTimeShort("2026-10-24T16:00:00Z", justAfterMidnight)).toBe("00:00");
  });

  it("keeps a short date for anything older", () => {
    expect(formatMessageTimeShort("2026-09-27T02:00:00Z", MIDDAY_NOW)).toMatch(
      /\d{2}\/\d{2} \d{2}:\d{2}/,
    );
  });

  it("returns null for a missing or unparseable value", () => {
    expect(formatMessageTimeShort(null, MIDDAY_NOW)).toBeNull();
    expect(formatMessageTimeShort("nope", MIDDAY_NOW)).toBeNull();
  });
});

describe("isRecallable — the window belongs to the server", () => {
  const base = { id: "m", body: "x", messageType: "TEXT" } as unknown as Parameters<
    typeof isRecallable
  >[0];

  it("is true while the server-side deadline is still in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isRecallable({ ...base, recallUntil: future })).toBe(true);
  });

  it("is false once the window has passed — no button that can only 409", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isRecallable({ ...base, recallUntil: past })).toBe(false);
  });

  it("is false for a recalled message even if the field is somehow set", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isRecallable({ ...base, recallUntil: future, recalledAt: "2026-10-06T02:00:00Z" })).toBe(
      false,
    );
  });

  it("keeps the old behaviour for rows written before the field existed", () => {
    expect(isRecallable(base)).toBe(true);
  });
});

describe("ConversationThreadPage — search landing", () => {
  it("fetches ONE window around the target sequence when the message is not loaded", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([message({ id: "m1", sequenceNumber: 1 })]));
    mocked.listMessagesAround.mockResolvedValue({
      messages: [
        message({ id: "old-1", sequenceNumber: 7, body: "很旧的一条" }),
        message({ id: "target", sequenceNumber: 8, body: "目标消息" }),
      ],
      found: true,
      sequence: 8,
    });

    renderThread("/messages/c1?m=target&s=8");
    await screen.findByLabelText("消息列表");

    await waitFor(() => expect(mocked.listMessagesAround).toHaveBeenCalledWith("c1", 8, 30));
    expect(mocked.listMessagesAfter).not.toHaveBeenCalled();
    expect(await screen.findByText("目标消息")).toBeInTheDocument();
    const row = document.querySelector('[data-message-id="target"]');
    expect(row?.getAttribute("data-highlighted")).toBe("true");
    expect(
      document.querySelector('[data-message-id="m1"]')?.getAttribute("data-highlighted"),
    ).not.toBe("true");
  });

  it("says so plainly when the target message is gone, instead of guessing", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([message({ id: "m1", sequenceNumber: 1 })]));
    mocked.listMessagesAround.mockResolvedValue({ messages: [], found: false, sequence: 99 });

    renderThread("/messages/c1?m=gone&s=99");
    await screen.findByLabelText("消息列表");

    expect(await screen.findByRole("alert")).toHaveTextContent("这条消息已不在该会话中");
  });

  it("does not fetch a window when the target is already on screen", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([message({ id: "m1", sequenceNumber: 5 })]));
    renderThread("/messages/c1?m=m1&s=5");
    await screen.findByLabelText("消息列表");

    expect(mocked.listMessagesAround).not.toHaveBeenCalled();
  });
});

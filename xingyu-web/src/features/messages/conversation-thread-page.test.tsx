import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import { ApiError } from "@/api/client";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { ConversationThreadPage } from "./pages/ConversationThreadPage";
import { senderLabel } from "./MessageBubble";

/*
 * The socket is mocked as a controllable fake rather than a real WebSocket: all
 * these tests care about is what happens when a frame arrives, and the hook has
 * its own connect/reconnect/cleanup behaviour to test separately.
 */
type Handlers = {
  onConnected?: (userId: string) => void;
  onMessage?: (conversationId: string, message: ChatMessage) => void;
  onRecall?: (conversationId: string, message: ChatMessage) => void;
  onRead?: (conversationId: string, userId: string, sequenceNumber: number) => void;
};

let socketHandlers: Handlers = {};

vi.mock("@/lib/use-community-chat-socket", () => ({
  useCommunityChatSocket: (_enabled: boolean, handlers: Handlers) => {
    socketHandlers = handlers;
  },
}));

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: vi.fn(),
    getDirect: vi.fn(),
    openDirect: vi.fn(),
    getGroup: vi.fn(),
    sendDirect: vi.fn(),
    sendGroup: vi.fn(),
    listMessages: vi.fn(),
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
    sequenceNumber: 1,
    body: "你好",
    messageType: "TEXT",
    attachmentUrl: null,
    attachmentName: null,
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

function renderThread() {
  return render(
    <MemoryRouter initialEntries={["/messages/c1"]}>
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

/** Renders the thread with the socket already connected as ME. */
async function renderConnected(messages: ChatMessage[]) {
  mocked.getDirect.mockRejectedValue(notFound());
  mocked.getGroup.mockResolvedValue(conversation(messages));
  const view = renderThread();
  // An empty thread renders the empty state instead of the list, so wait on
  // whichever of the two this conversation produces — `findByLabelText("消息列表")`
  // would hang forever on the empty case.
  if (messages.length > 0) {
    await screen.findByLabelText("消息列表");
  } else {
    await screen.findByTestId("page-state-empty");
  }
  // A frame is an external event, so the state update it causes must be wrapped
  // the same way a user interaction is — otherwise the update lands outside
  // act() and the following query never settles.
  act(() => {
    socketHandlers.onConnected?.(ME);
  });
  return view;
}

/** Delivers a socket frame inside act(). */
function emit(frame: (handlers: Handlers) => void) {
  act(() => {
    frame(socketHandlers);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  socketHandlers = {};
  mocked.markRead.mockResolvedValue(undefined);
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

  it("marks the conversation read on open, with no explicit sequence", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([]));
    renderThread();

    await screen.findByTestId("page-state-empty");
    expect(mocked.markRead).toHaveBeenCalledWith("c1");
  });
});

describe("ConversationThreadPage — own-message detection", () => {
  it("shows a neutral bubble before the socket names us, and never claims a message is ours", async () => {
    mocked.getDirect.mockRejectedValue(notFound());
    mocked.getGroup.mockResolvedValue(conversation([message({ senderId: ME })]));
    renderThread();

    const list = await screen.findByLabelText("消息列表");
    // The id is unknown, so no sender label is rendered (we cannot rule
    // ourselves out) and no 撤回 is offered (we cannot prove it is ours).
    expect(within(list).queryByText(ME)).not.toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
  });

  it("offers 撤回 only on our own message once the socket says who we are", async () => {
    await renderConnected([
      message({ id: "mine", senderId: ME, sequenceNumber: 1 }),
      message({ id: "theirs", senderId: THEM, sequenceNumber: 2 }),
    ]);

    const list = screen.getByLabelText("消息列表");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    // Our own row: recallable, and NOT labelled with our own id.
    expect(within(rows[0]).getByRole("button", { name: "撤回" })).toBeInTheDocument();
    expect(within(rows[0]).queryByText(senderLabel(ME))).not.toBeInTheDocument();

    // Their row: labelled with a shortened id (no profile data in this phase),
    // and no recall affordance.
    expect(within(rows[1]).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    expect(within(rows[1]).getByText(senderLabel(THEM))).toBeInTheDocument();
  });

  it("does not offer 撤回 on our own recalled message (it is already a tombstone)", async () => {
    await renderConnected([
      message({ id: "mine", senderId: ME, recalledAt: "2026-09-27T03:00:00Z", body: "[消息已撤回]" }),
    ]);

    const list = screen.getByLabelText("消息列表");
    expect(within(list).queryByRole("button", { name: "撤回" })).not.toBeInTheDocument();
    expect(within(list).getAllByText(/消息已撤回/).length).toBeGreaterThan(0);
  });

  it("names the sender in a group but not in a direct thread", async () => {
    mocked.getDirect.mockResolvedValue({
      ...conversation([message({ senderId: THEM })]),
      type: "DIRECT",
      title: null,
    });
    renderThread();

    await screen.findByLabelText("消息列表");
    socketHandlers.onConnected?.(ME);

    // DIRECT: the other party is implied by the thread itself.
    expect(screen.queryByText(THEM)).not.toBeInTheDocument();
  });
});

describe("ConversationThreadPage — realtime", () => {
  it("ignores frames for another conversation", async () => {
    await renderConnected([message({ id: "m1", sequenceNumber: 1 })]);

    emit((h) => h.onMessage?.("other-conversation", message({ id: "m2", sequenceNumber: 9 })));

    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("merges an incoming message once, even if it also arrives via the send response", async () => {
    await renderConnected([]);

    const incoming = message({ id: "m2", senderId: THEM, sequenceNumber: 2 });
    emit((h) => h.onMessage?.("c1", incoming));
    emit((h) => h.onMessage?.("c1", incoming));

    const list = screen.getByLabelText("消息列表");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("turns a message into a tombstone when a recall frame arrives", async () => {
    await renderConnected([message({ id: "m1", senderId: ME, sequenceNumber: 1 })]);

    emit((h) =>
      h.onRecall?.(
        "c1",
        message({
          id: "m1",
          senderId: ME,
          sequenceNumber: 1,
          body: "[消息已撤回]",
          recalledAt: "2026-09-27T04:00:00Z",
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("消息列表").querySelector("[data-recalled='true']")).not.toBeNull();
    });
  });
});

describe("ConversationThreadPage — send", () => {
  it("sends with a clientMessageId and does not double-render the returned message", async () => {
    await renderConnected([]);

    const created = message({ id: "m9", senderId: ME, sequenceNumber: 5, body: "在吗" });
    mocked.sendGroup.mockResolvedValue(created);
    // The socket delivers it first, as it does in production.
    emit((h) => h.onMessage?.("c1", created));

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

    expect(screen.getByRole("link", { name: "图片" })).toHaveAttribute("href", "/messages/c1/media");
    expect(screen.getByRole("link", { name: "文件" })).toHaveAttribute("href", "/messages/c1/files");
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


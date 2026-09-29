import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import { ApiError } from "@/api/client";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { MailboxPage } from "./pages/MailboxPage";

type Handlers = {
  onConnected?: (userId: string) => void;
  onMessage?: (conversationId: string, message: ChatMessage) => void;
  onRead?: (conversationId: string, userId: string, sequenceNumber: number) => void;
  onRecall?: (conversationId: string, message: ChatMessage) => void;
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

function renderMailbox() {
  return render(
    <MemoryRouter initialEntries={["/messages"]}>
      <Routes>
        <Route path="/messages" element={<MailboxPage />} />
        <Route path="/messages/:conversationId" element={<div>会话详情</div>} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  socketHandlers = {};
});

describe("MailboxPage — list", () => {
  it("shows loading while the list request is in flight", () => {
    mocked.listConversations.mockReturnValue(new Promise(() => {}));
    renderMailbox();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  it("renders the backend's order and never re-sorts it", async () => {
    // The mapper already orders by updated_at DESC; a null updatedAt is
    // possible for a brand-new conversation and must not be shuffled to an end.
    mocked.listConversations.mockResolvedValue([
      conversation({ id: "c-new", updatedAt: null, lastMessage: "刚建的" }),
      conversation({ id: "c-old", updatedAt: "2026-09-01T00:00:00Z", lastMessage: "很久以前" }),
    ]);
    renderMailbox();

    const list = await screen.findByLabelText("会话列表");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("刚建的")).toBeInTheDocument();
    expect(within(rows[1]).getByText("很久以前")).toBeInTheDocument();
  });

  it("labels a title-less DIRECT conversation rather than showing a blank row", async () => {
    mocked.listConversations.mockResolvedValue([conversation({ title: null })]);
    renderMailbox();

    const list = await screen.findByLabelText("会话列表");
    expect(within(list).getByText("私信")).toBeInTheDocument();
  });

  it("sums unread counts across conversations for the header line", async () => {
    mocked.listConversations.mockResolvedValue([
      conversation({ id: "c1", unreadCount: 2 }),
      conversation({ id: "c2", unreadCount: 3 }),
      conversation({ id: "c3", unreadCount: 0 }),
    ]);
    renderMailbox();

    expect(await screen.findByText("5 条未读")).toBeInTheDocument();
  });

  it("says so plainly when there is nothing unread", async () => {
    mocked.listConversations.mockResolvedValue([conversation({ unreadCount: 0 })]);
    renderMailbox();

    expect(await screen.findByText("没有未读消息")).toBeInTheDocument();
  });

  it("shows the empty state when the mailbox is empty", async () => {
    mocked.listConversations.mockResolvedValue([]);
    renderMailbox();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });

  it("offers a login link when the session has expired", async () => {
    mocked.listConversations.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderMailbox();

    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("does not tell a signed-in user to log in on a non-auth failure", async () => {
    mocked.listConversations.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "服务异常",
        status: 500,
        detail: "服务异常",
        code: "INTERNAL_ERROR",
      }),
    );
    renderMailbox();

    expect(await screen.findByText("无法读取会话列表，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });
});

describe("MailboxPage — layout", () => {
  it("narrows the list column once a conversation is open", async () => {
    mocked.listConversations.mockResolvedValue([conversation()]);
    render(
      <MemoryRouter initialEntries={["/messages/c1"]}>
        <Routes>
          <Route path="/messages/:conversationId" element={<MailboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const list = await screen.findByLabelText("会话列表");
    expect(list.className).toContain("lg:max-w-sm");
  });

  it("marks the open conversation with aria-current", async () => {
    mocked.listConversations.mockResolvedValue([
      conversation({ id: "c1" }),
      conversation({ id: "c2" }),
    ]);
    render(
      <MemoryRouter initialEntries={["/messages/c2"]}>
        <Routes>
          <Route path="/messages/:conversationId" element={<MailboxPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const list = await screen.findByLabelText("会话列表");
    const current = within(list)
      .getAllByRole("listitem")
      .filter((row) => within(row).queryByRole("link", { current: "page" }) !== null);
    expect(current).toHaveLength(1);
    expect(within(current[0]).getByRole("link", { current: "page" })).toHaveAttribute(
      "href",
      "/messages/c2",
    );
  });
});

describe("MailboxPage — realtime", () => {
  it("refetches on an incoming message, since the preview and count both moved", async () => {
    mocked.listConversations.mockResolvedValue([conversation({ unreadCount: 0 })]);
    renderMailbox();
    await screen.findByLabelText("会话列表");
    expect(mocked.listConversations).toHaveBeenCalledTimes(1);

    mocked.listConversations.mockResolvedValue([conversation({ unreadCount: 1 })]);
    socketHandlers.onMessage?.("c1", {
      id: "m1",
      conversationId: "c1",
      conversationType: "DIRECT",
      senderId: "u-2",
      sequenceNumber: 1,
      body: "hi",
      messageType: "TEXT",
      attachmentUrl: null,
      attachmentName: null,
      createdAt: "2026-09-27T03:00:00Z",
      recalledAt: null,
    });

    await waitFor(() => expect(mocked.listConversations).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("1 条未读")).toBeInTheDocument();
  });

  it("keeps the existing list on screen during a socket-driven refresh", async () => {
    mocked.listConversations.mockResolvedValue([conversation({ lastMessage: "先前的消息" })]);
    renderMailbox();
    await screen.findByText("先前的消息");

    // Second load never settles: the previously rendered rows must survive.
    mocked.listConversations.mockReturnValue(new Promise(() => {}));
    socketHandlers.onMessage?.("c1", {
      id: "m1",
      conversationId: "c1",
      conversationType: "DIRECT",
      senderId: "u-2",
      sequenceNumber: 1,
      body: "hi",
      messageType: "TEXT",
      attachmentUrl: null,
      attachmentName: null,
      createdAt: "2026-09-27T03:00:00Z",
      recalledAt: null,
    });

    expect(screen.getByText("先前的消息")).toBeInTheDocument();
    expect(screen.queryByTestId("page-state-loading")).not.toBeInTheDocument();
  });
});


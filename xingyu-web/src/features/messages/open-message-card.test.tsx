import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { chatSocket, resetChatSocketDouble } from "@/features/chat/chat-socket.test-double";
import { MessageMenu } from "./MessageMenu";
import { OpenMessageCardPage, resetMessageCardHandoff } from "./OpenMessageCardPage";
import { resetMessagePanel } from "./message-panel-focus";

vi.mock("@/features/chat/chat-socket.context", async () => {
  const actual = await vi.importActual<typeof import("@/features/chat/chat-socket.context")>(
    "@/features/chat/chat-socket.context",
  );
  const double = await import("@/features/chat/chat-socket.test-double");
  return { ...actual, useChatSocket: double.chatSocketValue };
});

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    getDirect: vi.fn(),
    getGroup: vi.fn(),
    openDirect: vi.fn(),
    sendDirect: vi.fn(),
    sendGroup: vi.fn(),
    listMessages: vi.fn(),
    listMessagesAfter: vi.fn(),
    listMessagesAround: vi.fn(),
    markRead: vi.fn(),
    recallMessage: vi.fn(),
    sendAttachment: vi.fn(),
    search: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "user-them",
    sender: { userId: "user-them", username: "them", displayName: "小明", avatar: null },
    sequenceNumber: 8,
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

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    type: "DIRECT",
    title: null,
    counterpartDisplayName: "小明",
    updatedAt: "2026-09-27T02:00:00Z",
    lastMessage: "你好",
    unreadCount: 0,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: null,
    messages: [message()],
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="here">{location.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MessageMenu />
      <Routes>
        <Route path="/" element={<LocationProbe />} />
        <Route path="/groups" element={<Link to="/messages/c1">打开会话</Link>} />
        <Route path="/messages" element={<OpenMessageCardPage />} />
        <Route path="/messages/search" element={<OpenMessageCardPage mode="search" />} />
        <Route path="/messages/:conversationId" element={<OpenMessageCardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
  resetMessageCardHandoff();
  resetMessagePanel();
  chatSocket.conversations = [conversation()];
  chatSocket.conversationsStatus = "ready";
  chatSocket.unreadTotal = 0;
  chatSocket.myUserId = "user-me";
  mocked.getDirect.mockResolvedValue(conversation());
  mocked.markRead.mockResolvedValue(undefined);
  mocked.listMessagesAfter.mockResolvedValue({ messages: [], hasMore: false });
  mocked.listMessagesAround.mockResolvedValue({ messages: [], found: false, sequence: 0 });
});

describe("OpenMessageCardPage", () => {
  it("opens the card for a direct visit and leaves the mailbox URL", async () => {
    renderAt("/messages/c1?m=m1&s=8");

    expect(await screen.findByText("你好")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "消息内容" })).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/");
    expect(screen.queryByText("选择一个会话开始聊天")).not.toBeInTheDocument();
  });

  it("opens the list card from /messages", async () => {
    renderAt("/messages");

    expect(await screen.findByRole("button", { name: "新建" })).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/");
  });

  it("returns to the page that linked into a conversation", async () => {
    const user = userEvent.setup();
    renderAt("/groups");
    await user.click(screen.getByRole("link", { name: "打开会话" }));

    expect(await screen.findByText("你好")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开会话" })).toBeInTheDocument();
    expect(screen.queryByTestId("here")).not.toBeInTheDocument();
  });

  it("opens search from /messages/search and leaves that URL", async () => {
    mocked.search.mockResolvedValue([]);
    renderAt("/messages/search?q=%E6%98%9F%E8%AF%AD");

    expect(await screen.findByRole("textbox", { name: "搜索消息" })).toHaveValue("星语");
    expect(mocked.search).toHaveBeenCalledWith("星语", 50);
    expect(screen.getByTestId("here")).toHaveTextContent("/");
    expect(screen.queryByRole("heading", { name: "搜索消息", level: 1 })).not.toBeInTheDocument();
  });
});

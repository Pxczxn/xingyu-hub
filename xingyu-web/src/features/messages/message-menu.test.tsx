import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { chatSocket, resetChatSocketDouble } from "@/features/chat/chat-socket.test-double";
import { MessageMenu } from "./MessageMenu";

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

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/discover"]}>
      <LocationProbe />
      <MessageMenu />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
  chatSocket.conversations = [conversation()];
  chatSocket.conversationsStatus = "ready";
  chatSocket.unreadTotal = 0;
  chatSocket.myUserId = "user-me";
  mocked.getDirect.mockResolvedValue(conversation());
  mocked.markRead.mockResolvedValue(undefined);
  mocked.listMessagesAfter.mockResolvedValue({ messages: [], hasMore: false });
  mocked.listMessagesAround.mockResolvedValue({ messages: [], found: false, sequence: 0 });
});

describe("MessageMenu", () => {
  it("opens a conversation inside the card", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole("button", { name: "私信" }));
    await user.click(await screen.findByRole("button", { name: /小明/ }));

    expect(await screen.findByText("你好")).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "消息内容" })).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/discover");
  });

  it("sends a message without leaving the page", async () => {
    const user = userEvent.setup();
    mocked.sendDirect.mockResolvedValue(message({ id: "m2", senderId: "user-me", body: "在吗" }));
    renderMenu();
    await user.click(await screen.findByRole("button", { name: "私信" }));
    await user.click(await screen.findByRole("button", { name: /小明/ }));
    const box = await screen.findByRole("textbox", { name: "消息内容" });
    await user.type(box, "在吗");
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(mocked.sendDirect).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ body: "在吗" }),
    );
    expect(await screen.findByText("在吗")).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/discover");
  });

  it("starts a new conversation inside the card", async () => {
    const user = userEvent.setup();
    const created = conversation({
      id: "c2",
      counterpartDisplayName: "阿宁",
      lastMessage: null,
      messages: [],
    });
    mocked.openDirect.mockResolvedValue(created);
    mocked.getDirect.mockImplementation(async (id: string) =>
      id === "c2" ? created : conversation(),
    );
    renderMenu();
    await user.click(await screen.findByRole("button", { name: "私信" }));
    await user.click(await screen.findByRole("button", { name: "新建" }));
    await user.type(screen.getByRole("textbox", { name: "对方用户名" }), "aning");
    await user.click(screen.getByRole("button", { name: "开始" }));

    expect(mocked.openDirect).toHaveBeenCalledWith("aning");
    expect(await screen.findByRole("textbox", { name: "消息内容" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "阿宁" })).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/discover");
  });

  it("searches inside the card and opens the matching conversation", async () => {
    const user = userEvent.setup();
    mocked.search.mockResolvedValue([
      message({ id: "hit", body: "关于星语", sequenceNumber: 4, conversationId: "c1" }),
    ]);
    renderMenu();
    await user.click(await screen.findByRole("button", { name: "私信" }));
    await user.click(await screen.findByRole("button", { name: "搜索消息" }));
    expect(screen.queryByRole("textbox", { name: "搜索消息" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "展开搜索" }));
    await user.type(screen.getByRole("textbox", { name: "搜索消息" }), "星语");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(mocked.search).toHaveBeenCalledWith("星语", 50);
    await user.click(await screen.findByRole("button", { name: /关于星语/ }));
    expect(await screen.findByRole("textbox", { name: "消息内容" })).toBeInTheDocument();
    expect(screen.getByTestId("here")).toHaveTextContent("/discover");
  });
});

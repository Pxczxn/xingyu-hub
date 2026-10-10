import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import type { Conversation } from "@/api/messages/messages.types";
import { chatSocket, resetChatSocketDouble } from "@/features/chat/chat-socket.test-double";
import { MailboxPage } from "./pages/MailboxPage";

/*
 * 2026-10-06: the mailbox no longer fetches or opens a socket of its own — it renders
 * the SHARED conversation list the provider owns. So these tests drive that list
 * directly, which is also what makes the "page and header can never disagree" claim
 * testable: there is only one list.
 */
vi.mock("@/features/chat/chat-socket.context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/chat/chat-socket.context")
  >("@/features/chat/chat-socket.context");
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
    markRead: vi.fn(),
    recallMessage: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    type: "DIRECT",
    title: null,
    updatedAt: "2026-09-27T00:00:00Z",
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

/** Put the shared list into a state the page can render. */
function givenConversations(items: Conversation[] | null): void {
  chatSocket.conversations = items;
  chatSocket.conversationsStatus = items === null ? "loading" : "ready";
  chatSocket.unreadTotal = items
    ? items.reduce((total, item) => total + (item.unreadCount ?? 0), 0)
    : null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/messages" element={<MailboxPage />} />
        <Route path="/messages/:conversationId" element={<MailboxPage />} />
        <Route path="/login" element={<div>登录页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderMailbox() {
  return renderAt("/messages");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
  givenConversations([]);
});

describe("MailboxPage — shared list", () => {
  it("shows loading while the shared list is still being read", () => {
    givenConversations(null);
    renderMailbox();
    expect(screen.getByTestId("page-state-loading")).toBeInTheDocument();
  });

  /*
   * The page must not fetch on its own any more: a second fetch would be a second
   * copy of the truth, which is exactly the drift this refactor removed.
   */
  it("never fetches the list itself", async () => {
    givenConversations([conversation()]);
    renderMailbox();
    await screen.findByLabelText("会话列表");
    expect(mocked.listConversations).not.toHaveBeenCalled();
  });

  it("renders the backend's order and never re-sorts it", async () => {
    givenConversations([
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
    givenConversations([conversation({ title: null })]);
    renderMailbox();

    const list = await screen.findByLabelText("会话列表");
    expect(within(list).getByText("私信")).toBeInTheDocument();
  });

  /**
   * 2026-10-06: the page header no longer repeats the unread total.
   *
   * It used to say 「N 条未读」 under the title, while the same number was already on
   * the shell header badge (account total) and on each row badge (per conversation) —
   * three copies of one fact. Two layers are enough.
   */
  it("does not repeat the unread total in the page header", async () => {
    givenConversations([
      conversation({ id: "c1", unreadCount: 2 }),
      conversation({ id: "c2", unreadCount: 3 }),
    ]);
    renderMailbox();
    await screen.findByLabelText("会话列表");

    expect(screen.queryByText("5 条未读")).not.toBeInTheDocument();
    expect(screen.queryByText("没有未读消息")).not.toBeInTheDocument();
    // The per-row badge is still there — that is the layer that carries it.
    const rowBadges = screen.getAllByLabelText(/条未读/);
    expect(rowBadges).toHaveLength(2);
  });

  it("shows the empty state when the mailbox is empty", async () => {
    givenConversations([]);
    renderMailbox();

    expect(await screen.findByTestId("page-state-empty")).toBeInTheDocument();
  });

  it("offers a login link when the session has expired", async () => {
    chatSocket.conversations = null;
    chatSocket.conversationsStatus = "error";
    chatSocket.conversationsExpired = true;
    chatSocket.conversationsError = "登录状态已过期，请重新登录。";
    renderMailbox();

    expect(await screen.findByText("登录状态已过期，请重新登录。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
  });

  it("does not tell a signed-in user to log in on a non-auth failure", async () => {
    chatSocket.conversations = null;
    chatSocket.conversationsStatus = "error";
    chatSocket.conversationsError = "无法读取会话列表，请稍后重试。";
    chatSocket.conversationsExpired = false;
    renderMailbox();

    expect(await screen.findByText("无法读取会话列表，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去登录" })).not.toBeInTheDocument();
  });
});

describe("MailboxPage — layout", () => {
  /**
   * 2026-10-06: the 808×149 dashed placeholder box is gone. It read as a temporary
   * skeleton inside a 540px pane; the pane now carries the empty state itself, as one
   * quiet line — no illustration, no feature education, no suggested contacts.
   */
  it("lets the detail pane carry the empty state, with no dashed placeholder box", async () => {
    givenConversations([conversation()]);
    const { container } = renderAt("/messages");

    expect(await screen.findByLabelText("会话列表")).toBeInTheDocument();
    expect(screen.getByText("选择一个会话开始聊天")).toBeInTheDocument();
    expect(container.querySelector(".border-dashed")).toBeNull();
  });

  /**
   * 2026-10-06: the empty-mailbox copy used to promise 「在别人的主页点『私信』」 — a
   * control that does not exist anywhere (openDirect is only called from the
   * 新建私信 form). It now describes the path that actually works.
   */
  it("describes the real way to start a conversation", async () => {
    givenConversations([]);
    renderMailbox();

    expect(await screen.findByText("还没有私信")).toBeInTheDocument();
    expect(screen.getByText("可以通过用户名发起新的对话。")).toBeInTheDocument();
    expect(screen.queryByText(/别人的主页/)).not.toBeInTheDocument();
  });

  /**
   * 2026-10-06: search is a real capability and used to have NO entry anywhere. It now
   * sits as a quiet link beside 新建私信 — present, but not louder than the list.
   */
  it("offers a search entry next to 新建私信", async () => {
    givenConversations([conversation()]);
    renderMailbox();
    await screen.findByLabelText("会话列表");

    expect(screen.getByRole("link", { name: /搜索消息/ })).toHaveAttribute("href", "/messages/search");
  });

  it("replaces the placeholder with the thread once a conversation is open", async () => {
    givenConversations([conversation()]);
    renderAt("/messages/c1");

    const list = await screen.findByLabelText("会话列表");
    // No longer squeezed to make room for nothing.
    expect(list.className).not.toContain("lg:max-w-sm");
    await waitFor(() =>
      expect(screen.queryByText("从左侧选择一个会话开始阅读。")).not.toBeInTheDocument(),
    );
  });

  it("gives each desktop pane its own scroll area (2026-10-06)", async () => {
    givenConversations([conversation()]);
    renderAt("/messages");

    const list = await screen.findByLabelText("会话列表");
    // Before this the thread's auto-scroll moved the DOCUMENT (measured: 345px),
    // dragging the page header and the whole left column off screen. Bounding the
    // pane is what makes the two columns scroll independently.
    const pane = list.closest("div");
    expect(pane?.className).toContain("lg:overflow-y-auto");
  });

  it("marks the open conversation with aria-current", async () => {
    givenConversations([conversation({ id: "c1" }), conversation({ id: "c2" })]);
    renderAt("/messages/c2");

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

  /*
   * 390 with a conversation open: the mailbox's big header (「私信 / N 条未读 /
   * 新建私信」) used to stay on screen UNDER the thread's own header, so the reader saw
   * two titles stacked. It is now the mailbox's job only.
   */
  it("hides the mailbox page header on mobile while a conversation is open", async () => {
    givenConversations([conversation()]);
    const { container } = renderAt("/messages/c1");
    await screen.findByLabelText("会话列表");

    const header = container.querySelector("header");
    expect(header?.className).toContain("max-lg:hidden");
  });

  it("keeps the mailbox page header when no conversation is open", async () => {
    givenConversations([conversation()]);
    const { container } = renderAt("/messages");
    await screen.findByLabelText("会话列表");

    const header = container.querySelector("header");
    expect(header?.className).not.toContain("max-lg:hidden");
  });
});

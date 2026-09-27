import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import { homeApi } from "@/api/home/home.api";
import type { Conversation } from "@/api/messages/messages.types";
import { AppLayout } from "./AppLayout";

/*
 * The shell's two unread badges, and the message entry itself (Phase 2I-3).
 *
 * The notification badge predates this phase but lives in the same component, so
 * it is pinned here too — a regression in one must not silently take out the
 * other, and both read from different endpoints.
 */
type Handlers = { onMessage?: (conversationId: string, message: unknown) => void };

let socketHandlers: Handlers = {};

vi.mock("@/lib/use-community-chat-socket", () => ({
  useCommunityChatSocket: (_enabled: boolean, handlers: Handlers) => {
    socketHandlers = handlers;
  },
}));

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: { listConversations: vi.fn(async () => []) },
}));

vi.mock("@/api/home/home.api", () => ({
  homeApi: { getGuestHome: vi.fn(async () => ({ unreadNotifications: 0 })) },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { username: "me" }, logout: vi.fn() }),
}));

const mockedMessages = vi.mocked(messagesApi);
const mockedHome = vi.mocked(homeApi);

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    type: "DIRECT",
    title: null,
    updatedAt: null,
    lastMessage: null,
    unreadCount: 0,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: null,
    messages: [],
    ...overrides,
  };
}

function renderShell() {
  return render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  socketHandlers = {};
  mockedMessages.listConversations.mockResolvedValue([]);
  mockedHome.getGuestHome.mockResolvedValue({ unreadNotifications: 0 } as never);
});

describe("AppLayout — message entry", () => {
  it("links to /messages", async () => {
    renderShell();
    expect(await screen.findByRole("link", { name: "私信" })).toHaveAttribute("href", "/messages");
  });

  it("shows no badge when nothing is unread", async () => {
    renderShell();
    const link = await screen.findByRole("link", { name: "私信" });
    expect(link.textContent).toBe("");
  });

  it("sums unreadCount across conversations into the badge", async () => {
    mockedMessages.listConversations.mockResolvedValue([
      conversation({ id: "c1", unreadCount: 2 }),
      conversation({ id: "c2", unreadCount: 1 }),
    ]);
    renderShell();

    expect(await screen.findByRole("link", { name: "私信（3 条未读）" })).toBeInTheDocument();
  });

  it("caps the badge at 99+", async () => {
    mockedMessages.listConversations.mockResolvedValue([conversation({ unreadCount: 150 })]);
    renderShell();

    const link = await screen.findByRole("link", { name: "私信（150 条未读）" });
    expect(link.textContent).toContain("99+");
  });

  it("keeps the notification badge independent of the message badge", async () => {
    mockedHome.getGuestHome.mockResolvedValue({ unreadNotifications: 4 } as never);
    mockedMessages.listConversations.mockResolvedValue([conversation({ unreadCount: 7 })]);
    renderShell();

    expect(await screen.findByRole("link", { name: "通知（4 条未读）" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "私信（7 条未读）" })).toBeInTheDocument();
  });

  it("stays badge-less when the count request fails, rather than shouting about it", async () => {
    mockedMessages.listConversations.mockRejectedValue(new Error("offline"));
    renderShell();

    expect(await screen.findByRole("link", { name: "私信" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes the badge when a message arrives over the socket", async () => {
    renderShell();
    await screen.findByRole("link", { name: "私信" });
    expect(mockedMessages.listConversations).toHaveBeenCalledTimes(1);

    mockedMessages.listConversations.mockResolvedValue([conversation({ unreadCount: 5 })]);
    socketHandlers.onMessage?.("c1", {});

    await waitFor(() => expect(mockedMessages.listConversations).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("link", { name: "私信（5 条未读）" })).toBeInTheDocument();
  });
});

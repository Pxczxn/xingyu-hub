import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { notificationsApi } from "@/api/notifications/notifications.api";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import {
  chatSocket,
  emitChatEvent,
  resetChatSocketDouble,
} from "@/features/chat/chat-socket.test-double";
import { notifyUnreadChanged } from "@/features/notifications/unread-sync";
import { NotificationToastProvider } from "@/features/notifications/toast/NotificationToastProvider";
import { AppLayout } from "./AppLayout";

/*
 * The shell's two unread badges, and the message entry itself.
 *
 * The notification badge predates the message centre but lives in the same component, so
 * it is pinned here too — a regression in one must not silently take out the other, and
 * they read from two different sources on purpose:
 *   - notification badge: `GET /notifications/unread-count` + the unread-sync event
 *   - message badge:     the SHARED conversation list owned by the chat provider
 *
 * 2026-10-06: this component no longer opens a socket or fetches the mailbox itself.
 */
vi.mock("@/features/chat/chat-socket.context", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/chat/chat-socket.context")
  >("@/features/chat/chat-socket.context");
  const double = await import("@/features/chat/chat-socket.test-double");
  return { ...actual, useChatSocket: double.chatSocketValue };
});

vi.mock("@/api/notifications/notifications.api", () => ({
  notificationsApi: { getUnreadCount: vi.fn(async () => 0) },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { username: "me" }, logout: vi.fn() }),
}));

const mockedNotifications = vi.mocked(notificationsApi);

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

function incoming(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "user-them",
    sender: { userId: "user-them", username: "them", displayName: "小明", avatar: null },
    sequenceNumber: 1,
    body: "在吗",
    messageType: "TEXT",
    attachmentUrl: null,
    attachmentName: null,
    attachmentFileId: null,
    createdAt: "2026-09-27T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

function givenUnread(count: number | null): void {
  chatSocket.unreadTotal = count;
  chatSocket.conversations = count === null ? null : [conversation({ unreadCount: count })];
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
  resetChatSocketDouble();
  mockedNotifications.getUnreadCount.mockResolvedValue(0);
});

describe("AppLayout — message entry", () => {
  it("links to /messages", async () => {
    givenUnread(0);
    renderShell();
    expect(await screen.findByRole("link", { name: "私信" })).toHaveAttribute("href", "/messages");
  });

  it("shows no badge when nothing is unread", async () => {
    givenUnread(0);
    renderShell();
    const link = await screen.findByRole("link", { name: "私信" });
    expect(link.textContent).toBe("");
  });

  /*
   * The badge is the shared list's total, so it cannot disagree with the mailbox.
   * `unreadTotal === null` (not read yet) must render as NO badge, never as 0.
   */
  it("reads the badge from the shared conversation list", async () => {
    givenUnread(4);
    renderShell();
    expect(await screen.findByRole("link", { name: "私信（4 条未读）" })).toBeInTheDocument();
  });

  it("draws no badge while the count is still unknown", async () => {
    givenUnread(null);
    renderShell();
    const link = await screen.findByRole("link", { name: "私信" });
    expect(link.textContent).toBe("");
  });

  it("caps the badge at 99+", async () => {
    givenUnread(150);
    renderShell();
    const link = await screen.findByRole("link", { name: "私信（150 条未读）" });
    expect(link.textContent).toContain("99+");
  });

  it("keeps the notification badge independent of the message badge", async () => {
    mockedNotifications.getUnreadCount.mockResolvedValue(4);
    givenUnread(7);
    renderShell();

    expect(await screen.findByRole("link", { name: "通知（4 条未读）" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "私信（7 条未读）" })).toBeInTheDocument();
  });

  it("stays badge-less when the count request fails, rather than shouting about it", async () => {
    mockedNotifications.getUnreadCount.mockRejectedValue(new Error("offline"));
    renderShell();

    expect(await screen.findByRole("link", { name: "通知" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies a notification unread change without a reload", async () => {
    renderShell();
    await screen.findByRole("link", { name: "通知" });
    notifyUnreadChanged(3);
    expect(await screen.findByRole("link", { name: "通知（3 条未读）" })).toBeInTheDocument();
  });

  it("ignores a malformed notification count instead of showing a guess", async () => {
    mockedNotifications.getUnreadCount.mockResolvedValue(4);
    renderShell();
    await screen.findByRole("link", { name: "通知（4 条未读）" });

    notifyUnreadChanged(Number.NaN);
    notifyUnreadChanged(-1);

    expect(screen.getByRole("link", { name: "通知（4 条未读）" })).toBeInTheDocument();
  });
});

describe("AppLayout — live message toast", () => {
  /** The toast stack lives in a provider, so the shell test has to mount it too. */
  function renderShellWithToasts() {
    return render(
      <MemoryRouter>
        <NotificationToastProvider>
          <AppLayout />
        </NotificationToastProvider>
      </MemoryRouter>,
    );
  }

  it("raises a toast for an incoming message from someone else", async () => {
    givenUnread(0);
    chatSocket.myUserId = "user-me";
    renderShellWithToasts();
    await screen.findByRole("link", { name: "私信" });

    emitChatEvent({ kind: "message", conversationId: "c1", message: incoming() });

    expect(await screen.findByText("收到一条新私信")).toBeInTheDocument();
  });

  it("does not toast for our own message (it fans out to our other devices too)", async () => {
    givenUnread(0);
    chatSocket.myUserId = "user-me";
    renderShellWithToasts();
    await screen.findByRole("link", { name: "私信" });

    emitChatEvent({
      kind: "message",
      conversationId: "c1",
      message: incoming({ senderId: "user-me" }),
    });

    await waitFor(() => expect(screen.queryByText("收到一条新私信")).not.toBeInTheDocument());
  });
});

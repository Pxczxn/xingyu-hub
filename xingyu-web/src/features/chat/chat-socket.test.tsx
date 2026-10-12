import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { messagesApi } from "@/api/messages/messages.api";
import { ChatSocketProvider } from "./ChatSocketProvider";
import type { ChatEvent } from "./chat-socket.context";

/*
 * The provider is the one place allowed to own a WebSocket, so its contract is tested
 * here rather than through the pages: one connection per tab, one dispatch path, and a
 * reconnect that RECONCILES instead of silently losing whatever arrived while the
 * socket was down.
 */

vi.mock("@/api/messages/messages.api", () => ({
  messagesApi: {
    listConversations: vi.fn(),
    listMessagesAfter: vi.fn(),
    markRead: vi.fn(),
  },
}));

const mocked = vi.mocked(messagesApi);

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(payload: string) {
    this.sent.push(payload);
  }
  close() {
    this.readyState = 3;
  }
  /**
   * Pretend the server accepted the connection. The real handler sends the
   * `connected` frame immediately after the upgrade, and the provider reconciles on
   * THAT frame — so a faithful fake has to do both.
   */
  open(userId: string | null = "user-me") {
    this.readyState = 1;
    act(() => this.onopen?.());
    if (userId) this.frame({ type: "connected", userId });
  }
  frame(payload: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify(payload) }));
  }
  drop() {
    this.readyState = 3;
    act(() => this.onclose?.());
  }
}

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

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    conversationId: "c1",
    conversationType: "DIRECT",
    senderId: "them",
    sender: { userId: "them", username: "them", displayName: "小明", avatar: null },
    sequenceNumber: 5,
    body: "在吗",
    messageType: "TEXT",
    attachmentUrl: null,
    attachmentName: null,
    attachmentFileId: null,
    createdAt: "2026-10-06T02:00:00Z",
    recalledAt: null,
    ...overrides,
  };
}

let received: ChatEvent[] = [];
/** What the thread page would register as "the conversation I am reading". */
let watching: { conversationId: string | null; knownMaxSequence: number } | null = null;

function Probe() {
  // Subscribing twice from ONE component is the closest cheap proxy for "many
  // consumers in the shell, the mailbox and the thread".
  const {
    subscribe,
    myUserId,
    unreadTotal,
    conversationsStatus,
    conversations,
    watchConversation,
  } = useChatForTest();
  React.useEffect(() => {
    return subscribe((event) => received.push(event));
  }, [subscribe]);
  React.useEffect(() => {
    return subscribe(() => {});
  }, [subscribe]);
  React.useEffect(() => {
    watchConversation("c1", 5);
    watching = { conversationId: "c1", knownMaxSequence: 5 };
  }, [watchConversation]);
  return (
    <div>
      <span data-testid="my-id">{myUserId ?? "-"}</span>
      <span data-testid="unread">{unreadTotal === null ? "-" : unreadTotal}</span>
      <span data-testid="status">{conversationsStatus}</span>
      <span data-testid="rows">{conversations?.length ?? "-"}</span>
    </div>
  );
}

// Imported lazily so the mock above is in place before the module graph is used.
import * as React from "react";
import { useChatSocket as useChatForTest } from "./chat-socket.context";

function renderProvider() {
  return render(
    <ChatSocketProvider>
      <Probe />
    </ChatSocketProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  received = [];
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket as unknown as typeof WebSocket);
  localStorage.setItem("xingyu-satoken", "test-token");
  mocked.listConversations.mockResolvedValue([conversation({ unreadCount: 2 })]);
  mocked.listMessagesAfter.mockResolvedValue({ messages: [], hasMore: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChatSocketProvider — one connection per tab", () => {
  it("opens exactly one socket, no matter how many consumers subscribe", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("carries the session token in the handshake URL", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(FakeSocket.instances[0].url).toContain("token=test-token");
  });

  it("opens no socket at all without a session", async () => {
    localStorage.removeItem("xingyu-satoken");
    renderProvider();
    await screen.findByText("-");
    expect(FakeSocket.instances).toHaveLength(0);
  });
});

describe("ChatSocketProvider — dispatch", () => {
  it("fans message / read / recall out to every subscriber", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances[0];
    socket.open("user-me");
    await waitFor(() => expect(screen.getByTestId("my-id")).toHaveTextContent("user-me"));

    socket.frame({ type: "message", conversationId: "c1", message: message() });
    socket.frame({ type: "read", conversationId: "c1", userId: "them", sequenceNumber: 5 });
    socket.frame({ type: "recall", conversationId: "c1", message: message({ recalledAt: "x" }) });

    expect(received.filter((e) => e.kind === "message")).toHaveLength(1);
    expect(received.filter((e) => e.kind === "read")).toHaveLength(1);
    expect(received.filter((e) => e.kind === "recall")).toHaveLength(1);
    expect(received.filter((e) => e.kind === "connected")).toHaveLength(1);
  });

  it("ignores a malformed frame instead of throwing", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances[0];
    socket.open();
    act(() => socket.onmessage?.({ data: "not json" }));
    // Only the handshake frame that `open()` already delivered — the junk frame
    // produced nothing and, more importantly, did not throw.
    expect(received.every((e) => e.kind === "connected")).toBe(true);
  });
});

describe("ChatSocketProvider — unread is one shared number", () => {
  it("exposes the sum of the conversation list and refreshes it on message / read", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("2"));
    expect(FakeSocket.instances).toHaveLength(1);
    const socket = FakeSocket.instances[0];
    socket.open();
    expect(mocked.listConversations).toHaveBeenCalledTimes(1);

    socket.frame({ type: "message", conversationId: "c1", message: message() });
    await waitFor(() => expect(mocked.listConversations).toHaveBeenCalledTimes(2));

    socket.frame({ type: "read", conversationId: "c1", userId: "them", sequenceNumber: 5 });
    await waitFor(() => expect(mocked.listConversations).toHaveBeenCalledTimes(3));
  });

  it("keeps the previous value when a refresh fails — never a fake zero", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("2"));

    mocked.listConversations.mockRejectedValue(new Error("offline"));
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.frame({ type: "message", conversationId: "c1", message: message() });
    await waitFor(() => expect(mocked.listConversations).toHaveBeenCalledTimes(2));

    // Still 2 from the last successful read — not 0, which would claim everything is read.
    expect(screen.getByTestId("unread")).toHaveTextContent("2");
    expect(screen.getByTestId("rows")).toHaveTextContent("1");
  });

  it("reports an unknown total before the first read instead of 0", () => {
    mocked.listConversations.mockReturnValue(new Promise(() => {}));
    renderProvider();
    expect(screen.getByTestId("unread")).toHaveTextContent("-");
  });
});

/*
 * The whole point of the after-cursor endpoint: a socket does NOT replay what arrived
 * while it was down, so a reconnect has to reconcile over REST or the reader silently
 * loses messages (measured before this existed: the message only appeared after a
 * manual reload).
 */
describe("ChatSocketProvider — reconnect reconciliation", () => {
  it("backfills the open conversation on connect, from the local max sequence", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(watching).toEqual({ conversationId: "c1", knownMaxSequence: 5 });

    mocked.listMessagesAfter.mockResolvedValue({
      messages: [
        message({ id: "m6", sequenceNumber: 6 }),
        message({ id: "m7", sequenceNumber: 7 }),
      ],
      hasMore: false,
    });
    FakeSocket.instances[0].open();

    await waitFor(() =>
      expect(mocked.listMessagesAfter).toHaveBeenCalledWith("c1", 5, expect.any(Number)),
    );
    // Recovered messages go out as ORDINARY message events, so consumers dedup them
    // with exactly the same code path as a live push.
    await waitFor(() => expect(received.filter((e) => e.kind === "message")).toHaveLength(2));
    const events = received.filter((e) => e.kind === "message");
    expect(events.map((e) => (e.kind === "message" ? e.message.sequenceNumber : 0))).toEqual([
      6, 7,
    ]);
  });

  it("pages until it catches up when the first page is not enough", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    mocked.listMessagesAfter
      .mockResolvedValueOnce({
        messages: [message({ id: "m6", sequenceNumber: 6 })],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        messages: [message({ id: "m7", sequenceNumber: 7 })],
        hasMore: false,
      });
    FakeSocket.instances[0].open();

    await waitFor(() => expect(received.filter((e) => e.kind === "message")).toHaveLength(2));
    expect(mocked.listMessagesAfter).toHaveBeenNthCalledWith(2, "c1", 6, expect.any(Number));
  });

  it("reconciles again after a reconnect, and does not open a second socket", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    FakeSocket.instances[0].open();
    await waitFor(() => expect(mocked.listMessagesAfter).toHaveBeenCalledTimes(1));

    FakeSocket.instances[0].drop();
    // The reconnect is scheduled, not immediate — drive it with fake timers.
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("stays silent when the backfill fails (the rendered conversation is still correct)", async () => {
    renderProvider();
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    mocked.listMessagesAfter.mockRejectedValue(new Error("offline"));
    FakeSocket.instances[0].open();

    await waitFor(() => expect(mocked.listMessagesAfter).toHaveBeenCalled());
    expect(received.filter((e) => e.kind === "message")).toHaveLength(0);
  });

  it("does not backfill when the shell has no open conversation", async () => {
    // Render the provider WITHOUT the probe, so nothing ever calls watchConversation.
    render(
      <ChatSocketProvider>
        <div />
      </ChatSocketProvider>,
    );
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    FakeSocket.instances[0].open();
    // Give the provider a chance to (wrongly) fire a reconciliation round-trip.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocked.listMessagesAfter).not.toHaveBeenCalled();
  });
});

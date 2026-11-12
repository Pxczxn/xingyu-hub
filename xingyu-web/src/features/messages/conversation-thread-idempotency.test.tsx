import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { messagesApi } from "@/api/messages/messages.api";
import { ApiError } from "@/api/client";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";
import { chatSocket, resetChatSocketDouble } from "@/features/chat/chat-socket.test-double";
import { ConversationThreadPage } from "./pages/ConversationThreadPage";

/*
 * 2026-11-10 — 私信幂等键（审计 A3）。
 *
 * `SendMessagePayload.clientMessageId` 的契约写在 `api/messages/messages.types.ts:336-341`：
 * 「同 (conversationId, senderId, clientMessageId) 三元组重放时后端返回已有的那条消息」。
 * 这个契约只有在**重试复用同一个 key** 时才有意义。
 *
 * 修之前的实现（`pages/ConversationThreadPage.tsx:412`）每次点击都 `newClientMessageId()`，
 * 于是「超时其实落库了 → 用户点重试 → 新 key」在服务端看来就是两条不同的消息，
 * 对方收到两条。下面三条用例把「key 跟随草稿内容」这个不变量钉住。
 *
 * 独立成一个文件（而不是塞进 `conversation-thread-page.test.tsx`）是为了让幂等契约
 * 自成一组，且不复用那边的夹具常量。
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

function conversation(): Conversation {
  return {
    id: "c1",
    type: "GROUP",
    title: "测试群",
    updatedAt: "2026-09-27T02:00:00Z",
    lastMessage: "你好",
    unreadCount: 0,
    announcement: null,
    announcementUpdatedAt: null,
    joinMode: "OPEN",
    myRole: "MEMBER",
    messages: [],
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

/** 一条「请求发出去了但没等到响应」的失败：用户看到的就是 `SEND_FAILED`。 */
function transportFailure(): Error {
  return new Error("请求超时");
}

async function renderThread() {
  chatSocket.myUserId = ME;
  mocked.getDirect.mockRejectedValue(notFound());
  mocked.getGroup.mockResolvedValue(conversation());
  render(
    <MemoryRouter initialEntries={["/messages/c1"]}>
      <Routes>
        <Route path="/messages/:conversationId" element={<ConversationThreadPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId("page-state-empty");
}

/** 输入草稿并点「发送」。 */
function submit(body: string) {
  fireEvent.change(screen.getByLabelText("消息内容"), { target: { value: body } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
}

/** 之后每一次发送都直接失败（模拟网络不通）。 */
function failSends(): void {
  mocked.sendGroup.mockRejectedValue(transportFailure());
}

/** 从第 n 次 sendGroup 调用里取出请求体的幂等键。 */
function keyOf(callIndex: number): string {
  const payload = mocked.sendGroup.mock.calls[callIndex][1] as {
    body?: string;
    clientMessageId?: string;
  };
  // 没有 key 的请求无法幂等，直接让断言给出可读的失败原因。
  expect(payload.clientMessageId).toEqual(expect.any(String));
  return payload.clientMessageId as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetChatSocketDouble();
  mocked.markRead.mockResolvedValue(undefined);
  mocked.listMessagesAfter.mockResolvedValue({ messages: [], hasMore: false });
  mocked.listMessagesAround.mockResolvedValue({ messages: [], found: false, sequence: 0 });
});

describe("ConversationThreadPage — 幂等键跟随草稿内容", () => {
  /*
   * 这条是审计 A3 的复现用例：第一次发送失败（可能已经在服务端落库，只是响应丢了），
   * 用户不改内容直接再点一次。修复前第二次用的是新 key，服务端会当成第二条消息。
   */
  it("发送失败后原样重试，复用同一个 clientMessageId", async () => {
    await renderThread();
    failSends();

    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(1));
    // 失败后草稿必须还在 —— 用户能「重试」的前提。
    expect(screen.getByLabelText("消息内容")).toHaveValue("在吗");
    expect(await screen.findByRole("alert")).toHaveTextContent("消息发送失败，请重试。");

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(2));

    expect(keyOf(0)).toBe(keyOf(1));
    // 同一次重试必须是同一份内容，否则「同 key」也没有意义。
    expect(mocked.sendGroup.mock.calls[1][1]).toMatchObject({ body: "在吗" });
  });

  it("改动草稿内容后再提交，换成新的 clientMessageId", async () => {
    await renderThread();
    failSends();

    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("消息发送失败，请重试。");

    submit("在吗？我刚看到");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(2));

    expect(keyOf(1)).not.toBe(keyOf(0));
    expect(mocked.sendGroup.mock.calls[1][1]).toMatchObject({ body: "在吗？我刚看到" });
  });

  /*
   * 反过来钉住「发送成功后必须换 key」：否则第二条内容相同的消息会被服务端当成
   * 第一条的重放而返回旧消息，用户看起来就是「点了发送没反应」。
   */
  it("发送成功后重置，再发一条同样的内容用的是新 key", async () => {
    await renderThread();
    const created = message({ id: "m9", senderId: ME, sequenceNumber: 5, body: "在吗" });
    mocked.sendGroup.mockResolvedValue(created);

    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(1));
    // 成功后草稿清空，下一条消息是全新的草稿。
    await waitFor(() => expect(screen.getByLabelText("消息内容")).toHaveValue(""));

    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(2));

    expect(keyOf(1)).not.toBe(keyOf(0));
  });

  it("在还没失败时就换了内容，key 也不会跟着上一次的尝试走", async () => {
    await renderThread();
    failSends();

    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("消息发送失败，请重试。");

    // 改内容 → 改回去 → 再发。草稿已经不是同一次尝试，key 不能沿用。
    submit("在吗？");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(2));
    submit("在吗");
    await waitFor(() => expect(mocked.sendGroup).toHaveBeenCalledTimes(3));

    expect(keyOf(2)).not.toBe(keyOf(0));
  });
});

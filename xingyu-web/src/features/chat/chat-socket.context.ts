import { createContext, useContext } from "react";
import type { ChatMessage, Conversation } from "@/api/messages/messages.types";

/*
 * 社区实时通道的<b>单例</b>契约（2026-10-06 Messages Correctness Recovery）。
 *
 * 为什么需要它：此前 AppLayout / MailboxPage / ConversationThreadPage 各自
 * `useCommunityChatSocket(true, ...)`，同一个人在一个 SPA 里同时握着 3 条 socket；而服务端
 * 每个 userId 只保留一条会话（旧的会被主动 close）。实测三者每 3 秒互相踢一次，一次审计
 * 里产生了 700+ 次连接/断开抖动，「实时收到消息」随时退化成「必须刷新」。
 *
 * 现在整个 tab 只有 Provider 建一条连接，其它组件通过 {@link ChatSocketContextValue.subscribe}
 * 订阅事件流 —— 没有引入 Redux / Zustand，仓库里本来也没有 query client。
 *
 * 职责划分（刻意保持窄）：
 *  - 连接与重连：只有 Provider 做；
 *  - 重连对账：Provider 在每次（重）连上后用 REST 按 `sequence_number` 补齐当前打开会话的
 *    缺失消息，并把补回来的消息<b>当成普通 message 事件派发</b> —— 于是各消费方的去重逻辑
 *    与实时推送完全一致，不需要第二条路径；
 *  - 消息内容与会话状态：仍然由各页面自己持有，Provider 不接管渲染状态。
 */

/** Provider 派发的事件。`message` 既可能是实时推送，也可能是重连对账补回来的。 */
export type ChatEvent =
  | { kind: "connected"; userId: string }
  | { kind: "message"; conversationId: string; message: ChatMessage }
  | { kind: "read"; conversationId: string; userId: string; sequenceNumber: number }
  | { kind: "recall"; conversationId: string; message: ChatMessage };

/** 会话列表的加载状态。三处未读（Header / 行徽标 / 线程）都以它为唯一来源。 */
export type ConversationsStatus = "idle" | "loading" | "ready" | "error";

export type ChatSocketContextValue = {
  /** 连接状态。用于「重连中」提示 —— 之前完全没有这个信号。 */
  connection: "idle" | "connecting" | "open" | "reconnecting";
  /**
   * 本人 userId —— 只来自服务端握手后的 `connected` 帧（`/me` 与 `/me/profile` 都不返回
   * userId）。为 null 时前端不猜「这条是不是我发的」。
   */
  myUserId: string | null;
  /** 订阅事件流，返回取消订阅函数。 */
  subscribe: (handler: (event: ChatEvent) => void) => () => void;
  /** 会话列表：Header 角标与会话行徽标的唯一数据源。 */
  conversations: Conversation[] | null;
  conversationsStatus: ConversationsStatus;
  conversationsError: string | null;
  /**
   * 列表读取失败是否因为会话失效。
   *
   * 单独一个布尔而不是让消费者去猜文案：会话过期要提示「去登录」，而 500 不该把一个
   * 已登录的人赶去登录页 —— 那是两种完全不同的错误。
   */
  conversationsExpired: boolean;
  /** 全账户未读合计（各会话 unreadCount 之和）。null = 尚未读到。 */
  unreadTotal: number | null;
  /** 重新拉会话列表。失败时保留旧值 —— 绝不把失败伪装成 0。 */
  refreshConversations: () => Promise<void>;
  /**
   * 登记「当前打开的会话」与本地已知最大序号。Provider 只对这一个会话做重连对账，
   * 避免为所有会话轮询。序号由调用方给出，因为它才持有消息列表。
   */
  watchConversation: (conversationId: string | null, knownMaxSequence: number) => void;
};

export const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

/**
 * 无 Provider 时的空实现。
 *
 * 和 toast 通道同样的理由：这是一个**辅助**通道（实时提示 + 未读数），即使它完全不工作，
 * 页面读到的也只是 REST 已经给的数据。让缺 Provider 的单测 / 嵌入式视图崩溃没有任何好处。
 */
const NOOP_VALUE: ChatSocketContextValue = {
  connection: "idle",
  myUserId: null,
  subscribe: () => () => {},
  conversations: null,
  conversationsStatus: "idle",
  conversationsError: null,
  conversationsExpired: false,
  unreadTotal: null,
  refreshConversations: async () => {},
  watchConversation: () => {},
};

/**
 * Exported for tests that render a route tree and do not care about chat at all: they
 * can mount without pulling in a provider that would try to open a socket.
 */
export const chatSocketNoopValue = NOOP_VALUE;

export function useChatSocket(): ChatSocketContextValue {
  return useContext(ChatSocketContext) ?? NOOP_VALUE;
}

/*
 * Which conversation the header card is showing right now, and a way for a
 * route to ask that card to open.
 *
 * The shell skips a toast for a message the reader is already looking at.
 * `/messages` and `/messages/:id` hand their target here, then leave, so the
 * card is the mailbox.
 */

export type MessageLocator = { id: string; sequence: number };

export type MessagePanelView = "list" | "thread" | "search";

export type MessagePanelTarget = {
  conversationId: string | null;
  locator: MessageLocator | null;
  view: MessagePanelView;
  query: string | null;
  token: number;
};

let focusedConversationId: string | null = null;
let latest: MessagePanelTarget | null = null;
let token = 0;
const listeners = new Set<(target: MessagePanelTarget) => void>();

export function setMessagePanelFocus(conversationId: string | null): void {
  focusedConversationId = conversationId;
}

export function getMessagePanelFocus(): string | null {
  return focusedConversationId;
}

export function resetMessagePanel(): void {
  latest = null;
  token = 0;
  focusedConversationId = null;
}

export function requestMessagePanel(input: {
  conversationId?: string | null;
  locator?: MessageLocator | null;
  view?: MessagePanelView;
  query?: string | null;
}): void {
  const query = input.query?.trim() ? input.query.trim() : null;
  const next: MessagePanelTarget = {
    conversationId: input.conversationId ?? null,
    locator: input.locator ?? null,
    view: input.view ?? (input.conversationId ? "thread" : "list"),
    query,
    token: ++token,
  };
  latest = next;
  for (const listener of listeners) listener(next);
}

export function subscribeMessagePanel(
  listener: (target: MessagePanelTarget) => void,
): () => void {
  listeners.add(listener);
  if (latest) listener(latest);
  return () => {
    listeners.delete(listener);
  };
}

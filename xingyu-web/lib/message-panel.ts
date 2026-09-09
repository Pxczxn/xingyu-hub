export type MessagePanelOpenRequest = {
  username?: string;
  conversationId?: string;
};

type MessagePanelListener = (request: MessagePanelOpenRequest) => void;

const listeners = new Set<MessagePanelListener>();

export function requestOpenMessagePanel(request: MessagePanelOpenRequest = {}) {
  listeners.forEach((listener) => listener(request));
}

export function subscribeMessagePanel(listener: MessagePanelListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

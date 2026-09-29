import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { resolveChatSocketUrl, useCommunityChatSocket } from "./use-community-chat-socket";
import { setStoredToken } from "./storage";

/*
 * The hook is exercised against a stub WebSocket rather than the real thing:
 * what matters here is the frame dispatch, the reconnect/cleanup behaviour and
 * the URL contract, none of which need a live server.
 */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;

  url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket as unknown as typeof WebSocket);
  setStoredToken("tok-123");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("resolveChatSocketUrl", () => {
  it("builds the handshake URL on the current host when no API base is set", () => {
    expect(resolveChatSocketUrl("abc")).toBe(
      `ws://${window.location.host}/ws/community/chat?token=abc`,
    );
  });

  it("encodes the token so a session with reserved characters cannot break the query", () => {
    expect(resolveChatSocketUrl("a b&c=d")).toContain("token=a%20b%26c%3Dd");
  });
});

describe("useCommunityChatSocket", () => {
  it("does not open a socket when disabled", () => {
    renderHook(() => useCommunityChatSocket(false, {}));
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("does not open a socket when there is no stored session", () => {
    setStoredToken(null as unknown as string);
    renderHook(() => useCommunityChatSocket(true, {}));
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("names our own user id from the connected frame", () => {
    const onConnected = vi.fn();
    renderHook(() => useCommunityChatSocket(true, { onConnected }));

    const socket = FakeSocket.instances[0];
    act(() => {
      socket.open();
      socket.emit({ type: "connected", userId: "u-1" });
    });

    expect(onConnected).toHaveBeenCalledWith("u-1");
  });

  it("dispatches message, read and recall frames with their payloads", () => {
    const onMessage = vi.fn();
    const onRead = vi.fn();
    const onRecall = vi.fn();
    renderHook(() => useCommunityChatSocket(true, { onMessage, onRead, onRecall }));

    const socket = FakeSocket.instances[0];
    const msg = { id: "m1", conversationId: "c1", senderId: "u-2", sequenceNumber: 1 };

    act(() => {
      socket.open();
      socket.emit({ type: "message", conversationId: "c1", message: msg });
      socket.emit({ type: "read", conversationId: "c1", userId: "u-2", sequenceNumber: 3 });
      socket.emit({ type: "recall", conversationId: "c1", message: msg });
    });

    expect(onMessage).toHaveBeenCalledWith("c1", msg);
    expect(onRead).toHaveBeenCalledWith("c1", "u-2", 3);
    expect(onRecall).toHaveBeenCalledWith("c1", msg);
  });

  it("ignores a malformed frame instead of throwing", () => {
    const onMessage = vi.fn();
    renderHook(() => useCommunityChatSocket(true, { onMessage }));

    const socket = FakeSocket.instances[0];
    act(() => {
      socket.open();
      socket.onmessage?.({ data: "not json" });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("pings on an interval so an idle connection is kept alive", () => {
    renderHook(() => useCommunityChatSocket(true, {}));
    const socket = FakeSocket.instances[0];

    act(() => {
      socket.open();
      vi.advanceTimersByTime(30_000);
    });

    expect(socket.sent).toContain(JSON.stringify({ type: "ping" }));
  });

  it("reconnects after a close, and stops for good once unmounted", () => {
    const { unmount } = renderHook(() => useCommunityChatSocket(true, {}));
    const first = FakeSocket.instances[0];

    act(() => {
      first.open();
      first.close();
    });
    expect(FakeSocket.instances).toHaveLength(1); // scheduled, not yet fired

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(FakeSocket.instances).toHaveLength(2);

    unmount();
    const second = FakeSocket.instances[1];
    act(() => {
      second.close();
      vi.advanceTimersByTime(30_000);
    });

    // The Legacy bug this guards against: a stale timer id meant a reconnect
    // could still fire after unmount. Nothing new may be opened here.
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("reads handlers through a ref, so an inline handler does not force a reconnect", () => {
    const { rerender } = renderHook(
      ({ n }) => useCommunityChatSocket(true, { onMessage: vi.fn(() => n) }),
      {
        initialProps: { n: 1 },
      },
    );
    expect(FakeSocket.instances).toHaveLength(1);

    rerender({ n: 2 });
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

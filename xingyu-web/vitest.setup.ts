import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";

/*
 * Raise Testing Library's async-utility budget.
 *
 * Phase 1C-1 made /articles/:articleId and /studio/content/:articleId route-level
 * `lazy()` chunks. In the test environment those chunks are transformed on demand
 * — the article chunk carries micromark/remark/rehype/turndown, the editor chunk
 * carries Milkdown/Crepe/CodeMirror. Under a 30-file parallel run that transform
 * can exceed the 1000 ms default, so `findBy*` intermittently observed the
 * Suspense fallback and failed ("Unable to find role=heading"), even though the
 * route works. That was a flaky-test defect in the 1C-1 test setup, not a product
 * bug: the assertion still fails if the element never appears.
 */
configure({ asyncUtilTimeout: 5000 });

/*
 * jsdom does not implement IntersectionObserver. Milkdown's code-block node
 * view calls it, so the migrated Milkdown editor tests need this mock.
 * Migrated verbatim from Legacy vitest.setup.ts — test-environment parity,
 * not a behavioural change.
 */
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

/*
 * jsdom does not implement matchMedia either. The migrated editor toolbar calls
 * it on mount to pick the narrow/wide segment layout (Legacy ran in a real
 * browser, where it always exists). This mock reports "not narrow" and supports
 * the add/removeEventListener pair the hook subscribes with.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/*
 * jsdom does not implement scrollIntoView, which the editor outline calls when
 * jumping to a heading. No-op it so the outline click path stays testable.
 */
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/*
 * jsdom HAS a WebSocket, and it really tries to connect. Since 2026-10-06 the chat
 * socket lives in `ChatSocketProvider`, which sits above every route — so without
 * this stub each route test that renders `AppProviders` would open a real socket to
 * `localhost:<jsdom port>` and start a 3s reconnect loop that outlives the test.
 *
 * This stub deliberately never opens: `onopen` never fires, so no ping interval is
 * started and no reconnect is scheduled. Tests that care about the socket itself
 * drive `ChatSocketProvider` directly (features/chat/chat-socket.test.tsx) and inject
 * their own fake.
 */
if (typeof globalThis !== "undefined" && !("__VITEST_WS_STUBBED__" in globalThis)) {
  Object.defineProperty(globalThis, "__VITEST_WS_STUBBED__", { value: true });
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 0;
    onopen: ((event: unknown) => void) | null = null;
    onclose: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onmessage: ((event: unknown) => void) | null = null;
    constructor(public url: string) {}
    send() {}
    close() {
      this.readyState = 3;
    }
    addEventListener() {}
    removeEventListener() {}
  }
  Object.defineProperty(globalThis, "WebSocket", {
    writable: true,
    configurable: true,
    value: MockWebSocket,
  });
}

/*
 * jsdom implements Element.getClientRects but NOT Range.getClientRects /
 * Range.getBoundingClientRect. Milkdown's virtual-cursor plugin (pulled in by
 * Crepe) calls them on a cloned Range whenever the editor flushes a DOM
 * mutation, which surfaces as an unhandled error in the editor tests. Return
 * empty geometry — the plugin already falls back to coordsAtPos() when the rect
 * list is empty.
 */
if (typeof Range !== "undefined") {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function getClientRects() {
      return [] as unknown as DOMRectList;
    };
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return new DOMRect(0, 0, 0, 0);
    };
  }
}

afterEach(() => {
  cleanup();
  // Reset persisted auth between tests.
  if (typeof localStorage !== "undefined") localStorage.clear();
  /*
   * Safety net: a test that enables fake timers and then times out can skip its
   * own `finally { useRealTimers() }`, which would deadlock every later test in
   * the file (Testing Library polls with timers). Always restore.
   */
  vi.useRealTimers();
});

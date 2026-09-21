import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

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
});

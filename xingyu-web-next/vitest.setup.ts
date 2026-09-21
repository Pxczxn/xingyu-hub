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

afterEach(() => {
  cleanup();
  // Reset persisted auth between tests.
  if (typeof localStorage !== "undefined") localStorage.clear();
});

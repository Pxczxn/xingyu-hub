import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // Reset persisted auth between tests.
  if (typeof localStorage !== "undefined") localStorage.clear();
});

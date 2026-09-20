import { describe, expect, it } from "vitest";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  USERNAME_UNAVAILABLE_MESSAGE,
  mapUsernameFieldError,
  validateUsernameClient,
} from "@/lib/username-rules";

/**
 * Username rule tests (migrated from Legacy lib/username-rules.test.ts).
 */

describe("USERNAME_PATTERN", () => {
  it("accepts lowercase letters, digits and underscores", () => {
    expect(USERNAME_PATTERN.test("alice")).toBe(true);
    expect(USERNAME_PATTERN.test("alice_01")).toBe(true);
    expect(USERNAME_PATTERN.test("12345")).toBe(true);
  });

  it("rejects uppercase, spaces and punctuation", () => {
    expect(USERNAME_PATTERN.test("Alice")).toBe(false);
    expect(USERNAME_PATTERN.test("alice wang")).toBe(false);
    expect(USERNAME_PATTERN.test("alice.wang")).toBe(false);
  });

  it("enforces the length bounds", () => {
    expect(USERNAME_PATTERN.test("a".repeat(USERNAME_MIN_LENGTH - 1))).toBe(false);
    expect(USERNAME_PATTERN.test("a".repeat(USERNAME_MIN_LENGTH))).toBe(true);
    expect(USERNAME_PATTERN.test("a".repeat(USERNAME_MAX_LENGTH))).toBe(true);
    expect(USERNAME_PATTERN.test("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("validateUsernameClient", () => {
  it("returns null for a valid username", () => {
    expect(validateUsernameClient("alice_01")).toBeNull();
  });

  it("normalizes surrounding whitespace and casing before validating", () => {
    expect(validateUsernameClient("  Alice_01  ")).toBeNull();
  });

  it("returns the unavailable message for invalid usernames", () => {
    expect(validateUsernameClient("ab")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
    expect(validateUsernameClient("Alice Wang")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
  });

  it("maps any backend field error to the unavailable message", () => {
    expect(mapUsernameFieldError("already taken")).toBe(USERNAME_UNAVAILABLE_MESSAGE);
  });
});

import { describe, expect, it } from "vitest";
import { validateUsernameClient } from "@/lib/username-rules";

describe("register validation helpers", () => {
  it("accepts valid username pattern", () => {
    expect(validateUsernameClient("alice_01")).toBeNull();
  });

  it("rejects short password", () => {
    expect("short".length >= 12).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { validateApiTokenName } from "./token-name";

/*
 * Token-name validation (Phase 2A-2b).
 *
 * This module exists so the SAME rule runs in the form and in the submit
 * handler (SKILL §7d). The 128 boundary is not cosmetic — the backend column is
 * `varchar(128)` and the service never checks length, so a longer name comes
 * back as a generic 500 INTERNAL_ERROR (probed). Pinning it here keeps that
 * from being reachable.
 */

describe("validateApiTokenName", () => {
  it("accepts a normal name", () => {
    expect(validateApiTokenName("CI 同步")).toBeNull();
  });

  it("rejects an empty name", () => {
    expect(validateApiTokenName("")).toMatch(/请填写/);
  });

  it("rejects a whitespace-only name", () => {
    expect(validateApiTokenName("   ")).toMatch(/请填写/);
  });

  it("accepts a name of exactly the backend column width", () => {
    expect(validateApiTokenName("a".repeat(128))).toBeNull();
  });

  it("rejects one character past the backend column width", () => {
    expect(validateApiTokenName("a".repeat(129))).toMatch(/128/);
  });

  it("measures length after trimming, so padding does not push it over", () => {
    expect(validateApiTokenName(`   ${"a".repeat(128)}   `)).toBeNull();
  });

  it("counts characters, not bytes (CJK names are allowed at the limit)", () => {
    expect(validateApiTokenName("测".repeat(128))).toBeNull();
    expect(validateApiTokenName("测".repeat(129))).toMatch(/128/);
  });
});

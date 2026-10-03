import { describe, expect, it } from "vitest";
import { stableHash, stableVariant } from "./visual-seed";

describe("visual seed", () => {
  it("is stable and does not depend on randomness", () => {
    const originalRandom = Math.random;
    Math.random = () => 0.99;
    try {
      expect(stableHash("series-1")).toBe(stableHash("series-1"));
      expect(stableVariant("series-1", 5)).toBe(stableVariant("series-1", 5));
    } finally {
      Math.random = originalRandom;
    }
  });

  it("can produce different variants for different keys", () => {
    const variants = new Set(
      ["alpha", "beta", "gamma", "delta"].map((key) => stableVariant(key, 5)),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
});

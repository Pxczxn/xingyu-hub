import { describe, expect, it } from "vitest";
import { STAGGER_MAX_INDEX, STAGGER_STEP_MS, staggerDelay } from "@/lib/stagger";

describe("staggerDelay", () => {
  it("returns 0ms for the first item", () => {
    expect(staggerDelay(0)).toBe("0ms");
  });

  it("steps linearly up to the cap", () => {
    expect(staggerDelay(1)).toBe(`${STAGGER_STEP_MS}ms`);
    expect(staggerDelay(4)).toBe(`${4 * STAGGER_STEP_MS}ms`);
    expect(staggerDelay(STAGGER_MAX_INDEX)).toBe(`${STAGGER_MAX_INDEX * STAGGER_STEP_MS}ms`);
  });

  it("caps the delay so late items never lag behind the reader", () => {
    const capped = staggerDelay(STAGGER_MAX_INDEX);
    expect(staggerDelay(STAGGER_MAX_INDEX + 1)).toBe(capped);
    expect(staggerDelay(500)).toBe(capped);
  });

  it("treats a negative index as the first item", () => {
    expect(staggerDelay(-3)).toBe("0ms");
  });
});

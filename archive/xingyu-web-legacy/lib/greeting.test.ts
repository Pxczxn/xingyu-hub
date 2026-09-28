import { describe, expect, it } from "vitest";
import { getTimeGreeting } from "@/lib/greeting";

describe("getTimeGreeting", () => {
  it("returns dawn greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 3, 0))).toBe("凌晨好");
    expect(getTimeGreeting(new Date(2026, 0, 1, 5, 59))).toBe("凌晨好");
  });

  it("returns morning greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 8, 30))).toBe("早上好");
  });

  it("returns afternoon greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 12, 30))).toBe("下午好");
    expect(getTimeGreeting(new Date(2026, 0, 1, 17, 59))).toBe("下午好");
  });

  it("returns dusk greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 18, 30))).toBe("傍晚好");
    expect(getTimeGreeting(new Date(2026, 0, 1, 19, 59))).toBe("傍晚好");
  });

  it("returns evening greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 20, 0))).toBe("晚上好");
    expect(getTimeGreeting(new Date(2026, 0, 1, 21, 30))).toBe("晚上好");
  });

  it("returns late night greeting", () => {
    expect(getTimeGreeting(new Date(2026, 0, 1, 22, 0))).toBe("深夜好");
    expect(getTimeGreeting(new Date(2026, 0, 1, 23, 59))).toBe("深夜好");
  });
});

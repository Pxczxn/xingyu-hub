import { describe, expect, it } from "vitest";
import { formatFullDate, formatMonthDay, formatRelativeTime } from "./relative-time";

/*
 * Feed timestamps. `now` is always injected so these never depend on the wall
 * clock — a test that calls Date.now() starts failing the moment a boundary
 * drifts under it.
 */

const NOW = Date.parse("2026-09-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it("returns null for missing or unparseable values", () => {
    expect(formatRelativeTime(undefined, NOW)).toBeNull();
    expect(formatRelativeTime(null, NOW)).toBeNull();
    expect(formatRelativeTime("", NOW)).toBeNull();
    expect(formatRelativeTime("not-a-date", NOW)).toBeNull();
  });

  it("treats anything under a minute as 刚刚", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("刚刚");
    expect(formatRelativeTime(ago(MINUTE - 1), NOW)).toBe("刚刚");
  });

  it("counts minutes, hours and days", () => {
    expect(formatRelativeTime(ago(5 * MINUTE), NOW)).toBe("5 分钟前");
    expect(formatRelativeTime(ago(59 * MINUTE), NOW)).toBe("59 分钟前");
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe("3 小时前");
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe("2 天前");
  });

  it("falls back to a full date once the value is over a month old", () => {
    expect(formatRelativeTime(ago(60 * DAY), NOW)).toBe("2026/07/31");
  });

  it("never prints a negative age when the server clock runs ahead", () => {
    expect(formatRelativeTime(new Date(NOW + 5_000).toISOString(), NOW)).toBe("刚刚");
  });
});

describe("formatMonthDay", () => {
  it("formats MM/DD in CST", () => {
    expect(formatMonthDay("2026-12-01T03:00:00Z")).toBe("12/01");
  });

  it("returns null for a missing or unparseable value", () => {
    expect(formatMonthDay(undefined)).toBeNull();
    expect(formatMonthDay("nope")).toBeNull();
  });
});

describe("formatFullDate", () => {
  it("formats YYYY/MM/DD in CST", () => {
    expect(formatFullDate("2026-12-01T03:00:00Z")).toBe("2026/12/01");
  });

  it("returns null for a missing value", () => {
    expect(formatFullDate(null)).toBeNull();
  });
});

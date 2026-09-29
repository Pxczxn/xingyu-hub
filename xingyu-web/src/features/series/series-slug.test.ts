import { describe, expect, it } from "vitest";
import { SERIES_SLUG_PATTERN, isValidSeriesSlug, suggestSeriesSlug } from "./series-slug";

describe("suggestSeriesSlug", () => {
  it("turns 星语开发日志 into xing-yu-kai-fa-ri-zhi", () => {
    expect(suggestSeriesSlug("星语开发日志")).toBe("xing-yu-kai-fa-ri-zhi");
  });

  it("lowercases latin titles and replaces spaces with hyphens", () => {
    expect(suggestSeriesSlug("Hello World")).toBe("hello-world");
  });
});

describe("isValidSeriesSlug", () => {
  it("accepts the backend pattern of 2-64 lowercase letters, digits, and hyphens", () => {
    expect(SERIES_SLUG_PATTERN.source).toBe("^[a-z0-9-]{2,64}$");
    expect(isValidSeriesSlug("xing-yu-kai-fa-ri-zhi")).toBe(true);
    expect(isValidSeriesSlug("a")).toBe(false);
    expect(isValidSeriesSlug("中文slug")).toBe(false);
  });
});

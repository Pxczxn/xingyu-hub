import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_INTERESTS,
  MAX_INTEREST_LABEL_LENGTH,
  normalizeCustomInterestLabel,
  parseInterestsJson,
  splitInterests,
} from "./onboarding-interests";

describe("onboarding interests helpers", () => {
  it("parses a stored JSON string into labels", () => {
    expect(parseInterestsJson('["前端开发","写作"]')).toEqual(["前端开发", "写作"]);
  });

  it("treats null, invalid JSON, and non-arrays as empty", () => {
    expect(parseInterestsJson(null)).toEqual([]);
    expect(parseInterestsJson("not-json")).toEqual([]);
    expect(parseInterestsJson('{"a":1}')).toEqual([]);
  });

  it("splits predefined labels from custom ones", () => {
    expect(splitInterests(["前端开发", "独立游戏"])).toEqual({
      predefined: ["前端开发"],
      custom: ["独立游戏"],
    });
  });

  it("normalises custom labels and keeps the recorded limits", () => {
    expect(normalizeCustomInterestLabel("  播客  制作  ")).toBe("播客 制作");
    expect(MAX_CUSTOM_INTERESTS).toBe(10);
    expect(MAX_INTEREST_LABEL_LENGTH).toBe(20);
  });
});

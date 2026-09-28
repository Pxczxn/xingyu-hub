import { describe, expect, it } from "vitest";
import { getPasswordRuleChecks, validatePasswordClient } from "@/lib/password-rules";

const baseRules = {
  minLength: 6,
  maxLength: 20,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecial: false,
};

describe("password rule helpers", () => {
  it("omits length rule from capsule checks", () => {
    expect(getPasswordRuleChecks("12345", baseRules)).toEqual([]);
    expect(getPasswordRuleChecks("123456", baseRules)).toEqual([]);
  });

  it("includes optional complexity rules from admin config", () => {
    const checks = getPasswordRuleChecks("abc", {
      ...baseRules,
      requireUppercase: true,
      requireNumber: true,
    });

    expect(checks).toEqual([
      { id: "uppercase", label: "包含大写字母", passed: false },
      { id: "number", label: "包含数字", passed: false },
    ]);
  });

  it("rejects short password on submit validation", () => {
    expect(validatePasswordClient("short", { ...baseRules, minLength: 12 })).toBe("密码长度不能少于 12 位");
  });
});

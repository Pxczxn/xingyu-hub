import { describe, expect, it } from "vitest";
import {
  getPasswordRuleChecks,
  passwordRulesHint,
  validatePasswordClient,
} from "@/lib/password-rules";
import type { PasswordPolicy } from "@/api/auth/auth.types";

/**
 * Password rule tests (migrated from Legacy lib/password-rules.test.ts).
 */

const policy: PasswordPolicy = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

describe("validatePasswordClient", () => {
  it("accepts a password satisfying every rule", () => {
    expect(validatePasswordClient("Passw0rd!", policy)).toBeNull();
  });

  it("returns null when no policy is configured", () => {
    expect(validatePasswordClient("anything")).toBeNull();
  });

  it("rejects passwords shorter than minLength", () => {
    expect(validatePasswordClient("Ab1!", policy)).toBe("密码长度不能少于 8 位");
  });

  it("rejects passwords longer than maxLength", () => {
    const long = "Aa1!" + "a".repeat(40);
    expect(validatePasswordClient(long, policy)).toBe("密码长度不能超过 32 位");
  });

  it("rejects passwords missing an uppercase letter", () => {
    expect(validatePasswordClient("password1!", policy)).toBe("密码必须包含大写字母");
  });

  it("rejects passwords missing a lowercase letter", () => {
    expect(validatePasswordClient("PASSWORD1!", policy)).toBe("密码必须包含小写字母");
  });

  it("rejects passwords missing a number", () => {
    expect(validatePasswordClient("Password!", policy)).toBe("密码必须包含数字");
  });

  it("rejects passwords missing a special character", () => {
    expect(validatePasswordClient("Password1", policy)).toBe("密码必须包含特殊字符");
  });

  it("only enforces the rules the policy enables", () => {
    const loose: PasswordPolicy = {
      minLength: 4,
      maxLength: 16,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecial: false,
    };
    expect(validatePasswordClient("abcd", loose)).toBeNull();
  });
});

describe("getPasswordRuleChecks", () => {
  it("returns no checks when no policy is configured", () => {
    expect(getPasswordRuleChecks("Passw0rd!")).toEqual([]);
  });

  it("reports each rule individually", () => {
    const checks = getPasswordRuleChecks("password", policy);
    expect(checks).toEqual([
      { id: "uppercase", label: "包含大写字母", passed: false },
      { id: "lowercase", label: "包含小写字母", passed: true },
      { id: "number", label: "包含数字", passed: false },
      { id: "special", label: "包含特殊字符", passed: false },
    ]);
  });

  it("marks every check as passed for a compliant password", () => {
    const checks = getPasswordRuleChecks("Passw0rd!", policy);
    expect(checks.every((check) => check.passed)).toBe(true);
  });
});

describe("passwordRulesHint", () => {
  it("falls back to a generic hint without a policy", () => {
    expect(passwordRulesHint()).toBe("请设置密码");
  });

  it("describes the configured rules", () => {
    expect(passwordRulesHint(policy)).toBe("密码需包含：8-32 位、大写字母、小写字母、数字、特殊字符");
  });
});

import type { PasswordPolicy } from "@/api/auth/auth.types";

/*
 * Password rules (migrated from Legacy lib/password-rules.ts).
 * The policy shape comes from Legacy PublicConfig.password; we keep a local
 * PasswordPolicy type instead of importing the whole Legacy community API module.
 */

export type PasswordRuleCheck = {
  id: string;
  label: string;
  passed: boolean;
};

const SPECIAL_PATTERN = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/;

export function getPasswordRuleChecks(
  value: string,
  policy?: PasswordPolicy,
): PasswordRuleCheck[] {
  if (!policy) return [];

  const checks: PasswordRuleCheck[] = [];

  if (policy.requireUppercase) {
    checks.push({ id: "uppercase", label: "包含大写字母", passed: /[A-Z]/.test(value) });
  }
  if (policy.requireLowercase) {
    checks.push({ id: "lowercase", label: "包含小写字母", passed: /[a-z]/.test(value) });
  }
  if (policy.requireNumber) {
    checks.push({ id: "number", label: "包含数字", passed: /\d/.test(value) });
  }
  if (policy.requireSpecial) {
    checks.push({ id: "special", label: "包含特殊字符", passed: SPECIAL_PATTERN.test(value) });
  }

  return checks;
}

export function passwordRulesHint(policy?: PasswordPolicy): string {
  if (!policy) return "请设置密码";
  const parts = [`${policy.minLength}-${policy.maxLength} 位`];
  if (policy.requireUppercase) parts.push("大写字母");
  if (policy.requireLowercase) parts.push("小写字母");
  if (policy.requireNumber) parts.push("数字");
  if (policy.requireSpecial) parts.push("特殊字符");
  return `密码需包含：${parts.join("、")}`;
}

export function validatePasswordClient(value: string, policy?: PasswordPolicy): string | null {
  if (!policy) return null;
  if (value.length < policy.minLength) {
    return `密码长度不能少于 ${policy.minLength} 位`;
  }
  if (value.length > policy.maxLength) {
    return `密码长度不能超过 ${policy.maxLength} 位`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(value)) {
    return "密码必须包含大写字母";
  }
  if (policy.requireLowercase && !/[a-z]/.test(value)) {
    return "密码必须包含小写字母";
  }
  if (policy.requireNumber && !/\d/.test(value)) {
    return "密码必须包含数字";
  }
  if (policy.requireSpecial && !SPECIAL_PATTERN.test(value)) {
    return "密码必须包含特殊字符";
  }
  return null;
}

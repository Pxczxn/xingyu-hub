import type { PublicConfig } from "@/lib/community-api";

export type PasswordRuleCheck = {
  id: string;
  label: string;
  passed: boolean;
};

export function getPasswordRuleChecks(value: string, password?: PublicConfig["password"]): PasswordRuleCheck[] {
  if (!password) return [];

  const checks: PasswordRuleCheck[] = [];

  if (password.requireUppercase) {
    checks.push({
      id: "uppercase",
      label: "包含大写字母",
      passed: /[A-Z]/.test(value),
    });
  }
  if (password.requireLowercase) {
    checks.push({
      id: "lowercase",
      label: "包含小写字母",
      passed: /[a-z]/.test(value),
    });
  }
  if (password.requireNumber) {
    checks.push({
      id: "number",
      label: "包含数字",
      passed: /\d/.test(value),
    });
  }
  if (password.requireSpecial) {
    checks.push({
      id: "special",
      label: "包含特殊字符",
      passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value),
    });
  }

  return checks;
}

export function passwordRulesHint(password?: PublicConfig["password"]): string {
  if (!password) return "请设置密码";
  const parts = [`${password.minLength}-${password.maxLength} 位`];
  if (password.requireUppercase) parts.push("大写字母");
  if (password.requireLowercase) parts.push("小写字母");
  if (password.requireNumber) parts.push("数字");
  if (password.requireSpecial) parts.push("特殊字符");
  return `密码需包含：${parts.join("、")}`;
}

export function validatePasswordClient(value: string, password?: PublicConfig["password"]): string | null {
  if (!password) return null;
  if (value.length < password.minLength) {
    return `密码长度不能少于 ${password.minLength} 位`;
  }
  if (value.length > password.maxLength) {
    return `密码长度不能超过 ${password.maxLength} 位`;
  }
  if (password.requireUppercase && !/[A-Z]/.test(value)) {
    return "密码必须包含大写字母";
  }
  if (password.requireLowercase && !/[a-z]/.test(value)) {
    return "密码必须包含小写字母";
  }
  if (password.requireNumber && !/\d/.test(value)) {
    return "密码必须包含数字";
  }
  if (password.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value)) {
    return "密码必须包含特殊字符";
  }
  return null;
}

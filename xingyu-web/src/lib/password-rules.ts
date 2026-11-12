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

const SPECIAL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/*
 * 审计 A4：`/api/v1/public/config` 拉不到时，旧实现 `if (!policy) return null`
 * 让前端**彻底不校验**——1 位密码也能提交，被后端 400 打回；强制改密页更糟，
 * 用户拿不到任何规则，看起来像「改不完就不能进站」。
 *
 * 因此 policy 缺失时不再放行，而是回退到这个内置下限。阈值依据（不是猜的）：
 * 后端 `SystemConfigHelper` 的编译期默认值就是 minLength 6 / maxLength 20
 * （`getPasswordMinLength()` = `getInt(..., "minLength", 6)`、
 *  `getPasswordMaxLength()` = `getInt(..., "maxLength", 20)`），
 * 四个 `require*` 走 `getBoolean(group, key)`，其默认值是 false。
 * 也就是说：默认部署下「前端放行 ⇒ 后端也放行」，不会误拒。
 *
 * 为什么只回退长度、不追加「必须含字母与数字」这类组合规则：配置里的
 * `require*` 可能是任意组合，我们看不到是哪几条，猜错就是误拒；而长度下限
 * 已经消掉 A4 的真实后果（空密码、1 位密码被前端放行）。回退态靠
 * `usingFallbackPasswordPolicy()` / `PASSWORD_POLICY_FALLBACK_NOTICE` 显式暴露，
 * 由页面告诉用户「这是默认规则」，而不是假装一切正常。
 */
export const FALLBACK_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 6,
  maxLength: 20,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecial: false,
};

/** true = policy 没拿到，正在用内置下限（页面据此追加说明行）。 */
export function usingFallbackPasswordPolicy(policy?: PasswordPolicy): boolean {
  return policy == null;
}

/** 真正参与校验的策略：调用方给了就用调用方的，否则用内置下限。 */
export function resolvePasswordPolicy(policy?: PasswordPolicy): PasswordPolicy {
  return policy ?? FALLBACK_PASSWORD_POLICY;
}

/**
 * 回退态下给用户的那一行说明。文案里的位数从 `FALLBACK_PASSWORD_POLICY` 推导，
 * 避免阈值改了文案没改。
 *
 * 这里**不写**「含字母和数字」：回退策略的四个 `require*` 都是 false（后端默认值），
 * 说了就等于承诺一条并不执行的规则——用户照着改也会被后端按默认值放行，
 * 反而把「宽松」讲成了「严格」。只陈述真正生效的那一条。
 */
export const PASSWORD_POLICY_FALLBACK_NOTICE = `暂时无法获取密码规则，已使用默认规则（密码至少 ${FALLBACK_PASSWORD_POLICY.minLength} 位）`;

export function getPasswordRuleChecks(value: string, policy?: PasswordPolicy): PasswordRuleCheck[] {
  const effective = resolvePasswordPolicy(policy);
  const checks: PasswordRuleCheck[] = [];

  if (effective.requireUppercase) {
    checks.push({ id: "uppercase", label: "包含大写字母", passed: /[A-Z]/.test(value) });
  }
  if (effective.requireLowercase) {
    checks.push({ id: "lowercase", label: "包含小写字母", passed: /[a-z]/.test(value) });
  }
  if (effective.requireNumber) {
    checks.push({ id: "number", label: "包含数字", passed: /\d/.test(value) });
  }
  if (effective.requireSpecial) {
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
  const effective = resolvePasswordPolicy(policy);
  if (value.length < effective.minLength) {
    return `密码长度不能少于 ${effective.minLength} 位`;
  }
  if (value.length > effective.maxLength) {
    return `密码长度不能超过 ${effective.maxLength} 位`;
  }
  if (effective.requireUppercase && !/[A-Z]/.test(value)) {
    return "密码必须包含大写字母";
  }
  if (effective.requireLowercase && !/[a-z]/.test(value)) {
    return "密码必须包含小写字母";
  }
  if (effective.requireNumber && !/\d/.test(value)) {
    return "密码必须包含数字";
  }
  if (effective.requireSpecial && !SPECIAL_PATTERN.test(value)) {
    return "密码必须包含特殊字符";
  }
  return null;
}

"use client";

import type { PublicConfig } from "@/lib/community-api";
import { getPasswordRuleChecks } from "@/lib/password-rules";
import { RuleCapsules } from "@/components/ui/rule-capsules";

type PasswordRuleHintsProps = {
  value: string;
  rules?: PublicConfig["password"];
  className?: string;
};

export function PasswordRuleHints({ value, rules, className }: PasswordRuleHintsProps) {
  const checks = getPasswordRuleChecks(value, rules);

  return (
    <RuleCapsules
      className={className}
      ariaLabel="密码要求"
      live="polite"
      items={checks.map((check) => ({
        id: check.id,
        label: check.label,
        status: check.passed ? "pass" : "fail",
      }))}
    />
  );
}

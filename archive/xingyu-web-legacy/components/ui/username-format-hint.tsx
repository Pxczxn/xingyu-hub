"use client";

import { USERNAME_FORMAT_RULES } from "@/lib/username-rules";
import { RuleCapsules } from "@/components/ui/rule-capsules";

type UsernameFormatHintProps = {
  className?: string;
};

export function UsernameFormatHint({ className }: UsernameFormatHintProps) {
  return (
    <RuleCapsules
      className={className}
      ariaLabel="用户名格式"
      items={USERNAME_FORMAT_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        status: "neutral",
      }))}
    />
  );
}

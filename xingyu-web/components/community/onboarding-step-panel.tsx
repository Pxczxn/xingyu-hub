import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type OnboardingStepPanelProps = {
  stepKey: string;
  className?: string;
  children: ReactNode;
};

export function OnboardingStepPanel({ stepKey, className, children }: OnboardingStepPanelProps) {
  return (
    <div key={stepKey} className={cn("xy-onboarding-step-enter", className)}>
      {children}
    </div>
  );
}

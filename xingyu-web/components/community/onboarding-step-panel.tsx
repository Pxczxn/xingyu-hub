import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./onboarding-step-panel.module.css";

type OnboardingStepPanelProps = {
  stepKey: string;
  className?: string;
  children: ReactNode;
};

export function OnboardingStepPanel({ stepKey, className, children }: OnboardingStepPanelProps) {
  return (
    <div key={stepKey} className={cn(styles.stepEnter, className)}>
      {children}
    </div>
  );
}

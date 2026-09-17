import styles from "./review-detail.module.css";
import { cn } from "@/lib/utils";
import { REVIEW_STEPS, resolveReviewStepStates } from "./review-detail-meta";

type ReviewStepBarProps = {
  status: string;
};

export function ReviewStepBar({ status }: ReviewStepBarProps) {
  const stepStates = resolveReviewStepStates(status);
  const withdrawn = status.toUpperCase() === "WITHDRAWN";

  return (
    <ol className={cn(styles.steps)} aria-label="审核流程">
      {REVIEW_STEPS.map((label, index) => {
        const state = stepStates[index] ?? "upcoming";
        return (
          <li
            key={label}
            className={cn(
              state === "done" && styles.isDone,
              state === "current" && styles.isCurrent,
              withdrawn && state === "current" && styles.isMuted,
            )}
          >
            <i aria-hidden="true">
              {state === "done" ? <span className={cn(styles.stepCheck)} /> : index + 1}
            </i>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

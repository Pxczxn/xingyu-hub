import { REVIEW_STEPS, resolveReviewStepStates } from "./review-detail-meta";

type ReviewStepBarProps = {
  status: string;
};

export function ReviewStepBar({ status }: ReviewStepBarProps) {
  const stepStates = resolveReviewStepStates(status);
  const withdrawn = status.toUpperCase() === "WITHDRAWN";

  return (
    <ol className="xy-review-steps" aria-label="审核流程">
      {REVIEW_STEPS.map((label, index) => {
        const state = stepStates[index] ?? "upcoming";
        return (
          <li
            key={label}
            className={`is-${state}${withdrawn && state === "current" ? " is-muted" : ""}`}
          >
            <i aria-hidden="true">
              {state === "done" ? <span className="xy-review-step-check" /> : index + 1}
            </i>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

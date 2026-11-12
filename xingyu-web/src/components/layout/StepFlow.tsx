import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

/*
 * StepFlow — the step rail plus the sticky action bar.
 *
 * BELONGS TO: SK5 流程 (login/register, new submission, new appeal, series
 * create/edit, invitations, onboarding, re-auth). The page ends on exactly one
 * terminal action; there are no side rails and no second entry point.
 * AXIS: SK5 skeleton (centred narrow column + committed action) with the D
 * value applied to the field groups.
 *
 * The step rail degrades below `md` to a single line of text ("第 2/3 步 ·
 * …"), because three labelled steps plus their numbers cannot hold a 390px
 * width without truncating the labels into meaninglessness.
 *
 * The action bar is `sticky bottom-0` and carries a border, not a shadow: E1
 * is reserved for surfaces that leave the document flow (B §3), and a sticky
 * bar in the flow is not one. Its translucent fill plus backdrop blur is what
 * keeps the field above it legible while the bar is parked over it — the bar
 * must never cover a focused control, so callers keep their field groups
 * inside the scrolling column, not under the bar.
 */
export type StepFlowStep = {
  /** Stable key; also what a page uses to name the step in tests. */
  id: string;
  label: string;
};

export type StepFlowProps = {
  steps: readonly StepFlowStep[];
  /** Current step, 1-based. Steps before it render as completed. */
  current: number;
  /** Field groups for the current step. */
  children: ReactNode;
  /** Terminal action(s) — submit, back, cancel. */
  actions: ReactNode;
  /** Accessible name for the step list. */
  label?: string;
  /** Single-step forms are narrower (640) than multi-step ones (720). */
  width?: "single" | "multi";
  className?: string;
};

const WIDTH: Record<NonNullable<StepFlowProps["width"]>, string> = {
  single: "max-w-[640px]",
  multi: "max-w-[720px]",
};

export function StepFlow({
  steps,
  current,
  children,
  actions,
  label,
  width = "multi",
  className,
}: StepFlowProps) {
  const headingId = useId();
  const total = steps.length;
  const activeStep = steps[Math.min(Math.max(current, 1), total) - 1];

  return (
    <div role="group" aria-labelledby={headingId} className={cn("mx-auto w-full", WIDTH[width], className)}>
      <h2 id={headingId} className="sr-only">
        {label ?? "步骤"}
      </h2>

      <ol aria-label={label ?? "步骤"} className="hidden items-center gap-3 md:flex">
        {steps.map((step, index) => {
          const number = index + 1;
          const isCurrent = number === current;
          const isDone = number < current;

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-pill border text-caption tabular-nums",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isDone && !isCurrent && "border-border-strong text-muted-foreground",
                )}
              >
                {number}
              </span>
              <span
                className={cn(
                  "truncate text-meta",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {number < total ? <span aria-hidden className="h-px w-5 shrink-0 bg-border" /> : null}
            </li>
          );
        })}
      </ol>

      <p className="text-meta text-muted-foreground md:hidden">
        第 {current}/{total} 步{activeStep ? ` · ${activeStep.label}` : null}
      </p>

      <div className="density-compact mt-6">{children}</div>

      <div className="sticky bottom-0 z-rail -mx-4 mt-8 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}

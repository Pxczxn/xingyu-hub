"use client";

import { Fragment, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "WELCOME", label: "欢迎" },
  { key: "INTERESTS", label: "兴趣" },
  { key: "PROFILE", label: "资料" },
  { key: "FOLLOWS", label: "关注" },
  { key: "DONE", label: "完成" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

type StepStatus = "past" | "current" | "future";

function getStepStatus(index: number, currentIndex: number): StepStatus {
  if (index < currentIndex) return "past";
  if (index === currentIndex) return "current";
  return "future";
}

function StepConnector({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}) {
  return (
    <span
      className={cn(
        "mt-3.5 h-px w-3 shrink-0 sm:w-4 lg:w-6",
        active ? "bg-accent/40" : "bg-border/80",
        !reducedMotion && "transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
      )}
      aria-hidden="true"
    />
  );
}

function StepNode({
  index,
  label,
  status,
  reducedMotion,
}: {
  index: number;
  label: string;
  status: StepStatus;
  reducedMotion: boolean;
}) {
  const isPast = status === "past";
  const isCurrent = status === "current";
  const isFuture = status === "future";

  return (
    <div
      className={cn(
        "flex w-[3.25rem] shrink-0 flex-col items-center gap-1.5 sm:w-[4.5rem] lg:w-[5rem]",
        !reducedMotion && "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        isCurrent && "scale-100 opacity-100",
        isPast && "scale-[0.94] opacity-85",
        isFuture && "scale-[0.94] opacity-55"
      )}
      aria-current={isCurrent ? "step" : undefined}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full font-semibold tabular-nums",
          !reducedMotion && "transition-[width,height,background-color,color,border-color,box-shadow] duration-500 ease-out motion-reduce:transition-none",
          isCurrent && "h-8 w-8 border-2 border-accent bg-card text-foreground shadow-[0_1px_4px_rgb(var(--accent)/0.18)]",
          isPast && "h-7 w-7 bg-accent text-accent-foreground",
          isFuture && "h-7 w-7 border border-border bg-muted/80 text-muted-foreground"
        )}
      >
        {isPast ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <span className={cn("text-[11px]", isCurrent && "text-xs font-semibold")}>{index + 1}</span>
        )}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-center leading-tight",
          !reducedMotion && "transition-[font-size,color,font-weight] duration-500 ease-out motion-reduce:transition-none",
          isCurrent && "text-sm font-semibold text-foreground",
          isPast && "text-[11px] text-muted-foreground sm:text-xs",
          isFuture && "text-[11px] text-muted-foreground/55 sm:text-xs"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function OnboardingStepNav({ currentStep }: { currentStep: string }) {
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.key === currentStep));
  const current = STEPS[currentIndex];
  const progressPercent = ((currentIndex + 1) / STEPS.length) * 100;
  const isFinalStep = currentIndex === STEPS.length - 1;

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(mediaQuery.matches);
    syncMotion();
    mediaQuery.addEventListener("change", syncMotion);
    return () => mediaQuery.removeEventListener("change", syncMotion);
  }, []);

  if (isFinalStep) {
    return (
      <nav aria-label="引导步骤" className="mt-2 w-full">
        <div className="flex items-center justify-between gap-3 border-y border-[rgb(var(--accent)/.22)] py-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            入门设置已完成
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{STEPS.length} 项设置已保存</span>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="引导步骤" className="mt-2 w-full">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          第 <span className="font-semibold tabular-nums text-foreground">{currentIndex + 1}</span>
          <span className="text-muted-foreground"> / {STEPS.length} 步</span>
        </p>
        <p className="text-sm font-medium text-foreground">{current?.label}</p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={currentIndex + 1}
        aria-label={`入门引导进度，第 ${currentIndex + 1} 步，共 ${STEPS.length} 步`}
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/80"
      >
        <div
          className={cn(
            "h-full rounded-full bg-accent/70",
            !reducedMotion && "transition-[width] duration-500 ease-out"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-3 flex w-full justify-center">
        <ol className="flex max-w-full flex-wrap items-start justify-center sm:flex-nowrap">
          {STEPS.map((step, index) => {
            const status = getStepStatus(index, currentIndex);

            return (
              <Fragment key={step.key}>
                {index > 0 ? (
                  <StepConnector active={index <= currentIndex} reducedMotion={reducedMotion} />
                ) : null}
                <li>
                  <StepNode
                    index={index}
                    label={step.label}
                    status={status}
                    reducedMotion={reducedMotion}
                  />
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>

      <p className="sr-only">
        当前步骤：{current?.label}。已完成 {currentIndex} 步，剩余 {STEPS.length - currentIndex - 1} 步。
      </p>
    </nav>
  );
}

export { STEPS, type StepKey };

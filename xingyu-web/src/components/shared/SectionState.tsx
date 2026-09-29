import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Per-section state wrapper used by Home so that a failing non-critical
 * endpoint only degrades its own section (never blanks the whole page).
 */

export type SectionStatus = "loading" | "ready" | "empty" | "error";

type SectionStateProps = {
  status: SectionStatus;
  /** Rendered when status === "ready" and there is content. */
  children?: ReactNode;
  emptyText?: string;
  errorText?: string;
  className?: string;
};

export function SectionState({
  status,
  children,
  emptyText = "暂无内容",
  errorText = "该板块加载失败",
  className,
}: SectionStateProps) {
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="section-loading"
        className={cn("rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground", className)}
      >
        加载中…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        data-testid="section-error"
        className={cn("rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground", className)}
      >
        {errorText}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div
        data-testid="section-empty"
        className={cn("rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground", className)}
      >
        {emptyText}
      </div>
    );
  }

  return <>{children}</>;
}

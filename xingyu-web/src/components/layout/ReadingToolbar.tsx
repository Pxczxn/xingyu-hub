import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

/*
 * ReadingToolbar — the sticky reading bar.
 *
 * BELONGS TO: SK7 阅读器 only (public series reading, rules). No other
 * archetype owns reading preferences, so this must not become the generic page
 * header: SK1 reads an article with a masthead, SK7 "reads a book", and the
 * difference is exactly this bar plus the full-bleed header image.
 * AXIS: SK7 skeleton + R = 出 (the band above it bleeds full width).
 *
 * It parks directly under the shell header via `--shell-header-height`, so it
 * does not need to know the header's height and does not overlap it when that
 * height changes. `z-rail` (not a literal) keeps it under the header, menus
 * and every overlay.
 *
 * `progress` is presentational only: 0–100, clamped here so a rounding error
 * upstream cannot produce an out-of-range ARIA value.
 */
export type ReadingToolbarProps = {
  /** Accessible name of the control strip. */
  label: string;
  /** Controls: font size, layout, contents. */
  children: ReactNode;
  /** Reading progress, 0–100. Omit to render no bar. */
  progress?: number;
  className?: string;
};

export function ReadingToolbar({ label, children, progress, className }: ReadingToolbarProps) {
  const headingId = useId();
  const clamped =
    typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : undefined;

  return (
    <div
      className={cn(
        "sticky top-[var(--shell-header-height)] z-rail border-b border-border/60 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <h2 id={headingId} className="sr-only">
        {label}
      </h2>

      <div
        role="group"
        aria-labelledby={headingId}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 md:px-6"
      >
        {children}
      </div>

      {clamped === undefined ? null : (
        <div
          role="progressbar"
          aria-label={`${label} 进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
          className="h-0.5 w-full bg-border/60"
        >
          <div
            aria-hidden
            className="h-full bg-accent transition-[width] duration-micro ease-standard"
            style={{ width: `${clamped}%` }}
          />
        </div>
      )}
    </div>
  );
}

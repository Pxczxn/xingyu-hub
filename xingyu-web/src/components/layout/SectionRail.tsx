import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

/*
 * `tabIndex` on the rail is deliberate and is what A §5 asks for: a scrollable
 * pane must be reachable from the keyboard (the rule cannot see that the
 * element scrolls). Same ruling, same disable, as DiscoverReadingPanel.tsx:251.
 */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable rail. */

/*
 * SectionRail — the sticky side rail.
 *
 * BELONGS TO: SK1 阅读栏 / SK3 控制台 / SK6 信息流 (the trailing 220–300 rail)
 * and SK7 阅读器 (the same object on the leading edge, as a contents rail).
 * AXIS: R = 错 — this is the "main column + side track" rhythm that breaks a
 * single vertical column.
 *
 * Presentational only: it owns stickiness, scrolling and the landmark, never
 * content. The headless `<h2>` exists so the rail is announced by name
 * (A §5: side rails must be semanticised) without inventing a visible title
 * that every caller would then have to suppress.
 *
 * `self-start` and the bounded `max-h` are load-bearing and were measured as
 * failures on the mailbox split pane: a stretched grid item sizes to its
 * neighbour, so the rail grows with the content instead of scrolling, and the
 * sticky offset then never engages.
 */
export type SectionRailProps = {
  /** Landmark name. Rendered as a visually hidden `<h2>`. */
  label: string;
  children: ReactNode;
  className?: string;
};

export function SectionRail({ label, children, className }: SectionRailProps) {
  const headingId = useId();

  return (
    <aside
      aria-labelledby={headingId}
      tabIndex={0}
      className={cn(
        "focus-ring min-w-0 rounded-card",
        "lg:sticky lg:top-[calc(var(--shell-header-height)+1rem)] lg:self-start",
        "lg:max-h-[calc(100vh-var(--shell-header-height)-2rem)] lg:overflow-y-auto lg:pr-1",
        className,
      )}
    >
      <h2 id={headingId} className="sr-only">
        {label}
      </h2>
      {children}
    </aside>
  );
}

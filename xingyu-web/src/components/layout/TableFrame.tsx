import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* The horizontal scroll box is a keyboard-reachable region (A §5: a wide table
 * must not require a mouse); the rule cannot detect scrollability. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable table box. */

/*
 * TableFrame — the shell around a comparable data table.
 *
 * BELONGS TO: SK3 控制台 where the D value is 表 (analytics, content lists,
 * versions, API tokens, email, series articles, galaxy members). Only for data
 * that is genuinely comparable; a decorative grid is SK2's job.
 * AXIS: D = 表 (column-aligned, sortable, undecorated).
 *
 * The shell owns: the card edge (E0 — border only, never a shadow; a table is
 * in the document flow), the toolbar strip, the horizontal scroll box, the
 * accessible caption, and the empty-state slot. It owns NO copy: when there is
 * nothing to show, the caller passes the empty state (usually `PageState`) and
 * no table is rendered at all — an empty `<table>` with a header row is a
 * stronger lie than no table.
 *
 * The scroll box is a labelled region with `tabIndex={0}` so a keyboard user
 * can scroll a wide table without a mouse; the focus ring is visible on it for
 * the same reason every other focusable pane has one.
 */
export type TableFrameProps = {
  /** Accessible name of the table. Rendered as a visually hidden `<caption>`. */
  caption: string;
  /** `<thead>` / `<tbody>` rows. */
  children: ReactNode;
  /** Filter / bulk-action strip above the table. */
  toolbar?: ReactNode;
  /** When provided, replaces the table entirely. */
  emptyState?: ReactNode;
  className?: string;
};

/** Cell/header styling shared by every SK3 table that uses this shell. */
const CELLS = cn(
  "[&_caption]:sr-only",
  "[&_th]:border-b [&_th]:border-border/70 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
  "[&_thead_th]:bg-surface-sunken [&_thead_th]:text-meta [&_thead_th]:text-muted-foreground",
  "[&_td]:border-b [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top",
  "[&_tbody_tr:last-child_td]:border-b-0",
);

export function TableFrame({
  caption,
  children,
  toolbar,
  emptyState,
  className,
}: TableFrameProps) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-card border border-border/70 bg-card",
        className,
      )}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          {toolbar}
        </div>
      ) : null}

      {emptyState ? (
        <div className="px-4 py-10">{emptyState}</div>
      ) : (
        <div
          role="region"
          aria-label={caption}
          tabIndex={0}
          className="focus-ring overflow-x-auto"
        >
          <table className={cn("w-full border-collapse text-body", CELLS)}>
            <caption className="sr-only">{caption}</caption>
            {children}
          </table>
        </div>
      )}
    </div>
  );
}

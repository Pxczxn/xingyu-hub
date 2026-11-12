import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Both panes are scroll containers, so both carry `tabIndex={0}` (A §5 — the
 * pre-batch MailboxPage:180-185 lacked it and a keyboard user could not scroll
 * either column). The rule cannot detect scrollability, hence the disable.
 */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable panes. */

/*
 * SplitPane — the fixed-height master/detail pair.
 *
 * BELONGS TO: SK4 收件箱 only (mailbox, thread, notifications, message search,
 * saved messages). It is the one archetype where THE PAGE ITSELF DOES NOT
 * SCROLL and the two panes scroll independently.
 * AXIS: the SK4 skeleton itself; it is the structural difference from SK1,
 * which also has a side track but scrolls as one document.
 *
 * Extracted from `features/messages/pages/MailboxPage.tsx:164-185` without
 * changing that page. Three details are copied because each was measured as a
 * failure there:
 *   - no `items-start`: a content-sized grid row makes a child's `h-full`
 *     resolve against an auto height, so the pane grows instead of scrolling;
 *   - the row is `minmax(0,1fr)`, not `1fr`, which is what allows it to shrink
 *     below its content;
 *   - both panes carry `min-h-0` for the same reason.
 *
 * Below `lg` there is no room for two columns on a phone, so one pane shows at
 * a time; the page owns which one (`mobileView`) and the way back.
 */
export type SplitPaneProps = {
  /** Left column: the list of items. */
  list: ReactNode;
  /** Right column: the selected item. May be null — then `detailEmpty` shows. */
  detail: ReactNode;
  /** Accessible name for each pane (both are scroll regions). */
  listLabel: string;
  detailLabel: string;
  /**
   * Statement shown instead of a blank pane when nothing is selected
   * (A · SK4: the detail column must never be an empty box).
   */
  detailEmpty?: ReactNode;
  /** Which pane is visible below `lg`. */
  mobileView?: "list" | "detail";
  /** Left column width at `lg` and up. */
  listWidth?: 280 | 320 | 360;
  className?: string;
};

const LIST_COLUMNS: Record<NonNullable<SplitPaneProps["listWidth"]>, string> = {
  280: "lg:grid-cols-[280px_minmax(0,1fr)]",
  320: "lg:grid-cols-[320px_minmax(0,1fr)]",
  360: "lg:grid-cols-[360px_minmax(0,1fr)]",
};

export function SplitPane({
  list,
  detail,
  listLabel,
  detailLabel,
  detailEmpty,
  mobileView = "list",
  listWidth = 320,
  className,
}: SplitPaneProps) {
  return (
    <div
      className={cn(
        // 12rem = shell header (61px) + page padding + one breathing row, the
        // same offset the mailbox measured its panes against.
        "lg:grid lg:gap-6 lg:h-[calc(100vh-12rem)] lg:grid-rows-[minmax(0,1fr)]",
        LIST_COLUMNS[listWidth],
        className,
      )}
    >
      <div
        role="group"
        aria-label={listLabel}
        tabIndex={0}
        className={cn(
          "focus-ring min-w-0 rounded-card lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1",
          mobileView === "detail" && "max-lg:hidden",
        )}
      >
        {list}
      </div>

      <section
        aria-label={detailLabel}
        tabIndex={0}
        className={cn(
          "focus-ring min-w-0 rounded-card lg:h-full lg:min-h-0 lg:overflow-y-auto",
          mobileView === "list" && "max-lg:hidden",
        )}
      >
        {detail ?? detailEmpty}
      </section>
    </div>
  );
}

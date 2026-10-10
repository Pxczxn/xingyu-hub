import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * HomeMasthead — the home page's OWN opening block (A0, 2026-10-04).
 *
 * WHY THIS IS NOT <PageHero>
 * --------------------------
 * PageHero is a BANNER: a bordered card holding a left text column and a right
 * illustration slot, with the page actions stacked under the description. That
 * shape is right for a landing surface that has to sell something. It is wrong
 * for a community home, where the first screen's job is to start the reader
 * reading, and the measured cost of the banner shape was concrete:
 *
 *   - the text column came out 448px wide — not a designed value, but whatever
 *     the max-content width of the description sentence happened to be, because
 *     a flex item with no grow sizes to its content;
 *   - `justify-between` then pushed the 269px artwork to the far right, leaving
 *     377px of the 1152px banner — a third of it — as empty space between two
 *     things that had no reason to be far apart;
 *   - and the card's own border made it a second white surface stacked above the
 *     feed panel, so the page read as two boxes rather than one page.
 *
 * What replaces it keeps the VISUAL PRIMITIVES (.eyebrow, text-display, .lede,
 * buttonVariants) and drops the COMPOSITION. Concretely:
 *
 *   1. No surface. No card, no border, no radius — so the masthead is not a
 *      sibling box of the feed, it is the top of the same column.
 *   2. No illustration and therefore no illustration slot to leave a hole.
 *   3. The page actions sit on the masthead's baseline row, at the trailing
 *      edge, instead of stacked under the description. A masthead is a header
 *      LINE; stacking the actions is what made the old block read as a banner.
 *   4. Below `md` the action row wraps under the text on its own — no separate
 *      compact mode, no second set of paddings to keep in sync.
 *
 * The left edge is the shell's content edge, which is the same edge the tabs and
 * the feed panel below already use. That is what makes 陈述 → 选择 → 内容 read as
 * one continuous column rather than three stacked bands.
 *
 * Presentational only: this component owns LAYOUT, never copy. The page decides
 * what a guest and a signed-in reader each see, so the two voices live in one
 * place (HomePage) instead of being split across a layout file.
 */

export function HomeMasthead({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Guest-only actions, baseline-aligned at the trailing edge. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {/*
       * `justify-between` is deliberately NOT used here.
       *
       * With it, the action cluster was pushed to the far right edge (x≈1104) while
       * the text block ended at x≈573 — a 530px gap, which is the same defect the
       * old banner had, just relocated from the illustration to the buttons. The
       * actions now FOLLOW the text on the same line, so there is no gap between
       * two things that have no reason to be far apart.
       *
       * Note this is not the old `action` slot either: that slot put the control
       * opposite the TITLE, which PageHero's own note records as reading "like a
       * second column rather than a next step". Here the actions sit at the end of
       * the reading line — after the description, not beside the title.
       */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1
            className={cn(
              "font-semibold tracking-tight text-primary",
              /*
               * The title step follows how much is above it rather than an auth
               * flag: with an eyebrow the title is the page's display line, and
               * without one (a returning reader) it IS the whole masthead, so it
               * drops to the title step instead of shouting.
               */
              eyebrow ? "mt-2.5 text-display" : "text-title",
            )}
          >
            {title}
          </h1>
          {description ? <p className="lede mt-2 max-w-2xl">{description}</p> : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 pb-0.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

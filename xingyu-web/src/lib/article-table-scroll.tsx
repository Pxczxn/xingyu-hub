import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { hasHorizontalOverflow } from "@/lib/horizontal-overflow";

/*
 * Markdown tables on a narrow reading column (Phase 4.1D).
 *
 * A wide table gets its own horizontal scroll box (Phase 4), but a scroll box
 * with no visible affordance looks like a cropped table: the reader cannot tell
 * there are more columns to the right. This adds an edge fade plus a small chevron
 * ONLY when the table actually overflows and the reader is not already at the end.
 *
 * Why measure instead of always showing it: a permanent hint on every table would
 * be noise on the many tables that fit, and the task explicitly rules that out.
 * The hint is decorative (`aria-hidden`); the real accessible affordance is the
 * scroll container itself, which becomes a labelled, keyboard-focusable region
 * only while it overflows. Arrow keys then scroll it natively.
 *
 * The fade/chip are absolutely positioned, so appearing does not shift the table
 * or the text below it. There is no animation to disable under reduced motion.
 */

export function ArticleTableScroll({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const overflows = hasHorizontalOverflow(viewport.scrollWidth, viewport.clientWidth);
      setOverflowing(overflows);
      setAtEnd(
        !overflows || viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1,
      );
    };

    measure();
    /* The column width changes with the reader's font size and measure setting,
       so a window resize listener alone would miss it. */
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    /* Changing the reader's font size or measure does not resize the scroll
       viewport itself, but it can change the table's own box (its min-content
       width). Observing both catches that without threading a "preferences
       changed" prop through the Markdown pipeline. */
    const table = viewport.querySelector("table");
    if (table) observer?.observe(table);
    viewport.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      viewport.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div className="article-table-block">
      <div
        ref={viewportRef}
        className={cn("article-table-scroll", overflowing && "focus-ring")}
        role={overflowing ? "region" : undefined}
        tabIndex={overflowing ? 0 : undefined}
        aria-label={overflowing ? "表格，可横向滚动" : undefined}
      >
        <table>{children}</table>
      </div>
      {overflowing && !atEnd ? (
        <span aria-hidden data-testid="article-table-overflow-hint" className="article-table-fade">
          <span className="article-table-fade-chip">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </span>
      ) : null}
    </div>
  );
}

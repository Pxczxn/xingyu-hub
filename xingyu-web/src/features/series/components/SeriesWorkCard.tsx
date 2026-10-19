import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { SeriesCover } from "@/components/visual/SeriesCover";

/*
 * One series in the plaza's work grid.
 *
 * Shape: a book jacket on the left, the work's facts on the right. That is
 * deliberately NOT the topics card skeleton (glyph + name, paragraph, fact row
 * with an action) — a series is a WORK you enter and read through, so the
 * cover carries the identity here and the text column behaves like a jacket
 * blurb. Two columns on desktop, one on a phone.
 *
 * The whole card is the link. There is no nested control, so the single target
 * is honest: clicking anywhere opens the series detail, which owns the chapter
 * navigation and the subscribe action. `focus-ring` is on the anchor itself, so
 * keyboard focus outlines the card rather than an invisible inner box.
 *
 * Hover is limited to the border deepening and the title warming to the accent;
 * no lift, no shadow, no movement of the card. A catalogue should feel settled.
 *
 * The footer (`mt-auto`) puts author and length on one line across cards in the
 * same row. Height is never fixed: the cover's 3:4 ratio sets the floor and a
 * long blurb grows the card instead of clipping it.
 */
export function SeriesWorkCard({ item }: { item: PublicSeriesSummary }) {
  const author = item.author.displayName?.trim() || `@${item.author.username}`;

  return (
    <li className="min-w-0">
      <Link
        to={`/series/${encodeURIComponent(item.id)}`}
        data-testid="series-work-card"
        className="group focus-ring flex h-full gap-4 rounded-xl border border-border/60 bg-card p-4 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-muted/20 sm:gap-5 sm:p-5"
      >
        <SeriesCover
          stableKey={`${item.id}:${item.slug}`}
          title={item.title}
          variant="poster"
          className="w-[88px] sm:w-[104px]"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The title is the one thing a reader scans for; everything else is support. */}
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-6 text-primary transition-colors group-hover:text-accent-strong">
            {item.title}
          </h3>

          {item.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-3 text-meta text-muted-foreground">
            <span className="min-w-0 truncate" title={author}>
              {author}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="tabular-nums">{item.chapterCount} 章</span>
              <span className="flex items-center gap-1 font-medium text-accent-strong">
                查看系列
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

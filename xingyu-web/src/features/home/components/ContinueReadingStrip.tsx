import { Link } from "react-router-dom";
import { contentHref } from "@/components/shared/ContentCard";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/relative-time";
import type { ContentSummary } from "@/api/common.types";

/*
 * 继续阅读 — a compact horizontal strip, deliberately NOT a card grid.
 *
 * Visibility is owned by the caller (HomePage renders it only for a signed-in
 * session that actually has continue-reading rows), so a guest never sees a
 * "resume" affordance they cannot have. The component is defensive and returns
 * null on an empty list too.
 *
 * PROGRESS IS IN CHAPTERS, NEVER IN PERCENT. `series_reader_state` records only
 * the last-read article, so the server can say "chapter 3 of 8" but has no way
 * to know how far into chapter 3 the reader got. Rendering "68%" would be
 * inventing a number; the bar below is the chapter fraction and the caption
 * names it, so the two cannot disagree.
 *
 * There is no "全部" link: the backend exposes /api/v1/me/reading-history, but
 * this app has no route for it, and a link to a non-existent route would be
 * worse than no link.
 */
export function ContinueReadingStrip({
  items,
  className,
}: {
  items: ContentSummary[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="home-continue-reading"
      className={cn("rounded-lg border border-border bg-card", className)}
    >
      <h2
        id="home-continue-reading"
        className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        继续阅读
      </h2>
      <ul className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2">
        {items.map((item) => (
          <li key={item.id} className="w-64 shrink-0">
            <ContinueReadingCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContinueReadingCard({ item }: { item: ContentSummary }) {
  const href = contentHref(item);
  const chapterCount = item.chapterCount ?? 0;
  const chapterIndex = item.chapterIndex ?? 0;
  const hasChapterProgress = chapterCount > 0 && chapterIndex > 0;

  /*
   * The caption has three branches, and only two of them may show a time.
   *
   * `updatedAt` here is NOT `search_document.indexed_at` — this rail does not come
   * from the search index at all. `ReadingService.toContinueReadingCard` fills the
   * field two different ways:
   *
   *   series still exists -> updatedAt = series_reader_state.last_read_at
   *                          a REAL "when did I last read this" time, which is
   *                          exactly what a 继续阅读 card should show
   *   series is gone      -> toContentCard() -> updatedAt = search_document.indexed_at
   *                          the index-write time, i.e. NOT a content time
   *
   * `HomeFeedEnrichmentService.Presentation` carries no timestamp, so nothing
   * overwrites the value afterwards.
   *
   * So the time survives for the SERIES branch and is suppressed for the ARTICLE
   * fallback, where it would be an index artefact dressed up as reading history.
   * Both cases otherwise reach this same fallback, so `objectType` is the only
   * thing that distinguishes them.
   */
  const caption = hasChapterProgress
    ? `上次阅读 · 第 ${chapterIndex} 章`
    : item.chapterCount
      ? `上次阅读 · 共 ${item.chapterCount} 章`
      : item.objectType === "SERIES"
        ? (formatRelativeTime(item.updatedAt) ?? null)
        : null;

  return (
    <Link
      to={href}
      className="flex h-full gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted"
    >
      {item.cover ? (
        <img
          src={item.cover}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div aria-hidden className="h-16 w-16 shrink-0 rounded-md bg-muted" />
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground" title={item.title}>
          {item.title}
        </p>
        {item.chapterTitle ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.chapterTitle}</p>
        ) : null}
        {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}

        {hasChapterProgress ? (
          <div className="mt-2 flex items-center gap-2">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={chapterCount}
              aria-valuenow={chapterIndex}
              aria-label={`已读到第 ${chapterIndex} 章，共 ${chapterCount} 章`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((chapterIndex / chapterCount) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {chapterIndex}/{chapterCount}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

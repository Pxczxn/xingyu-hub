import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ContentSummary } from "@/api/common.types";
import { ContentVisual } from "@/components/visual/ContentVisual";

/*
 * Shared content card primitive for home / discover / search / topic content.
 * Rebuilt for Web V2 (no Legacy CSS copied, no Next compatibility).
 */

/**
 * Resolve a card link from a content summary.
 *
 * Verified against the live backend:
 *  - /api/v1/search only ever returns ARTICLE hits, and SearchHit exposes just
 *    `objectId` — no slug and no username. So TOPIC / USER cannot be linked
 *    reliably from search results.
 *  - /api/v1/home returns SERIES hits and /api/v1/galaxies/{slug}/content
 *    returns ARTICLE / SERIES / MOMENT hits, all keyed by the object's own id
 *    (a UUID), never by slug — so no lookup is needed to build these links.
 *
 * ARTICLE, SERIES and MOMENT therefore have real, verifiable destinations
 * (their detail routes shipped in Phase 1B / 2G / 2D). Everything else — TOPIC,
 * USER, and any future type — degrades to /discover rather than emitting a dead
 * link (never a guessed /u/:id or /topics/:id).
 *
 * `title` is deliberately not required: galaxy content rows carry `objectId` +
 * `objectType` but the surrounding row already renders the title itself.
 */
export function contentHref(item: Pick<ContentSummary, "id" | "objectType">): string {
  const type = (item.objectType ?? "").toUpperCase();
  if (type === "ARTICLE") return `/articles/${item.id}`;
  if (type === "SERIES") return `/series/${item.id}`;
  if (type === "MOMENT") return `/moments/${item.id}`;
  return "/discover";
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  SERIES: "系列",
  MOMENT: "动态",
};

export function ContentCard({
  item,
  className,
  showTypeBadge = false,
  showFallbackVisual = false,
}: {
  item: ContentSummary;
  className?: string;
  /** Opt-in because only some surfaces need a visible content type cue. */
  showTypeBadge?: boolean;
  /** Opt-in so legacy search/topic cards keep their existing text-only behavior. */
  showFallbackVisual?: boolean;
}) {
  const typeLabel = showTypeBadge
    ? CONTENT_TYPE_LABELS[(item.objectType ?? "").toUpperCase()]
    : undefined;

  /*
   * 2026-10-03 (layout pass) — information hierarchy.
   *
   * The card used to be five stacked items of near-identical weight: a grey type
   * chip, a 16px title, a 13px summary and a 12px author row, all separated by
   * the same 8px. Nothing told the eye where to land.
   *
   * Now: the type cue lives INSIDE the plate (so it stops being a third grey
   * chip in the text column), the title owns the largest step in the card, the
   * summary is the only muted paragraph, and the meta row is pushed to the
   * bottom on a hairline so the footer of every card in a grid aligns.
   */
  return (
    <Card
      className={cn(
        "h-full transition-[border-color,box-shadow] hover:border-accent-line hover:shadow-sm",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        {item.cover || showFallbackVisual ? (
          <ContentVisual
            stableKey={item.id || item.title}
            objectType={item.objectType}
            cover={item.cover}
            variant="card"
            label={typeLabel}
          />
        ) : null}

        <div className="flex flex-1 flex-col gap-1.5">
          {typeLabel && !showFallbackVisual && !item.cover ? (
            <span className="w-fit rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium leading-4 text-accent-strong">
              {typeLabel}
            </span>
          ) : null}
          <Link
            to={contentHref(item)}
            className="focus-ring line-clamp-2 text-card font-semibold text-primary transition-colors hover:text-accent-strong"
          >
            {item.title}
          </Link>
          {item.summary ? (
            <p className="line-clamp-2 text-meta leading-5 text-muted-foreground">{item.summary}</p>
          ) : null}
          <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-2.5 text-meta text-muted-foreground">
            {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
            {item.readMinutes ? <span>· {item.readMinutes} 分钟</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

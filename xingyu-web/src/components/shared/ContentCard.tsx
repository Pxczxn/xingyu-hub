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

  return (
    <Card
      className={cn(
        "h-full transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-sm",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-2 p-5">
        {item.cover || showFallbackVisual ? (
          <ContentVisual
            stableKey={item.id || item.title}
            objectType={item.objectType}
            cover={item.cover}
            variant="card"
            className="mb-1"
          />
        ) : null}
        {typeLabel ? (
          <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
            {typeLabel}
          </span>
        ) : null}
        <Link
          to={contentHref(item)}
          className="focus-ring line-clamp-2 text-base font-semibold leading-5 text-foreground hover:text-accent"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">{item.summary}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
          {item.readMinutes ? <span>· {item.readMinutes} 分钟</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

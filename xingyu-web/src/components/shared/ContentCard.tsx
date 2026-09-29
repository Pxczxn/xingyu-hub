import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ContentSummary } from "@/api/common.types";

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

export function ContentCard({ item, className }: { item: ContentSummary; className?: string }) {
  return (
    <Card className={cn("h-full transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex flex-col gap-2 p-5">
        {item.cover ? (
          <img
            src={item.cover}
            alt=""
            className="mb-1 aspect-[16/9] w-full rounded-md object-cover"
            loading="lazy"
          />
        ) : null}
        <Link
          to={contentHref(item)}
          className="line-clamp-2 text-sm font-semibold text-foreground hover:text-accent"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
          {item.readMinutes ? <span>· {item.readMinutes} 分钟</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

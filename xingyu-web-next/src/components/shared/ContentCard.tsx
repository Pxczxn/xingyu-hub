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
 * Verified against the live backend (Phase 1A acceptance):
 *  - /api/v1/search only ever returns ARTICLE hits, and SearchHit exposes just
 *    `objectId` — no slug and no username. So TOPIC / USER cannot be linked
 *    reliably from search results.
 *  - /api/v1/home DOES return SERIES hits, but no series detail route exists.
 *
 * Only ARTICLE has a real, verifiable destination. Everything else degrades to
 * /discover rather than emitting a dead link (never /series/:id, never a
 * guessed /u/:id or /topics/:id).
 */
export function contentHref(item: ContentSummary): string {
  const type = (item.objectType ?? "").toUpperCase();
  if (type === "ARTICLE") return `/articles/${item.id}`;
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

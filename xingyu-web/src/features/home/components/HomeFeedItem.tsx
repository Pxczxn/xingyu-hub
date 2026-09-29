import { Link } from "react-router-dom";
import { contentHref } from "@/components/shared/ContentCard";
import { cn } from "@/lib/cn";
import type { ContentSummary } from "@/api/common.types";

/*
 * One row of the home feed — a vertical list item, not a card.
 *
 * The home page is a community content feed now, so recommendations are read
 * top-to-bottom as rows. `ContentCard` (the grid primitive) stays untouched:
 * discover / search / topic still render cards, and only Home opts into rows.
 *
 * Link resolution is shared with ContentCard via `contentHref`, so the home feed
 * can never drift into emitting a dead link that the card would not.
 */

/*
 * Type badge copy. Unknown / missing object types render no badge rather than an
 * empty chip — `||` (not `??`) so an empty-string objectType also degrades.
 */
const TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  SERIES: "系列",
  MOMENT: "动态",
};

export function HomeFeedItem({ item, className }: { item: ContentSummary; className?: string }) {
  const type = (item.objectType ?? "").toUpperCase();
  const typeLabel = TYPE_LABELS[type] || "";
  const href = contentHref(item);

  return (
    <article
      className={cn(
        "flex gap-4 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {typeLabel ? (
          <span className="mb-1 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
            {typeLabel}
          </span>
        ) : null}
        <Link
          to={href}
          className="block line-clamp-2 text-base font-semibold text-foreground hover:text-accent"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {item.authorName ? <span className="truncate">{item.authorName}</span> : null}
          {item.readMinutes ? <span>· {item.readMinutes} 分钟</span> : null}
        </div>
      </div>

      {item.cover ? (
        <Link to={href} tabIndex={-1} aria-hidden className="hidden shrink-0 sm:block">
          <img
            src={item.cover}
            alt=""
            loading="lazy"
            className="h-20 w-28 rounded-md object-cover"
          />
        </Link>
      ) : null}
    </article>
  );
}

import { Link } from "react-router-dom";
import { contentHref } from "@/components/shared/ContentCard";
import { cn } from "@/lib/cn";
import type { ContentSummary } from "@/api/common.types";

/*
 * 继续阅读 — a compact horizontal strip, deliberately NOT a card grid.
 *
 * Visibility is owned by the caller (HomePage renders it only for a signed-in
 * session that actually has continue-reading rows), so a guest never sees a
 * "resume" affordance they cannot have. The component is defensive and returns
 * null on an empty list too.
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
      <ul className="flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
        {items.map((item) => (
          <li key={item.id} className="w-52 shrink-0">
            <Link
              to={contentHref(item)}
              className="block truncate text-sm font-medium text-foreground hover:text-accent"
              title={item.title}
            >
              {item.title}
            </Link>
            {item.readMinutes ? (
              <span className="text-xs text-muted-foreground">{item.readMinutes} 分钟</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

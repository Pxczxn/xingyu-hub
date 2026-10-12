import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import type { AnnouncementSummary } from "@/api/common.types";

/*
 * HomeNotice — the home page's own INLINE notice line.
 *
 * WHERE IT SITS, AND WHY
 * It renders between the masthead and the feed tabs, on the same left edge as
 * both. It is NOT a card and NOT a rail module:
 *
 *   - Not a rail module: announcements are time-sensitive, and the rail stacks
 *     BELOW the feed on a narrow screen — a notice down there is a notice nobody
 *     reads. (The old `AnnouncementPanel` is a rail module by its own doc comment
 *     and is currently unreferenced; it is left in place for a later cleanup.)
 *   - Not a card: a bordered box for one line of text would read as a third
 *     surface on a page whose whole opening is deliberately surface-free, and it
 *     would compete with the feed panel for "this is a container".
 *
 * It is a plain line — icon, title, one trailing link — so it costs the page one
 * text row and zero decoration. The page renders it only when an announcement
 * actually exists; with none, it contributes nothing at all, not an empty box.
 *
 * Data contract unchanged: it takes the same `AnnouncementSummary` the rail panel
 * took, and shows only the newest one, because a one-line notice is one line.
 */

export function HomeNotice({ item, className }: { item: AnnouncementSummary; className?: string }) {
  const href = `/announcements/${encodeURIComponent(item.id)}`;

  return (
    <div data-testid="home-notice" className={className}>
      <div className="flex items-center gap-2.5 text-sm">
        {/* Decorative: the text next to it already says what this is. */}
        <Megaphone className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <Link
          to={href}
          className="min-w-0 flex-1 truncate text-foreground-soft transition-colors hover:text-accent-strong"
        >
          {item.title}
        </Link>
        {/*
         * TEXT link at 12px, so it resolves through --accent-strong: raw brand
         * gold on the page background measures 2.01:1, accent-strong 4.72:1.
         */}
        <Link to={href} className="shrink-0 text-xs text-accent-strong hover:underline">
          查看详情 ›
        </Link>
      </div>
    </div>
  );
}

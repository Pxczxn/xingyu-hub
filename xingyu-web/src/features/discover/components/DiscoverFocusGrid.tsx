import type { ContentSummary } from "@/api/common.types";
import { cn } from "@/lib/cn";
import { DiscoverFocusItem } from "./DiscoverFocusItem";
import { DiscoverContentGrid } from "./DiscoverContentGrid";

/*
 * How many editorial picks the focus block will show beside the primary.
 * Any picks beyond this fall through to the tail grid — the shape never grows to fit.
 */
const SECONDARY_MAX = 2;

/*
 * The focus block is driven by the server's `featured` flag, NOT by array position.
 *
 * It used to be `items[0]` as primary and `items[1..3]` as secondary, which inferred the
 * editorial boundary from list index. That inference happened to be correct while
 * `featured_content` held four curated rows, and would have silently promoted ordinary
 * hot-fallback content to "editorial pick" the moment that count changed.
 *
 * Degradation follows the REAL pick count, and ordinary content is never promoted to keep
 * a shape alive:
 *
 *   0 picks   no focus block at all — one plain grid, nothing claims to be curated
 *   1 pick    a single full-width primary; no right column is rendered
 *   2 picks   primary + one secondary
 *   3+ picks  primary + two secondary; further picks fall through to the tail
 *
 * The tail deliberately mixes leftover picks with ordinary items: it is the
 * undifferentiated remainder. Nothing there is marked, because a marker would be a new
 * visual element and this change is contract-only.
 */
export function DiscoverFocusGrid({ items }: { items: ContentSummary[] }) {
  const picks = items.filter((item) => item.featured === true);
  const others = items.filter((item) => item.featured !== true);

  // No editorial picks means there is no editorial focus to present. Showing a plain
  // grid is the honest degradation — inventing a primary out of ordinary content is not.
  if (picks.length === 0) return <DiscoverContentGrid items={items} />;

  const primary = picks[0];
  const secondary = picks.slice(1, 1 + SECONDARY_MAX);
  const tail = [...picks.slice(1 + SECONDARY_MAX), ...others];

  return (
    <>
      <section aria-labelledby="discover-content" className={tail.length > 0 ? "mb-5" : undefined}>
        <h2
          id="discover-content"
          className="mb-3 text-lg font-semibold tracking-tight text-primary"
        >
          发现内容
        </h2>
        <div
          className={cn(
            "grid items-start gap-4",
            secondary.length > 0 && "lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]",
          )}
          data-testid="discover-focus-grid"
          data-featured-count={picks.length}
        >
          <DiscoverFocusItem item={primary} variant="primary" />
          {secondary.length > 0 ? (
            <div
              className={cn(
                "grid h-full min-h-0 items-stretch gap-4",
                secondary.length > 1 && "grid-rows-2",
              )}
              data-testid="discover-focus-secondary-stack"
            >
              {secondary.map((item) => (
                <DiscoverFocusItem key={item.id} item={item} variant="secondary" />
              ))}
            </div>
          ) : null}
        </div>
      </section>
      {tail.length > 0 ? <DiscoverContentGrid items={tail} title="更多内容" /> : null}
    </>
  );
}

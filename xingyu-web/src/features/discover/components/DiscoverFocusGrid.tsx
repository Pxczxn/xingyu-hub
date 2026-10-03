import type { ContentSummary } from "@/api/common.types";
import { DiscoverFocusItem } from "./DiscoverFocusItem";
import { DiscoverContentGrid } from "./DiscoverContentGrid";

export function DiscoverFocusGrid({ items }: { items: ContentSummary[] }) {
  if (items.length < 3) return <DiscoverContentGrid items={items} />;

  const primary = items[0];
  const secondary = items.slice(1, 3);
  const rest = items.slice(3);

  return (
    <>
      <section aria-labelledby="discover-content" className={rest.length > 0 ? "mb-5" : undefined}>
        <h2
          id="discover-content"
          className="mb-3 text-lg font-semibold tracking-tight text-primary"
        >
          发现内容
        </h2>
        <div
          className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]"
          data-testid="discover-focus-grid"
        >
          <DiscoverFocusItem item={primary} variant="primary" />
          <div
            className="grid h-full min-h-0 grid-rows-2 items-stretch gap-4"
            data-testid="discover-focus-secondary-stack"
          >
            {secondary.map((item) => (
              <DiscoverFocusItem key={item.id} item={item} variant="secondary" />
            ))}
          </div>
        </div>
      </section>
      {rest.length > 0 ? <DiscoverContentGrid items={rest} title="更多内容" /> : null}
    </>
  );
}

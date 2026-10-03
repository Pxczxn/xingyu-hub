import type { ContentSummary } from "@/api/common.types";
import { ContentCard } from "@/components/shared/ContentCard";

export function DiscoverContentGrid({
  items,
  title = "发现内容",
}: {
  items: ContentSummary[];
  title?: string;
}) {
  return (
    <section aria-labelledby="discover-content">
      <div className="mb-3">
        <h2 id="discover-content" className="text-lg font-semibold tracking-tight text-primary">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="discover-results">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            showTypeBadge
            showFallbackVisual
            className="border-border/70 shadow-none transition-[border-color,box-shadow] hover:border-accent/50 hover:shadow-sm [&>div]:gap-1.5 [&>div]:py-4"
          />
        ))}
      </div>
    </section>
  );
}

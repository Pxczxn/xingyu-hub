import { Button } from "@/components/ui/button";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { SeriesWorkCard } from "@/features/series/components/SeriesWorkCard";

/*
 * A profile's public series.
 *
 * Same contract as ProfileMoments: the page owns the paging, and `onLoadMore`
 * is absent once the server says there is no next page, so the control can
 * never promise rows that do not exist. The cards reuse the plaza's work card
 * with its author line suppressed — the identity band above already names the
 * person whose page this is.
 */
export function ProfileSeries({
  series,
  onLoadMore,
  loadingMore = false,
  loadMoreError = null,
}: {
  series: PublicSeriesSummary[];
  onLoadMore?: () => void;
  loadingMore?: boolean;
  loadMoreError?: string | null;
}) {
  if (series.length === 0) {
    return (
      <p
        data-testid="profile-series-empty"
        className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
      >
        还没有公开系列。
      </p>
    );
  }

  return (
    <div>
      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2" data-testid="profile-series-list">
        {series.map((item) => (
          <SeriesWorkCard key={item.id} item={item} showAuthor={false} />
        ))}
      </ul>
      {loadMoreError ? (
        <p
          role="alert"
          data-testid="profile-series-load-more-error"
          className="mt-3 text-sm text-destructive"
        >
          {loadMoreError}
        </p>
      ) : null}
      {onLoadMore ? (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? "正在加载…" : "加载更多系列"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";
import { discoverApi } from "@/api/discover/discover.api";
import type { ExploreNav } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import { ContentCard } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";

/*
 * Discover (Phase 1A, revised after live acceptance).
 *
 * Uses GET /api/v1/discover (verified 200, PageResult<ContentSummary>).
 * The previous /api/v1/explore/feed call returns 500 INTERNAL_ERROR on the
 * current backend, so it is not used.
 *
 * /api/v1/discover/nav is fetched only for the section copy. Its domain/sort
 * tabs are deliberately NOT rendered as filters: the backend ignores those
 * query params on /api/v1/discover, so showing them would be fake controls.
 */
export function DiscoverPage() {
  const [nav, setNav] = useState<ExploreNav | null>(null);
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    discoverApi
      .getDiscoverNav()
      .then((data) => {
        if (active) setNav(data);
      })
      .catch(() => {
        /* nav copy is optional */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    discoverApi
      .getDiscover({ limit: 20 })
      .then((page) => {
        if (!active) return;
        setItems(page.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">{nav?.sectionTitle ?? "发现"}</h1>
        {nav?.feedHint ? (
          <p className="text-sm text-muted-foreground">{nav.feedHint}</p>
        ) : null}
      </header>

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && items.length === 0 ? <PageState kind="empty" /> : null}

      {!loading && !error && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="discover-results">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

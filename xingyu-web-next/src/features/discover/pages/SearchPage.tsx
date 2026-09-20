import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import type { SearchSort } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContentCard } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/*
 * Search (Phase 1A).
 * Real endpoint: GET /api/v1/search?q=&type=&sort=&limit=
 * The keyword lives in the URL (?q=) so refresh and sharing keep the state —
 * never in React state only.
 * Only types the backend actually supports are offered.
 */

/*
 * Type filters are intentionally NOT offered.
 * Verified against the live backend: /api/v1/search only ever returns ARTICLE
 * hits; type=TOPIC / USER / SERIES all return 0 results. Rendering those tabs
 * would imply coverage the backend does not have.
 */

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [draft, setDraft] = useState(query);
  const [sort, setSort] = useState<SearchSort>("hot");

  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setItems([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    setSearched(true);
    discoverApi
      .search({ q: query, sort })
      .then((page) => {
        if (!active) return;
        setItems(page.items);
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
  }, [query, sort]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  return (
    <div className="section-gap">
      <form onSubmit={submit} className="flex items-center gap-2" role="search">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="搜索文章、系列、话题、用户"
          aria-label="搜索关键词"
        />
        <Button type="submit">搜索</Button>
      </form>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="搜索排序">
        {(["hot", "latest"] as SearchSort[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              sort === key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {key === "hot" ? "热门" : "最新"}
          </button>
        ))}
      </div>

      {/* empty query */}
      {!query ? (
        <PageState kind="empty" />
      ) : null}

      {query && loading ? <PageState kind="loading" /> : null}
      {query && !loading && error ? <PageState kind="error" /> : null}
      {query && !loading && !error && searched && items.length === 0 ? (
        <div data-testid="search-no-results" className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          没有找到与「{query}」相关的内容
        </div>
      ) : null}

      {query && !loading && !error && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="search-results">
          {items.map((item) => (
            <ContentCard key={`${item.objectType ?? "ARTICLE"}-${item.id}`} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

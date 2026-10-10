import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import type { ContentSummary } from "@/api/common.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ContentCard } from "@/components/shared/ContentCard";
import { PageState } from "@/components/shared/PageState";

/*
 * Search (Phase 1A).
 * Real endpoint: GET /api/v1/search?q=&type=&sort=&limit=
 * The keyword lives in the URL (?q=) so refresh and sharing keep the state —
 * never in React state only.
 * Search covers public articles, series, moments and user profiles.
 */

/*
 * Type filters are intentionally NOT offered.
 * Type filters are intentionally not offered: the page is a compact all-type
 * search surface, while every returned object carries its own visible type.
 */

function UserSearchResult({ item }: { item: ContentSummary }) {
  const fallback = (item.title || item.id).trim().charAt(0).toUpperCase();
  const username = item.id;
  const bio = item.summary === `@${username}` ? undefined : item.summary;

  return (
    <Card className="h-full transition-[border-color,box-shadow] hover:border-accent-line hover:shadow-sm">
      <CardContent className="flex h-full gap-3 p-4">
        <Avatar className="h-10 w-10 border border-border">
          {item.cover ? <AvatarImage src={item.cover} alt="" /> : null}
          <AvatarFallback className="bg-accent-soft text-sm font-semibold text-accent-strong">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="mb-1 inline-block text-[11px] font-medium text-accent-strong">用户</span>
          <Link
            to={`/u/${encodeURIComponent(username)}`}
            className="focus-ring block truncate text-card font-semibold text-primary hover:text-accent-strong"
          >
            {item.title}
          </Link>
          <p className="text-meta text-muted-foreground">@{username}</p>
          {bio ? <p className="mt-1 line-clamp-2 text-meta leading-5 text-muted-foreground">{bio}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";

  const [draft, setDraft] = useState(query);
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
      .search({ q: query, sort: "hot" })
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
  }, [query]);

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
          placeholder="搜索文章、系列、动态、用户"
          aria-label="搜索关键词"
        />
        <Button type="submit">搜索</Button>
      </form>

      <p className="text-meta text-muted-foreground">可搜索文章、系列、动态与用户，结果按热门程度排列。</p>

      {/* empty query */}
      {!query ? <PageState kind="empty" /> : null}

      {query && loading ? <PageState kind="loading" /> : null}
      {query && !loading && error ? <PageState kind="error" /> : null}
      {query && !loading && !error && searched && items.length === 0 ? (
        <div
          data-testid="search-no-results"
          className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground"
        >
          没有找到与「{query}」相关的内容
        </div>
      ) : null}

      {query && !loading && !error && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="search-results">
          {items.map((item) => (
            (item.objectType ?? "").toUpperCase() === "USER" ? (
              <UserSearchResult key={`USER-${item.id}`} item={item} />
            ) : (
              <ContentCard
                key={`${item.objectType ?? "ARTICLE"}-${item.id}`}
                item={item}
                showTypeBadge
              />
            )
          ))}
        </div>
      ) : null}
    </div>
  );
}

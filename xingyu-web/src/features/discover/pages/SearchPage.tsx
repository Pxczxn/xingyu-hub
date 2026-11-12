import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { discoverApi } from "@/api/discover/discover.api";
import type { SearchSort } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ContentCard } from "@/components/shared/ContentCard";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { ArchetypeFrame } from "@/components/layout";

/*
 * Search (Phase 1A).
 * Real endpoint: GET /api/v1/search?q=&type=&sort=&limit=
 * The keyword lives in the URL (?q=) so refresh and sharing keep the state —
 * never in React state only.
 * Search covers public articles, series, moments and user profiles.
 */

/*
 * Type filters are intentionally not offered: the page is a compact all-type
 * search surface, while every returned object carries its own visible type.
 * Sort is the one axis the search API already honors: hot (default) or latest.
 */

function searchSort(value: string | null): SearchSort {
  return value === "latest" ? "latest" : "hot";
}

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
          {bio ? (
            <p className="mt-1 line-clamp-2 text-meta leading-5 text-muted-foreground">{bio}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const sort = searchSort(params.get("sort"));

  const [draft, setDraft] = useState(query);
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searched, setSearched] = useState(false);
  /* Bumping the key replays the search effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [query, sort, reloadKey]);

  function setSort(next: SearchSort) {
    const nextParams = new URLSearchParams(params.toString());
    if (next === "hot") nextParams.delete("sort");
    else nextParams.set("sort", next);
    setParams(nextParams, { replace: true });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  /*
   * SK2 画廊 · H 线 / D 松 / R 齐（A §3 的 Search 行）。
   *
   *   skeleton="SK2"  → 画廊原型：等权卡格，卡即链接；页面不再手写 `section-gap`
   *                     的块间距（密度由 frame 的 `density-loose` 提供）。
   *   header="line"   → H=线：`PageMasthead`（无面、标题贴内容列左缘、首屏即内容）。
   *   density="loose" → D=松：每张结果卡独立成块，首屏 ≤3 块。
   *   R=齐           → 全页只有一列：页头、搜索表单、排序、结果格全部与内容列同宽
   *                     同左缘，没有出血带（那是 R=出）、也没有侧轨（那是 R=错）。
   *                     与同为 SK2 的 Discover（出，出血带+筛选列）和 Topics（出，
   *                     出血带+卡格）的区别就在这里：本页是「齐」的纯单列。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="loose"
      headerSlot={
        <PageMasthead
          eyebrow="SEARCH"
          title="搜索"
          description="按关键词查找公开的文章、系列、动态与用户。"
        />
      }
    >
      <form onSubmit={submit} className="flex items-center gap-2" role="search">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="搜索文章、系列、动态、用户"
          aria-label="搜索关键词"
        />
        <Button type="submit">搜索</Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-meta text-muted-foreground">
          {sort === "latest"
            ? "可搜索文章、系列、动态与用户，结果按更新时间排列。"
            : "可搜索文章、系列、动态与用户，结果按热门程度排列。"}
        </p>
        <div role="radiogroup" aria-label="排序" className="flex gap-1">
          {(
            [
              ["hot", "热门"],
              ["latest", "最新"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={sort === value}
              onClick={() => setSort(value)}
              className={
                sort === value
                  ? "rounded-md bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent-strong focus-ring"
                  : "rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:bg-muted/50 focus-ring"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* empty query */}
      {!query ? <PageState kind="empty" /> : null}

      {query && loading ? <PageState kind="loading" /> : null}
      {query && !loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {query && !loading && !error && searched && items.length === 0 ? (
        <div
          data-testid="search-no-results"
          className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground"
        >
          没有找到与「{query}」相关的内容
        </div>
      ) : null}

      {query && !loading && !error && items.length > 0 ? (
        <div
          className="grid gap-[var(--density-grid-gap)] sm:grid-cols-2 lg:grid-cols-3"
          data-testid="search-results"
        >
          {items.map((item) =>
            (item.objectType ?? "").toUpperCase() === "USER" ? (
              <UserSearchResult key={`USER-${item.id}`} item={item} />
            ) : (
              <ContentCard
                key={`${item.objectType ?? "ARTICLE"}-${item.id}`}
                item={item}
                showTypeBadge
              />
            ),
          )}
        </div>
      ) : null}
    </ArchetypeFrame>
  );
}

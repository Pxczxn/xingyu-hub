"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, Search, Sparkles, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { communityApi, contentHref } from "@/lib/community-api";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  hydrateClientSettingsFromServer,
  removeSearchHistoryItem,
} from "@/lib/user-preferences";
import { useAsyncData } from "@/lib/use-async-data";
import { cn } from "@/lib/utils";

const TYPES = [
  ["ALL", "全部"],
  ["ARTICLE", "文章"],
  ["MOMENT", "动态"],
  ["SERIES", "系列"],
  ["TOPIC", "话题"],
  ["USER", "用户"],
] as const;

const OBJECT_TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  MOMENT: "动态",
  SERIES: "系列",
  TOPIC: "话题",
  USER: "用户",
};

function objectTypeLabel(type?: string) {
  if (!type) return "内容";
  return OBJECT_TYPE_LABELS[type.toUpperCase()] ?? type;
}

function resultMarkClass(type?: string) {
  const key = type?.toUpperCase() ?? "ARTICLE";
  if (key === "MOMENT") return "xy-search-result-mark--moment";
  if (key === "SERIES") return "xy-search-result-mark--series";
  if (key === "TOPIC") return "xy-search-result-mark--topic";
  return "xy-search-result-mark--article";
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="xy-search-page">
            <p className="xy-search-status">加载中…</p>
          </main>
        </AppShell>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchForm({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="xy-search-form">
      <Input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="搜索文章、动态、系列、话题或用户"
        aria-label="搜索关键词"
        autoFocus
      />
      <Button type="submit" className="xy-search-submit">
        <Search className="mr-2 h-4 w-4" aria-hidden="true" />
        <span>搜索</span>
      </Button>
    </form>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(query);
  const [history, setHistory] = useState<string[]>([]);
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState<"hot" | "latest">("hot");
  const result = useAsyncData(
    () =>
      query
        ? communityApi.search(query, type === "ALL" ? undefined : type, sort)
        : Promise.resolve({ items: [], total: 0 }),
    [query, type, sort]
  );

  useEffect(() => {
    void hydrateClientSettingsFromServer().finally(() => setHistory(getSearchHistory()));
  }, []);

  useEffect(() => {
    if (!query) {
      setDraft("");
      return;
    }
    setType("ALL");
    addSearchHistory(query);
    setHistory(getSearchHistory());
  }, [query]);

  const items = (result.data?.items ?? []).filter(
    (item) => type === "ALL" || item.objectType?.toUpperCase() === type
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  function removeHistory(value: string) {
    removeSearchHistoryItem(value);
    setHistory(getSearchHistory());
  }

  function clearAll() {
    clearSearchHistory();
    setHistory([]);
  }

  return (
    <AppShell>
      <main className="xy-search-page">
        {query ? (
          <header className="xy-search-results-head">
            <p className="xy-search-kicker">
              <Search aria-hidden="true" />
              搜索结果
            </p>
            <h1 className="xy-search-query-title">{query}</h1>
          </header>
        ) : (
          <header className="xy-search-hero-card">
            <p className="xy-search-kicker">
              <Sparkles aria-hidden="true" />
              全站搜索
            </p>
            <h1 className="xy-search-hero-title">寻找值得继续探索的内容</h1>
            <SearchForm draft={draft} onDraftChange={setDraft} onSubmit={submit} />
          </header>
        )}

        {!query ? (
          <section className="xy-search-panel" aria-label="最近搜索">
            <div className="xy-search-panel-head">
              <h2>
                <Clock3 aria-hidden="true" />
                最近搜索
              </h2>
              {history.length ? (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  清空
                </Button>
              ) : null}
            </div>
            <div className="xy-search-panel-body">
              {history.length ? (
                <div className="xy-search-history-chips">
                  {history.map((value) => (
                    <span key={value} className="xy-search-history-chip">
                      <Link href={`/search?q=${encodeURIComponent(value)}`}>{value}</Link>
                      <button
                        type="button"
                        onClick={() => removeHistory(value)}
                        aria-label={`删除搜索记录 ${value}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">搜索记录会在这里显示。</p>
              )}
            </div>
          </section>
        ) : (
          <section className="xy-search-panel" aria-label="搜索结果">
            <div className="xy-search-panel-body xy-search-panel-body--toolbar">
              <div className="xy-search-toolbar">
                <nav className="xy-discover-type-tabs" aria-label="搜索类型">
                  {TYPES.map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={cn(type === value && "is-active")}
                      aria-pressed={type === value}
                      onClick={() => setType(value)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="xy-discover-sort-tabs" role="group" aria-label="排序方式">
                  <button
                    type="button"
                    className={cn(sort === "hot" && "is-active")}
                    aria-pressed={sort === "hot"}
                    onClick={() => setSort("hot")}
                  >
                    最热
                  </button>
                  <button
                    type="button"
                    className={cn(sort === "latest" && "is-active")}
                    aria-pressed={sort === "latest"}
                    onClick={() => setSort("latest")}
                  >
                    最新
                  </button>
                </div>
              </div>
            </div>

            {result.loading ? (
              <p className="xy-search-status">正在搜索…</p>
            ) : result.error ? (
              <div className="xy-search-empty-wrap">
                <EmptyState compact title="搜索暂时不可用" description={result.error} />
              </div>
            ) : items.length ? (
              <ul className="xy-search-results">
                {items.map((item) => {
                  const typeKey = item.objectType?.toUpperCase() ?? "ARTICLE";
                  const isUser = typeKey === "USER";
                  return (
                    <li key={`${item.objectType}-${item.id}`} className="xy-search-result-item">
                      <Link href={contentHref(item)} className="xy-search-result-link">
                        {isUser ? (
                          <Avatar
                            src={item.avatar}
                            fallback={item.title || item.id}
                            size="sm"
                            className="xy-search-result-avatar"
                            alt=""
                          />
                        ) : (
                          <span className={cn("xy-search-result-mark", resultMarkClass(item.objectType))} aria-hidden="true">
                            {objectTypeLabel(item.objectType).slice(0, 2)}
                          </span>
                        )}
                        <span className="xy-search-result-body">
                          <span className="xy-search-result-meta">
                            <span className="xy-search-result-type">{objectTypeLabel(item.objectType)}</span>
                            {item.updatedAt ? (
                              <time dateTime={item.updatedAt}>
                                {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                              </time>
                            ) : null}
                          </span>
                          <h3>{item.title || "未命名内容"}</h3>
                          {!isUser && item.summary ? <p>{item.summary}</p> : null}
                          {isUser && item.summary && !item.summary.startsWith("@") ? <p>{item.summary}</p> : null}
                          {isUser ? <small>@{item.id}</small> : item.authorName ? <small>{item.authorName}</small> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="xy-search-empty-wrap">
                <EmptyState
                  compact
                  icon={Search}
                  title="没有找到相关内容"
                  description="换一个关键词，或切换内容类型后再试"
                  actionLabel="浏览探索"
                  actionHref="/discover"
                />
              </div>
            )}
          </section>
        )}
      </main>
    </AppShell>
  );
}

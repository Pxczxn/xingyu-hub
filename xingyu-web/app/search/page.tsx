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
import searchStyles from "./search.module.css";
import tabStyles from "@/components/community/discover-tabs.module.css";

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
  if (key === "MOMENT") return styles.resultMarkMoment;
  if (key === "SERIES") return styles.resultMarkSeries;
  if (key === "TOPIC") return styles.resultMarkTopic;
  return styles.resultMarkArticle;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className={cn(searchStyles.page)}>
            <p className={cn(searchStyles.status)}>加载中…</p>
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
    <form onSubmit={onSubmit} className={cn(searchStyles.form)}>
      <Input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="搜索文章、动态、系列、话题或用户"
        aria-label="搜索关键词"
        autoFocus
      />
      <Button type="submit" className={cn(searchStyles.submit)}>
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
      <main className={cn(searchStyles.page)}>
        {query ? (
          <header className={cn(searchStyles.resultsHead)}>
            <p className={cn(searchStyles.kicker)}>
              <Search aria-hidden="true" />
              搜索结果
            </p>
            <h1 className={cn(searchStyles.queryTitle)}>{query}</h1>
          </header>
        ) : (
          <header className={cn(searchStyles.heroCard)}>
            <p className={cn(searchStyles.kicker)}>
              <Sparkles aria-hidden="true" />
              全站搜索
            </p>
            <h1 className={cn(searchStyles.heroTitle)}>寻找值得继续探索的内容</h1>
            <SearchForm draft={draft} onDraftChange={setDraft} onSubmit={submit} />
          </header>
        )}

        {!query ? (
          <section className={cn(searchStyles.panel)} aria-label="最近搜索">
            <div className={cn(searchStyles.panelHead)}>
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
            <div className={cn(searchStyles.panelBody)}>
              {history.length ? (
                <div className={cn(searchStyles.historyChips)}>
                  {history.map((value) => (
                    <span key={value} className={cn(searchStyles.historyChip)}>
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
          <section className={cn(searchStyles.panel)} aria-label="搜索结果">
            <div className={cn(searchStyles.panelBody, searchStyles.panelBodyToolbar)}>
              <div className={cn(searchStyles.toolbar)}>
                <nav className={cn(tabStyles.typeTabs)} aria-label="搜索类型">
                  {TYPES.map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={cn(type === value && tabStyles.isActive)}
                      aria-pressed={type === value}
                      onClick={() => setType(value)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className={cn(tabStyles.sortTabs)} role="group" aria-label="排序方式">
                  <button
                    type="button"
                    className={cn(sort === "hot" && tabStyles.isActive)}
                    aria-pressed={sort === "hot"}
                    onClick={() => setSort("hot")}
                  >
                    最热
                  </button>
                  <button
                    type="button"
                    className={cn(sort === "latest" && tabStyles.isActive)}
                    aria-pressed={sort === "latest"}
                    onClick={() => setSort("latest")}
                  >
                    最新
                  </button>
                </div>
              </div>
            </div>

            {result.loading ? (
              <p className={cn(searchStyles.status)}>正在搜索…</p>
            ) : result.error ? (
              <div className={cn(searchStyles.emptyWrap)}>
                <EmptyState compact title="搜索暂时不可用" description={result.error} />
              </div>
            ) : items.length ? (
              <ul className={cn(searchStyles.results)}>
                {items.map((item) => {
                  const typeKey = item.objectType?.toUpperCase() ?? "ARTICLE";
                  const isUser = typeKey === "USER";
                  return (
                    <li key={`${item.objectType}-${item.id}`} className={cn(searchStyles.resultItem)}>
                      <Link href={contentHref(item)} className={cn(searchStyles.resultLink)}>
                        {isUser ? (
                          <Avatar
                            src={item.avatar}
                            fallback={item.title || item.id}
                            size="sm"
                            className={cn(searchStyles.resultAvatar)}
                            alt=""
                          />
                        ) : (
                          <span className={cn(styles.resultMark, resultMarkClass(item.objectType))} aria-hidden="true">
                            {objectTypeLabel(item.objectType).slice(0, 2)}
                          </span>
                        )}
                        <span className={cn(searchStyles.resultBody)}>
                          <span className={cn(searchStyles.resultMeta)}>
                            <span className={cn(searchStyles.resultType)}>{objectTypeLabel(item.objectType)}</span>
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
              <div className={cn(searchStyles.emptyWrap)}>
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

"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, Search, Sparkles, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi, contentHref } from "@/lib/community-api";
import { addSearchHistory, clearSearchHistory, getSearchHistory, hydrateClientSettingsFromServer, removeSearchHistoryItem } from "@/lib/user-preferences";
import { useAsyncData } from "@/lib/use-async-data";

const TYPES = [["ALL", "全部"], ["ARTICLE", "文章"], ["MOMENT", "动态"], ["SERIES", "系列"], ["TOPIC", "话题"], ["USER", "用户"]] as const;

export default function SearchPage() {
  return <Suspense fallback={<AppShell><main className="xy-page"><p>加载中…</p></main></AppShell>}><SearchContent /></Suspense>;
}

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(query);
  const [history, setHistory] = useState<string[]>([]);
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState<"relevance" | "latest">("relevance");
  const result = useAsyncData(() => query ? communityApi.search(query) : Promise.resolve({ items: [], total: 0 }), [query]);

  useEffect(() => { void hydrateClientSettingsFromServer().finally(() => setHistory(getSearchHistory())); }, []);
  useEffect(() => {
    setDraft(query); setType("ALL");
    if (query) { addSearchHistory(query); setHistory(getSearchHistory()); }
  }, [query]);

  const items = useMemo(() => {
    const filtered = (result.data?.items ?? []).filter((item) => type === "ALL" || item.objectType?.toUpperCase() === type);
    return sort === "latest" ? [...filtered].sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? "")) : filtered;
  }, [result.data, sort, type]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }
  function removeHistory(value: string) { removeSearchHistoryItem(value); setHistory(getSearchHistory()); }
  function clearAll() { clearSearchHistory(); setHistory([]); }

  return <AppShell><main className="mx-auto w-full max-w-[1420px] px-5 pb-16 pt-8 sm:px-6 lg:px-8">
    <header className="rounded-2xl border border-white/80 bg-white/75 px-6 py-8 shadow-[0_12px_34px_rgb(36_49_84/.06)] sm:px-9">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#d8792c]"><Sparkles className="h-4 w-4" />全站搜索</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#172a50]">寻找值得继续探索的内容</h1>
      <form onSubmit={submit} className="mt-6 flex max-w-3xl gap-3"><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="搜索文章、动态、系列、话题或用户" className="h-12" autoFocus /><Button className="h-12 px-6"><Search className="mr-2 h-4 w-4" />搜索</Button></form>
    </header>
    {!query ? <section className="mt-7 rounded-2xl border border-[#e8e2da] bg-white/70 p-6">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold text-[#263960]"><Clock3 className="h-5 w-5" />最近搜索</h2>{history.length ? <Button variant="ghost" size="sm" onClick={clearAll}><Trash2 className="mr-2 h-4 w-4" />清空</Button> : null}</div>
      {history.length ? <div className="mt-5 flex flex-wrap gap-2">{history.map((value) => <span key={value} className="inline-flex items-center rounded-full border border-[#e7dfd4] bg-white"><Link href={`/search?q=${encodeURIComponent(value)}`} className="px-4 py-2 text-sm text-[#354665]">{value}</Link><button type="button" onClick={() => removeHistory(value)} aria-label={`删除搜索记录 ${value}`} className="mr-2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button></span>)}</div> : <p className="mt-5 text-sm text-slate-500">搜索记录会在这里显示。</p>}
    </section> : <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e1da] pb-3"><nav className="flex flex-wrap gap-2" aria-label="搜索类型">{TYPES.map(([value, label]) => <button type="button" key={value} onClick={() => setType(value)} aria-pressed={type === value} className={`rounded-full px-4 py-2 text-sm ${type === value ? "bg-[#172d59] text-white" : "bg-white/70 text-[#5d687d] hover:bg-white"}`}>{label}</button>)}</nav><div className="flex rounded-lg border border-[#e6dfd5] bg-white/75 p-1"><button type="button" onClick={() => setSort("relevance")} className={`rounded-md px-3 py-1.5 text-sm ${sort === "relevance" ? "bg-[#fff0df] text-[#c87329]" : "text-slate-500"}`}>相关度</button><button type="button" onClick={() => setSort("latest")} className={`rounded-md px-3 py-1.5 text-sm ${sort === "latest" ? "bg-[#fff0df] text-[#c87329]" : "text-slate-500"}`}>最新</button></div></div>
      <p className="py-5 text-sm text-slate-500">“{query}” 共找到 {result.data?.total ?? 0} 条结果，当前显示 {items.length} 条</p>
      {result.loading ? <p className="py-16 text-center text-slate-500">正在搜索…</p> : result.error ? <EmptyState title="搜索暂时不可用" description={result.error} /> : items.length ? <div className="divide-y divide-[#ebe5dc] overflow-hidden rounded-2xl border border-[#e8e2da] bg-white/75">{items.map((item) => <Link href={contentHref(item)} key={`${item.objectType}-${item.id}`} className="block px-6 py-5 transition-colors hover:bg-white"><div className="flex items-center gap-2 text-xs text-[#c6762b]"><span>{item.objectType}</span>{item.updatedAt ? <time>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</time> : null}</div><h2 className="mt-2 text-lg font-semibold text-[#263960]">{item.title || "未命名内容"}</h2>{item.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.summary}</p> : null}<p className="mt-3 text-xs text-slate-500">{item.authorName || "作者信息暂未提供"}</p></Link>)}</div> : <EmptyState title="没有找到相关内容" description="换一个关键词或切换内容类型后再试" actionLabel="浏览探索" actionHref="/discover" />}
    </section>}
  </main></AppShell>;
}

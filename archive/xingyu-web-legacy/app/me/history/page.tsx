"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Clock3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

const historyCovers = [
  "/prototype-assets/reading-history/image-history-cover-01.png",
  "/prototype-assets/reading-history/image-history-cover-02.png",
  "/prototype-assets/reading-history/image-history-cover-03.png",
  "/prototype-assets/reading-history/image-history-cover-04.png",
  "/prototype-assets/reading-history/image-history-cover-05.png",
];

export default function HistoryPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getHistory(), []);
  const items = data?.items ?? [];

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-10">
        <header><h1 className="text-[40px] font-bold tracking-[.08em] text-[#18305b]">阅读历史</h1><p className="mt-3 text-lg text-slate-500">回顾你探索过的思想与灵感</p></header>
        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_305px]">
          <section className="rounded-[26px] border border-white/80 bg-white/72 p-7 shadow-[0_14px_38px_rgba(85,64,35,.08)]">
            <h2 className="text-xl font-bold text-[#263961]">最近阅读</h2>
            {loading ? <p className="py-20 text-center text-slate-400">正在加载阅读记录…</p> : error ? <EmptyState compact title="需要登录" description={error} actionLabel="去登录" actionHref="/login" /> : !items.length ? <EmptyState compact title="暂无阅读历史" description="开始阅读后，记录会出现在这里" actionLabel="去发现" actionHref="/discover" /> : <div className="mt-5 divide-y divide-[#eee6df]">
              {items.slice(0, 5).map((item, index) => <article key={item.id} className="grid grid-cols-[16px_94px_minmax(0,1fr)_155px] items-center gap-5 py-4">
                <span className={`h-3 w-3 rounded-full border-2 ${index === 0 ? "border-[#e9912e] bg-white" : "border-slate-300"}`} />
                <img src={historyCovers[index]} alt="" className="h-[115px] w-[94px] rounded-xl object-cover shadow-[0_5px_12px_rgba(34,47,72,.12)]" />
                <div><h3 className="truncate text-xl font-bold text-[#263961]">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.summary || "暂无内容摘要"}</p><p className="mt-3 text-xs text-[#89765e]">{item.objectType === "SERIES" ? "系列内容" : "文章"}</p></div>
                <Link href={contentHref(item)} className="text-right text-sm text-[#52617d]"><p>{formatDateTime(item.updatedAt)}</p><p className="mt-2 inline-flex items-center text-[#d97a25]">继续阅读<ChevronRight className="h-4 w-4" /></p></Link>
              </article>)}
            </div>}
          </section>
          <aside className="space-y-5">
            <section className="rounded-[26px] border border-white/80 bg-white/75 p-5 shadow-[0_14px_38px_rgba(85,64,35,.08)]"><h2 className="text-xl font-bold text-[#263961]">本周阅读时长</h2><p className="mt-4 text-3xl font-serif text-[#1a315d]">暂无记录</p><div className="mt-5 flex h-14 items-end justify-between px-2">{Array.from({ length: 7 }, (_, index) => <i key={index} className="h-6 w-3 rounded-t bg-[#e9e4dd]" />)}</div><p className="mt-3 text-sm text-slate-500">开始阅读后，这里会记录你的阅读节奏</p></section>
            <section className="rounded-[26px] border border-white/80 bg-white/75 p-5 shadow-[0_14px_38px_rgba(85,64,35,.08)]"><h2 className="text-xl font-bold text-[#263961]">筛选</h2><div className="mt-4 flex h-11 w-full items-center justify-between rounded-xl border border-[#dfd6cb] px-4 text-sm text-[#3b4d6b]">全部内容<ChevronRight className="h-4 w-4" /></div><p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />按最近阅读时间排序</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><BookOpen className="h-4 w-4" />已记录 {items.length} 条阅读内容</p></section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

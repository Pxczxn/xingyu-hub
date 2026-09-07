"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Compass,
  Feather,
  Home,
  Library,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { communityApi, type SeriesSummary } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const covers = ["cover-time", "cover-city", "cover-ai", "cover-steps"];
const rail = [
  [Home, "首页", "/"],
  [Compass, "探索", "/discover"],
  [Star, "系列广场", "/series"],
  [BookOpen, "书架", "/me/bookshelf"],
  [Library, "共读", "/topics"],
  [Feather, "写作", "/studio"],
  [CalendarDays, "活动", "/events"],
  [Users, "星系", "/galaxies"],
  [BarChart3, "榜单", "/rankings"],
] as const;

function SeriesCard({ item, index }: { item: SeriesSummary; index: number }) {
  const cover = covers[index % covers.length];
  return (
    <Link href={`/series/${item.id}`} className="xy-series-card group">
      <Image src={`/prototype-assets/series-list/${cover}.png`} alt="" width={96} height={206} className="xy-series-card-cover" />
      <div className="min-w-0 flex-1 py-4 pr-4">
        <h3>{item.title}</h3>
        <p>{item.chapterCount ?? "持续更新"} 章 · {item.status === "PUBLISHED" ? "连载" : item.status}</p>
        <p className="mt-6">{formatDateTime(item.updatedAt)} 更新</p>
        <p className="mt-3 text-xs">阅读进度暂未提供</p>
      </div>
    </Link>
  );
}

function SeriesEmptyState() {
  return (
    <section className="xy-series-empty-state" aria-label="系列内容为空">
      <span className="xy-series-empty-icon"><BookOpen aria-hidden="true" /></span>
      <div>
        <h2>从一条阅读路线开始</h2>
        <p>系列内容正在汇集，先去探索感兴趣的话题与创作者。</p>
      </div>
      <div className="xy-series-empty-actions">
        <Button asChild><Link href="/discover"><Compass className="mr-2 h-4 w-4" />去探索内容</Link></Button>
        <Button asChild variant="outline"><Link href="/topics">浏览话题</Link></Button>
      </div>
    </section>
  );
}

export default function SeriesListPage() {
  const { data: series, loading, error } = useAsyncData(() => communityApi.listSeries(24), []);
  const [sort, setSort] = useState<"default" | "recent">("default");
  const [visibleCount, setVisibleCount] = useState(8);
  const visibleSeries = useMemo(() => {
    const items = [...(series ?? [])];
    if (sort === "recent") items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return items.slice(0, visibleCount);
  }, [series, sort, visibleCount]);
  return (
    <AppShell>
      <main className="xy-series-market">
        <aside className="xy-series-rail" aria-label="系列导航">
          <nav>{rail.map(([Icon, label, href]) => <Link key={label} href={href} className={label === "系列广场" ? "is-active" : ""}><Icon />{label}</Link>)}</nav>
          <div className="xy-series-orbit"><Sparkles /><strong>系列</strong><span>按主题探索长篇内容</span></div>
        </aside>

        <section className="xy-series-main">
          <div className="xy-series-banner">
            <div className="relative z-10 max-w-[560px] p-8">
              <span>系列主题</span><h1>宇宙与文明的边界</h1>
              <p>从宏观宇宙到微观文明，探索人类在时空中的位置与未来。聚焦科学、哲学与想象的交汇。</p>
              <div className="mt-5 flex items-center gap-5 text-sm"><b>{series?.length ?? 0} 个系列已加载</b><b>继续阅读数据暂未提供</b></div>
            </div>
            <Image src="/prototype-assets/series-list/hero-art.png" alt="星球轨道" fill priority className="object-cover object-right" />
          </div>
          <div className="xy-series-filters">
            <button type="button" className={sort === "default" ? "is-active" : ""} onClick={() => setSort("default")}>全部系列</button>
            <button type="button" className={sort === "recent" ? "is-active" : ""} onClick={() => setSort("recent")}>最近更新</button>
          </div>
          <div className="xy-series-section-title"><h2><Sparkles />系列推荐</h2></div>
          {loading ? <div className="xy-series-loading-grid" aria-busy="true">{Array.from({length: 4}).map((_, i) => <div className="xy-series-loading-card" key={i}><span/><b/><i/></div>)}</div> : error ? <EmptyState title="系列加载失败" description={error} /> : !series?.length ? <SeriesEmptyState /> : <div className="xy-series-grid">{visibleSeries.map((item,index)=><SeriesCard key={item.id} item={item} index={index}/>)}</div>}
          {(series?.length ?? 0) > visibleCount ? <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + 8)} className="mx-auto mt-6 min-w-60 rounded-xl">加载更多系列 <ChevronDown className="ml-2 h-4 w-4" /></Button> : null}
        </section>

        <aside className="xy-series-side">
              <section><div className="xy-series-section-title"><h2><Sparkles />本周更新</h2></div>{(series??[]).slice(0,5).map((item,i)=><Link href={`/series/${item.id}`} className="xy-series-update" key={item.id}><Image src={`/prototype-assets/series-list/${covers[i%4]}.png`} alt="" width={48} height={48}/><span><b>{item.title}</b><small>{item.chapterCount === undefined ? "章节数据暂未提供" : `第 ${item.chapterCount} 章`}</small></span><time>{item.updatedAt ? formatDateTime(item.updatedAt) : "更新时间暂未提供"}</time></Link>)}</section>
        </aside>
      </main>
    </AppShell>
  );
}

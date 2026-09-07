"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Eye, FileText, Grid2X2, Hash, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const typeLabel: Record<string, string> = { ARTICLE: "文章", MOMENT: "动态", SERIES: "系列" };

function ContentCover({ cover, title }: { cover?: string; title: string }) {
  return cover ? <img src={cover} alt="" /> : <span className="xy-category-real-cover"><FileText /><b>{title.slice(0, 1) || "星"}</b></span>;
}

export default function CategoriesPage() {
  const [activeType, setActiveType] = useState("ALL");
  const [query, setQuery] = useState("");
  const discoverState = useAsyncData(() => communityApi.getDiscover({ limit: 24 }), []);
  const topicsState = useAsyncData(() => communityApi.getTopics(), []);
  const contents = discoverState.data?.items ?? [];
  const topics = topicsState.data ?? [];
  const typeOptions = useMemo(() => ["ALL", ...Array.from(new Set(contents.map((item) => item.objectType).filter(Boolean) as string[]))], [contents]);
  const visible = contents.filter((item) => (activeType === "ALL" || item.objectType === activeType) && `${item.title} ${item.summary || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const authors = Array.from(new Set(contents.map((item) => item.authorName).filter((name): name is string => Boolean(name)))).slice(0, 5);
  const error = discoverState.error || topicsState.error;

  return <AppShell><main className="xy-category-page xy-category-real">
    {error ? <Alert variant="destructive">{error}</Alert> : null}
    <header><div><h1>分类浏览</h1><p>从内容类型与社区专题出发，发现值得阅读的内容。</p></div><Image src="/prototype-assets/categories/planet.png" alt="" aria-hidden="true" width={234} height={121} /></header>
    <nav className="xy-category-pills" aria-label="内容类型筛选">{typeOptions.map((type) => <button type="button" className={activeType === type ? "active" : ""} onClick={() => setActiveType(type)} key={type}>{type === "ALL" ? <Grid2X2 /> : <FileText />}{type === "ALL" ? "全部" : typeLabel[type] || type}</button>)}</nav>
    <div className="xy-category-layout">
      <aside className="xy-category-tree"><h2>内容目录</h2>{typeOptions.map((type) => <button type="button" className={activeType === type ? "active" : ""} onClick={() => setActiveType(type)} key={type}><span><FileText />{type === "ALL" ? "全部内容" : typeLabel[type] || type}</span><small>{type === "ALL" ? contents.length : contents.filter((item) => item.objectType === type).length}</small></button>)}<Link href="/topics"><Hash />浏览社区专题</Link></aside>
      <section className="xy-category-feed"><header><div><h2>推荐内容</h2><p>根据公开内容实时加载</p></div><label><span className="sr-only">搜索内容</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前内容" /><Search /></label></header>{discoverState.loading ? <p className="xy-category-real-status">正在加载内容…</p> : null}{visible.map((item) => <Link href={item.objectType === "SERIES" ? `/series/${encodeURIComponent(item.id)}` : `/articles/${encodeURIComponent(item.id)}`} key={`${item.objectType}-${item.id}`}><ContentCover cover={item.cover} title={item.title} /><div><span>{typeLabel[item.objectType || ""] || "内容"}</span><h3>{item.title}</h3>{item.summary ? <p>{item.summary}</p> : null}<small>{item.authorName ? <><UserRound />{item.authorName}</> : "匿名作者"}{item.updatedAt ? <> · {formatDateTime(item.updatedAt)}</> : null}</small></div><p className="xy-category-real-metrics">{item.readMinutes ? <small><Eye />约 {item.readMinutes} 分钟</small> : null}</p></Link>)}{!discoverState.loading && !visible.length ? <div className="xy-category-real-status"><BookOpen /><h3>暂无匹配内容</h3><p>调整筛选条件，或稍后再来看看。</p></div> : null}</section>
      <aside className="xy-category-side"><section><header><h2>热门专题</h2><Link href="/topics">查看全部 ›</Link></header>{topics.slice(0, 5).map((topic) => <Link href={`/topics/${encodeURIComponent(topic.slug)}`} key={topic.id}><span className="xy-category-real-topic-icon"><Hash /></span><span><b>{topic.name}</b><small>{topic.description || "社区专题"}</small>{typeof topic.contentCount === "number" ? <em>{topic.contentCount} 篇内容</em> : null}</span></Link>)}{!topicsState.loading && !topics.length ? <p className="xy-category-real-aside-empty">暂无可展示专题。</p> : null}</section><section><header><h2>内容作者</h2><Link href="/creators">查看全部 ›</Link></header>{authors.map((name) => <Link href={`/users/${encodeURIComponent(name)}`} key={name}><i>{name.slice(0, 1).toUpperCase()}</i><span><b>{name}</b><small>来自当前推荐内容</small></span></Link>)}{!discoverState.loading && !authors.length ? <p className="xy-category-real-aside-empty">暂未获得作者信息。</p> : null}</section></aside>
    </div>
  </main></AppShell>;
}

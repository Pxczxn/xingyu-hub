"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bookmark, Filter, Heart, MessageCircle, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
const feedImages = ["feed-meaning", "feed-time", "feed-writing"];
export default function GalaxyContentPage() {
  const { slug: raw } = useParams<{ slug: string }>(); const slug = decodeURIComponent(raw || "");
  const [tab, setTab] = useState("推荐");
  const [type, setType] = useState("全部");
  const { data: galaxy, error } = useAsyncData(() => communityApi.getGalaxy(slug), [slug]);
  const { data: content, loading } = useAsyncData(() => communityApi.getGalaxyContent(slug, 30), [slug]);
  const visibleContent = useMemo(() => {
    const rows = (content ?? []).filter((item) => type === "全部" || item.objectType.toUpperCase() === type);
    if (tab === "精华") return rows.filter((item) => item.pinned);
    if (tab === "讨论") return rows.filter((item) => item.objectType.toUpperCase() === "MOMENT");
    if (tab === "推荐") return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return rows;
  }, [content, tab, type]);
  const cycleType = () => setType((current) => current === "全部" ? "ARTICLE" : current === "ARTICLE" ? "SERIES" : "全部");
  if (error) return <AppShell><main className="xy-galaxy-feed"><Alert variant="destructive">{error}</Alert></main></AppShell>;
  return <AppShell><main className="xy-galaxy-feed"><div className="xy-galaxy-feed-layout"><div><section className="xy-galaxy-feed-hero"><Image src="/prototype-assets/galaxy-feed/hero-galaxy.png" alt="" aria-hidden="true" fill priority /><div><h1>{galaxy?.name || "星系"}</h1><p>星系介绍暂未提供。</p><div className="xy-galaxy-feed-meta"><span><Users />成员 {galaxy?.memberCount == null ? "暂未提供" : galaxy.memberCount}</span><span>内容 {content?.length ?? 0}</span><span><Sparkles />等级暂未提供</span></div></div></section><nav className="xy-galaxy-feed-tabs" aria-label="星系内容筛选">{["推荐", "最新", "精华", "讨论"].map((label) => <button type="button" className={tab === label ? "is-active" : ""} aria-pressed={tab === label} onClick={() => setTab(label)} key={label}>{label}</button>)}<Button variant="outline" size="sm" onClick={cycleType}><Filter className="mr-2 h-4 w-4" />{type === "全部" ? "筛选" : type === "ARTICLE" ? "文章" : "系列"}</Button></nav>{loading ? <p className="py-20 text-center">正在加载内容…</p> : !visibleContent.length ? <EmptyState title="暂无匹配内容" description="当前筛选条件下没有可展示的星系内容" /> : <section className="xy-galaxy-feed-list">{visibleContent.slice(0, 8).map((item, i) => <Link href={contentHref({ id: item.objectId, objectType: item.objectType })} key={item.id}><Image src={`/prototype-assets/galaxy-feed/${feedImages[i % 3]}.png`} alt="" aria-hidden="true" width={264} height={143} /><div><h2>{item.title || "未命名内容"}</h2><p>内容摘要暂未提供。</p><span>{item.pinned ? "精选推荐" : "公开内容"}</span></div><aside><span><MessageCircle />互动数据暂未提供</span><span><Heart />点赞数据暂未提供</span><Bookmark /></aside></Link>)}</section>}</div><aside className="xy-galaxy-feed-side"><section><h2>星系公告</h2><b>公告内容暂未提供</b><p>星系公告发布后会在这里展示。</p><Link href="/announcements">查看公告 ›</Link></section><section><div className="xy-galaxy-section-title"><h2>热门讨论</h2><Link href="/topics">查看全部 ›</Link></div><p className="xy-hot-topic">热门讨论数据暂未提供。</p></section><section className="xy-galaxy-light"><h2>星系之光</h2><span>星</span><div><small>创作者推荐</small><b>推荐数据暂未提供</b><p>互动数据暂未提供</p></div></section></aside></div></main></AppShell>;
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Bookmark, BookOpenText, CalendarDays, Copy, FileText, FolderHeart, Globe2, LoaderCircle, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function typeLabel(type?: string) {
  return type === "SERIES" ? "系列" : type === "MOMENT" ? "动态" : "文章";
}

function visibilityLabel(value?: string) {
  return value === "PUBLIC" ? "公开收藏夹" : value === "UNLISTED" ? "链接可见" : "仅自己可见";
}

export default function CollectionPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { data: collection, loading, error } = useAsyncData(() => communityApi.getCollection(collectionId), [collectionId]);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) return <AppShell><main className="grid min-h-[70vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none"/></main></AppShell>;
  if (error || !collection) return <AppShell><main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center"><div><h1 className="text-2xl font-semibold text-[#23345a]">该收藏夹暂时无法访问</h1><p className="mt-3 text-muted-foreground">{error || "收藏夹不存在、未公开或已被移除"}</p><Button asChild variant="outline" className="mt-6 rounded-xl"><Link href="/collections/public">浏览公开收藏</Link></Button></div></main></AppShell>;

  const items = collection.items ?? [];
  const articleCount = items.filter((item) => item.objectType !== "SERIES" && item.objectType !== "MOMENT").length;
  const seriesCount = items.filter((item) => item.objectType === "SERIES").length;
  const visibleTitle = collection.title || "公开收藏夹";

  return <AppShell><main className="mx-auto w-full max-w-[1420px] px-5 pb-16 pt-8 sm:px-8 lg:px-10"><div className="relative overflow-hidden rounded-[1.35rem] border border-white/75 shadow-[0_16px_38px_rgb(26_35_62/.09)]"><img className="h-[11.6rem] w-full object-cover sm:h-[13.5rem]" src="/prototype-assets/public-collection-detail/hero.png" alt="星语收藏夹背景"/><span className="absolute inset-0 bg-[linear-gradient(90deg,rgb(13_30_67/.35),transparent_60%)]" aria-hidden="true"/></div><div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23.5rem]"><section><header className="rounded-[1.35rem] border border-[#eee5db] bg-[rgb(255_253_249/.76)] px-6 py-6 shadow-[0_12px_30px_rgb(42_35_27/.035)] backdrop-blur-xl sm:px-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="text-[2.1rem] font-semibold tracking-[-0.045em] text-[#172a50] sm:text-[2.5rem]">{visibleTitle}</h1><p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#788499]"><Globe2 className="h-4 w-4"/>{visibilityLabel(collection.visibility)}</p><p className="mt-3 max-w-3xl text-[0.97rem] leading-7 text-[#627087]">{collection.description || "这个收藏夹尚未填写说明。"}</p></div><Button variant="outline" size="sm" onClick={() => void copyLink()} className="h-10 shrink-0 rounded-xl bg-white/65"><Share2 className="mr-1.5 h-4 w-4"/>{copied ? "已复制" : "分享"}</Button></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-[#eee0cf] bg-[rgb(255_250_244/.54)] px-5 py-4 sm:grid-cols-3"><span><b className="block text-[1.12rem] text-[#24375e]">{items.length}</b><small className="mt-1 block text-xs text-[#7e899b]">已收藏内容</small></span><span><b className="block text-[1.12rem] text-[#24375e]">{articleCount}</b><small className="mt-1 block text-xs text-[#7e899b]">文章与动态</small></span><span><b className="block text-[1.12rem] text-[#24375e]">{seriesCount}</b><small className="mt-1 block text-xs text-[#7e899b]">系列</small></span></div></header><section className="mt-5 overflow-hidden rounded-[1.35rem] border border-[#eee5db] bg-[rgb(255_253_249/.76)] shadow-[0_12px_30px_rgb(42_35_27/.035)] backdrop-blur-xl"><header className="flex items-center justify-between border-b border-[#eee5db] px-6 py-4"><div><h2 className="font-semibold text-[#26375b]">收藏内容</h2><p className="mt-1 text-xs text-[#8791a1]">公开收藏中可访问的文章、系列和动态</p></div><span className="rounded-full bg-[#fff0de] px-3 py-1 text-xs font-medium text-[#c47b24]">{items.length} 项</span></header>{items.length ? <ul role="list" className="divide-y divide-[#eee7de]">{items.map((item, index) => <li key={item.id} className="flex items-center gap-4 px-5 py-4 sm:px-6"><span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#233b67,#7e96b4)] text-sm font-semibold text-white">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><Link href={contentHref({ id: item.objectId || item.id, objectType: item.objectType })} className="block truncate text-[1rem] font-semibold text-[#26375b] hover:text-[rgb(var(--violet))]">{item.title || "未命名内容"}</Link><span className="mt-2 inline-flex items-center gap-2"><span className="rounded-full bg-[#fff0de] px-2 py-0.5 text-[0.7rem] font-medium text-[#c47b24]">{typeLabel(item.objectType)}</span><span className="text-xs text-[#8a94a4]">已收录</span></span></span><Link href={contentHref({ id: item.objectId || item.id, objectType: item.objectType })} className="hidden h-9 items-center rounded-lg border border-[#e8a45c] px-4 text-sm font-medium text-[#bd7020] hover:bg-[#fff6e9] sm:inline-flex">阅读</Link><Bookmark className="h-4 w-4 shrink-0 text-[#77859b]" aria-hidden="true"/></li>)}</ul> : <div className="grid min-h-[23rem] place-items-center px-6 text-center"><div><FolderHeart className="mx-auto h-10 w-10 text-[#d49b52]"/><h2 className="mt-4 text-xl font-semibold text-[#26375b]">这个公开收藏夹还没有内容</h2><p className="mt-2 text-sm text-[#7b8495]">收藏的内容会在这里按创建者的公开设置展示。</p></div></div>}</section></section><aside className="space-y-5"><section className="rounded-[1.35rem] border border-[#eee5db] bg-[rgb(255_253_249/.76)] px-6 py-6 shadow-[0_12px_30px_rgb(42_35_27/.035)] backdrop-blur-xl"><h2 className="font-semibold text-[#26375b]">收藏夹信息</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-[#788499]">可见范围</dt><dd className="text-right font-medium text-[#34415e]">{visibilityLabel(collection.visibility)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#788499]">内容类型</dt><dd className="text-right font-medium text-[#34415e]">{[articleCount ? "文章/动态" : "", seriesCount ? "系列" : ""].filter(Boolean).join(" · ") || "暂无内容"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#788499]">内容总数</dt><dd className="font-medium text-[#34415e]">{items.length}</dd></div></dl></section><section className="rounded-[1.35rem] border border-[#eee5db] bg-[rgb(255_253_249/.76)] px-6 py-6 shadow-[0_12px_30px_rgb(42_35_27/.035)] backdrop-blur-xl"><h2 className="font-semibold text-[#26375b]">继续探索</h2><p className="mt-3 text-sm leading-6 text-[#788499]">在发现页浏览更多文章、系列与公开收藏夹。</p><Button asChild variant="outline" className="mt-5 w-full rounded-xl"><Link href="/discover"><BookOpenText className="mr-2 h-4 w-4"/>去发现</Link></Button><Button asChild variant="ghost" className="mt-2 w-full rounded-xl"><Link href="/collections/public"><Copy className="mr-2 h-4 w-4"/>公开收藏夹</Link></Button></section></aside></div></main></AppShell>;
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Camera, Check, CircleUserRound, ExternalLink, Globe2, Heart, Home, Link2, LoaderCircle, Settings, Star, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type CollectionSummary, type InsightsView, type ProfileDetail } from "@/lib/community-api";

type ProfilePageData = { profile: ProfileDetail; collections: CollectionSummary[]; insights: InsightsView };

const navItems = [
  [Home, "个人主页", "/me"],
  [CircleUserRound, "编辑主页", "/settings/profile"],
  [Star, "我的作品", "/studio/content"],
  [Heart, "收藏夹", "/me/collections"],
  [UsersRound, "关注与粉丝", "/me/following"],
  [Settings, "账号设置", "/settings/account"],
] as const;

function profileInitial(profile: ProfileDetail | null) {
  return (profile?.displayName || profile?.username || "星").trim().slice(0, 1).toUpperCase();
}

function ValueStat({ value, label }: { value?: number; label: string }) {
  return <span><b className="block text-[1.12rem] font-semibold text-[#25385f]">{value ?? "—"}</b><small className="mt-1 block text-[0.72rem] text-[#8490a2]">{label}</small></span>;
}

export default function ProfileSettingsPage() {
  const [data, setData] = useState<ProfilePageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([communityApi.getMyProfile(), communityApi.getCollections(), communityApi.getMyInsights()])
      .then(([profile, collections, insights]) => setData({ profile, collections, insights }))
      .catch(() => setError("请先登录后再编辑资料"));
  }, []);

  const profile = data?.profile ?? null;
  const update = (key: keyof ProfileDetail, value: string) => setData((previous) => previous ? { ...previous, profile: { ...previous.profile, [key]: value } } : previous);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const saved = await communityApi.updateMyProfile({
        displayName: profile.displayName || null,
        bio: profile.bio || null,
        websiteUrl: profile.websiteUrl || null,
        visibility: profile.visibility || "PUBLIC",
      });
      setData((previous) => previous ? { ...previous, profile: saved } : previous);
      setSuccess("个人主页已保存");
    } catch { setError("保存失败，请稍后重试"); }
    finally { setSaving(false); }
  }

  if (!profile && !error) return <AppShell><main className="grid min-h-[70vh] place-items-center"><LoaderCircle className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" /></main></AppShell>;
  if (!profile) return <AppShell><main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center"><div><h1 className="text-2xl font-semibold text-[#23345a]">暂时无法打开个人主页编辑器</h1><p className="mt-3 text-muted-foreground">{error}</p><Button asChild className="mt-6 rounded-xl"><Link href="/login">去登录</Link></Button></div></main></AppShell>;

  return <AppShell><main className="mx-auto max-w-[1450px] px-5 pb-14 pt-8 lg:px-8"><div className="grid gap-6 xl:grid-cols-[210px_minmax(0,1fr)_300px]"><aside className="h-fit rounded-[22px] border border-[#eee2d3] bg-white/72 p-5 shadow-[0_10px_28px_rgb(86_60_33/.06)] backdrop-blur-xl"><nav className="space-y-2" aria-label="个人中心"><>{navItems.map(([Icon, label, href]) => <Link href={href} key={label} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm ${label === "编辑主页" ? "bg-[#fcf1df] font-semibold text-[#1f315a]" : "text-[#35415d] hover:bg-[#faf6ef]"}`}><Icon className="h-5 w-5"/>{label}</Link>)}</></nav><div className="mt-28 rounded-xl border border-[#f0e5d5] bg-[#fdf8f0] p-4 text-sm text-[#556078]"><Star className="h-4 w-4 text-[#eaa64e]"/><p className="mt-3">完善主页，让更多人了解你</p><p className="mt-4 text-xs">资料会同步展示在公开个人主页</p></div></aside>
    <form onSubmit={save} className="rounded-[24px] border border-[#eee2d3] bg-white/78 p-6 shadow-[0_12px_34px_rgb(86_60_33/.07)] backdrop-blur-xl sm:p-7"><header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[#142957]">编辑个人主页</h1><p className="mt-1 text-sm text-slate-500">展示你的创作身份，让更多人发现你</p></div><div className="flex gap-2"><Link href={`/users/${profile.username}`} className="inline-flex h-9 items-center rounded-md border border-[#e7ded3] px-4 text-sm hover:bg-white">取消</Link><Button disabled={saving} className="h-9 bg-[#ec8b35] text-white hover:bg-[#df7d2d]">{saving ? "保存中…" : "保存更改"}</Button></div></header>{error && <Alert variant="destructive" className="mt-4">{error}</Alert>}{success && <Alert className="mt-4"><Check className="h-4 w-4"/>{success}</Alert>}
      <section className="relative mt-6"><img src="/prototype-assets/profile-edit/cover.png" alt="星空主页封面" className="h-44 w-full rounded-xl object-cover"/><span className="absolute right-5 top-4 inline-flex items-center gap-1 rounded-full bg-white/90 px-4 py-2 text-xs text-[#526078] shadow"><Camera className="h-3.5 w-3.5"/>封面设置待开放</span><div className="absolute -bottom-14 left-7 grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(145deg,#21395f,#9cacc2)] text-3xl font-semibold text-white shadow-lg">{profile.avatar ? <img src={profile.avatar} alt={`${profile.displayName || profile.username} 的头像`} className="h-full w-full object-cover"/> : profileInitial(profile)}</div></section>
      <section className="mt-20 grid gap-5 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#25365e]">显示名称<input value={profile.displayName || ""} onChange={(event) => update("displayName", event.target.value)} maxLength={60} className="h-10 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal outline-none focus:border-[#ef913d]"/></label><label className="grid gap-2 text-sm font-semibold text-[#25365e]">主页可见范围<select value={profile.visibility || "PUBLIC"} onChange={(event) => update("visibility", event.target.value)} className="h-10 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal outline-none focus:border-[#ef913d]"><option value="PUBLIC">所有人可见</option><option value="UNLISTED">链接可见</option><option value="PRIVATE">仅自己可见</option></select></label></section>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-[#25365e]">个人介绍<textarea value={profile.bio || ""} maxLength={180} onChange={(event) => update("bio", event.target.value)} placeholder="介绍一下自己和你的创作方向" className="h-28 resize-none rounded-lg border border-[#e8ded2] bg-white p-3 font-normal leading-6 outline-none focus:border-[#ef913d]"/><small className="text-right font-normal text-slate-400">{profile.bio?.length || 0}/180</small></label>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-[#25365e]">个人网站<span className="flex h-10 items-center gap-2 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal"><Link2 className="h-4 w-4"/><input value={profile.websiteUrl || ""} onChange={(event) => update("websiteUrl", event.target.value)} placeholder="https://example.com" className="min-w-0 flex-1 outline-none"/></span></label>
      <section className="mt-6 border-t border-[#eee5dc] pt-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#25365e]">我的收藏夹</h2><p className="mt-1 text-xs text-slate-400">展示你已创建的收藏夹数据</p></div><Link href="/me/collections" className="text-sm text-[#b86f1d] hover:underline">查看全部</Link></div>{data.collections.length ? <ul className="mt-3 grid gap-3 md:grid-cols-3">{data.collections.slice(0, 3).map((collection) => <li key={collection.id} className="flex items-center gap-3 rounded-lg border border-[#eee4d9] bg-white/55 p-3"><span className="grid h-11 w-11 place-items-center rounded-lg bg-[#f6eee2] text-[#c68736]"><Heart className="h-4 w-4"/></span><span className="min-w-0 flex-1"><b className="block truncate text-xs text-[#34415e]">{collection.title}</b><small className="mt-1 block text-[11px] text-slate-400">{collection.itemCount} 项内容 · {collection.visibility === "PUBLIC" ? "公开" : "仅自己"}</small></span></li>)}</ul> : <div className="mt-3 rounded-lg border border-dashed border-[#eadfce] px-4 py-6 text-center text-sm text-[#7b8495]">尚未创建收藏夹</div>}</section>
    </form>
    <aside><p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#2a3b61]"><i className="h-2 w-2 rounded-full bg-[#55ad78]"/>预览效果</p><p className="-mt-3 mb-6 text-xs text-slate-400">实时预览你的主页</p><div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white shadow-[0_16px_34px_rgb(86_60_33/.1)]"><img src="/prototype-assets/profile-edit/cover.png" alt="" className="h-28 w-full object-cover"/><div className="mx-auto -mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(145deg,#21395f,#9cacc2)] text-xl font-semibold text-white">{profile.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover"/> : profileInitial(profile)}</div><div className="p-5 text-center"><h2 className="text-xl font-semibold text-[#192d58]">{profile.displayName || profile.username}</h2><p className="mt-1 text-xs text-slate-400">@{profile.username}</p><p className="mt-4 whitespace-pre-line text-left text-xs leading-5 text-slate-500">{profile.bio || "暂未填写个人介绍"}</p><div className="mt-4 grid grid-cols-3 text-sm"><ValueStat value={data.insights.articleCount} label="作品"/><ValueStat value={data.insights.followerCount} label="关注者"/><ValueStat value={data.insights.followingCount} label="关注中"/></div>{profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-[#b86f1d] hover:underline"><Globe2 className="h-4 w-4"/>访问网站 <ExternalLink className="h-3 w-3"/></a>}<div className="mt-5 border-t border-[#eee5dc] pt-4 text-left"><p className="text-xs font-semibold text-[#34415e]">公开收藏夹</p>{data.collections.filter((item) => item.visibility === "PUBLIC").slice(0, 2).map((collection) => <Link key={collection.id} href={`/collections/${collection.id}`} className="mt-3 flex items-center gap-2 text-xs text-[#647086] hover:text-[rgb(var(--violet))]"><Heart className="h-3.5 w-3.5 text-[#c68736]"/><span className="truncate">{collection.title}</span><span className="ml-auto shrink-0">{collection.itemCount}</span></Link>)}</div></div></div></aside></div></main></AppShell>;
}

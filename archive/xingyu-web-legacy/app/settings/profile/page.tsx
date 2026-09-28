"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Check, ExternalLink, Globe2, Heart, LoaderCircle } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/api-client";
import { communityApi, type CollectionSummary, type InsightsView, type ProfileDetail } from "@/lib/community-api";

type ProfilePageData = { profile: ProfileDetail; collections: CollectionSummary[]; insights: InsightsView };

function ValueStat({ value, label }: { value?: number; label: string }) {
  return (
    <span>
      <b className="block text-[1.12rem] font-semibold text-[#25385f]">{value ?? "—"}</b>
      <small className="mt-1 block text-[0.72rem] text-[#8490a2]">{label}</small>
    </span>
  );
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
  const update = (key: keyof ProfileDetail, value: string) =>
    setData((previous) =>
      previous ? { ...previous, profile: { ...previous.profile, [key]: value } } : previous
    );

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await communityApi.updateMyProfile({
        displayName: profile.displayName || null,
        bio: profile.bio || null,
        websiteUrl: profile.websiteUrl || null,
        visibility: profile.visibility || "PUBLIC",
      });
      setData((previous) => (previous ? { ...previous, profile: saved } : previous));
      setSuccess("公开资料已保存");
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  if (!profile && !error) {
    return (
      <SettingsLayout>
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-[rgb(var(--violet))] motion-reduce:animate-none" />
        </div>
      </SettingsLayout>
    );
  }

  if (!profile) {
    return (
      <SettingsLayout>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#23345a]">暂时无法打开资料编辑器</h1>
          <p className="mt-3 text-muted-foreground">{error}</p>
          <Button asChild className="mt-6 rounded-xl">
            <Link href="/login">去登录</Link>
          </Button>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      aside={
        <>
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#2a3b61]">
            <i className="h-2 w-2 rounded-full bg-[#55ad78]" />
            预览效果
          </p>
          <div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-white shadow-[0_16px_34px_rgb(86_60_33/.1)]">
            <div className="relative h-28">
              <img
                src="/prototype-assets/profile/profile-cover.png"
                alt=""
                className="h-full w-full object-cover object-[center_38%]"
              />
              <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
                <Avatar
                  src={profile.avatar ? resolveMediaUrl(profile.avatar) : null}
                  fallback={profile.displayName || profile.username}
                  size="lg"
                  className="h-20 w-20 border-4 border-white bg-[linear-gradient(145deg,#21395f,#9cacc2)] text-xl font-semibold text-white shadow-[0_8px_20px_rgb(19_35_77/.18)]"
                />
              </div>
            </div>
            <div className="px-5 pb-5 pt-12 text-center">
              <h2 className="text-xl font-semibold text-[#192d58]">{profile.displayName || profile.username}</h2>
              <p className="mt-1 text-xs text-slate-400">@{profile.username}</p>
              <p className="mt-4 whitespace-pre-line text-left text-xs leading-5 text-slate-500">
                {profile.bio || "暂未填写个人介绍"}
              </p>
              <div className="mt-4 grid grid-cols-3 text-sm">
                <ValueStat value={data?.insights.articleCount} label="作品" />
                <ValueStat value={data?.insights.followerCount} label="关注者" />
                <ValueStat value={data?.insights.followingCount} label="关注中" />
              </div>
              <Link href={`/u/${profile.username}`} className="mt-5 inline-block text-sm text-[#b86f1d] hover:underline">
                查看我的主页 →
              </Link>
            </div>
          </div>
        </>
      }
    >
      <form onSubmit={save}>
        <header className="flex flex-col gap-4 border-b border-[#eee5dc] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#e58436]">公开资料</p>
            <h1 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[#142957]">公开资料</h1>
            <p className="mt-1 text-sm text-slate-500">管理基础公开资料与主页可见性</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/u/${profile.username}`}
              className="inline-flex h-9 items-center rounded-md border border-[#e7ded3] px-4 text-sm hover:bg-white"
            >
              取消
            </Link>
            <Button disabled={saving} className="h-9 bg-[#ec8b35] text-white hover:bg-[#df7d2d]">
              {saving ? "保存中…" : "保存更改"}
            </Button>
          </div>
        </header>
        {error && <Alert variant="destructive" className="mt-4">{error}</Alert>}
        {success && <Alert className="mt-4"><Check className="h-4 w-4" />{success}</Alert>}
        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#25365e]">
            显示名称
            <input
              value={profile.displayName || ""}
              onChange={(event) => update("displayName", event.target.value)}
              maxLength={60}
              className="h-10 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal outline-none focus:border-[#ef913d]"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#25365e]">
            主页可见范围
            <select
              value={profile.visibility || "PUBLIC"}
              onChange={(event) => update("visibility", event.target.value)}
              className="h-10 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal outline-none focus:border-[#ef913d]"
            >
              <option value="PUBLIC">所有人可见</option>
              <option value="UNLISTED">链接可见</option>
              <option value="PRIVATE">仅自己可见</option>
            </select>
          </label>
        </section>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-[#25365e]">
          个人介绍
          <textarea
            value={profile.bio || ""}
            maxLength={180}
            onChange={(event) => update("bio", event.target.value)}
            placeholder="介绍一下自己和你的创作方向"
            className="h-28 resize-none rounded-lg border border-[#e8ded2] bg-white p-3 font-normal leading-6 outline-none focus:border-[#ef913d]"
          />
        </label>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-[#25365e]">
          个人网站
          <span className="flex h-10 items-center gap-2 rounded-lg border border-[#e8ded2] bg-white px-3 font-normal">
            <Globe2 className="h-4 w-4" />
            <input
              value={profile.websiteUrl || ""}
              onChange={(event) => update("websiteUrl", event.target.value)}
              placeholder="https://example.com"
              className="min-w-0 flex-1 outline-none"
            />
          </span>
        </label>
        <section className="mt-6 border-t border-[#eee5dc] pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#25365e]">我的收藏夹</h2>
              <p className="mt-1 text-xs text-slate-400">展示你已创建的收藏夹数据</p>
            </div>
            <Link href="/me/collections" className="text-sm text-[#b86f1d] hover:underline">查看全部</Link>
          </div>
          {data?.collections.length ? (
            <ul className="mt-3 grid gap-3 md:grid-cols-3">
              {data.collections.slice(0, 3).map((collection) => (
                <li key={collection.id} className="flex items-center gap-3 rounded-lg border border-[#eee4d9] bg-white/55 p-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#f6eee2] text-[#c68736]">
                    <Heart className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-xs text-[#34415e]">{collection.title}</b>
                    <small className="mt-1 block text-[11px] text-slate-400">
                      {collection.itemCount} 项 · {collection.visibility === "PUBLIC" ? "公开" : "仅自己"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[#eadfce] px-4 py-6 text-center text-sm text-[#7b8495]">
              尚未创建收藏夹
            </div>
          )}
        </section>
        <p className="mt-6 text-sm text-slate-500">
          粉丝列表等隐私选项请前往
          <Link href="/settings/privacy/profile" className="mx-1 text-[#e38334] hover:underline">主页隐私</Link>
          设置。
        </p>
      </form>
    </SettingsLayout>
  );
}

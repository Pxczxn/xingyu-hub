"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Bell,
  Camera,
  CircleUserRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  communityApi,
  type InsightsView,
  type MeAccount,
  type ProfileDetail,
} from "@/lib/community-api";

const nav = [
  ["账号资料", CircleUserRound, "/settings/account"],
  ["安全", ShieldCheck, "/settings/security"],
  ["通知", Bell, "/settings/notifications"],
  ["隐私", LockKeyhole, "/settings/privacy"],
] as const;

export default function AccountSettingsPage() {
  const [account, setAccount] = useState<MeAccount | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [insights, setInsights] = useState<InsightsView | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      communityApi.getMe(),
      communityApi.getMyProfile(),
      communityApi.getMyInsights(),
    ])
      .then(([nextAccount, nextProfile, nextInsights]) => {
        setAccount(nextAccount);
        setProfile(nextProfile);
        setInsights(nextInsights);
        setName(nextProfile.displayName || "");
        setBio(nextProfile.bio || "");
      })
      .catch(() => setError("请先登录后查看账号信息"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await communityApi.updateMyProfile({
        displayName: name.trim(),
        bio: bio.trim(),
      });
      setProfile(updated);
      setSuccess("账号资料已保存");
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  const avatar = profile?.avatar || "/prototype-assets/profile/avatar.png";
  const displayName = name || profile?.username || "未设置显示名称";
  const username = account?.username || profile?.username || "—";
  const profileBio = bio || "暂未填写个人介绍。";

  return (
    <AppShell>
      <main className="mx-auto max-w-[1450px] px-5 pb-14 pt-8 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[210px_minmax(0,1fr)_310px]">
          <aside className="rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_12px_32px_rgba(85,64,35,.07)]">
            <h1 className="text-[28px] font-bold text-[#142957]">账号设置</h1>
            <nav className="mt-7 space-y-2">
              {nav.map(([label, Icon, href]) => (
                <Link
                  href={href}
                  key={label}
                  className={
                    "flex h-12 items-center gap-3 rounded-xl px-4 text-sm transition " +
                    (label === "账号资料"
                      ? "bg-[#fff1df] font-semibold text-[#ed842f] shadow-[inset_-3px_0_0_#f18d36]"
                      : "text-[#293a60] hover:bg-[#fbf7f1]")
                  }
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
          <form
            onSubmit={save}
            className="rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md"
          >
            <header>
              <h1 className="text-[27px] font-bold text-[#162b57]">账号资料</h1>
              <p className="mt-1 text-sm text-slate-500">
                管理你的个人信息与账号设置
              </p>
            </header>
            {error && (
              <Alert variant="destructive" className="mt-4">
                {error}
              </Alert>
            )}
            <section className="mt-6 border-t border-[#eee6de] pt-5">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <img
                    src={avatar}
                    alt="头像"
                    className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-lg"
                  />
                  <button
                    type="button"
                    disabled
                    aria-label="头像上传暂未开放"
                    className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border border-[#e8e0d7] bg-white text-[#18315f] shadow"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h2 className="font-semibold text-[#1b2e58]">头像</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    建议尺寸 400×400px，支持 JPG / PNG 格式
                  </p>
                </div>
              </div>
            </section>
            <section className="mt-7 space-y-5">
              <label className="grid gap-2 text-sm font-semibold text-[#26365b]">
                显示名称
                <div className="relative">
                  <input
                    value={name}
                    maxLength={20}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#e8dfd5] bg-white/80 px-3 pr-16 font-normal outline-none focus:border-[#ee913f]"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400">
                    {name.length}/20
                  </span>
                </div>
                <small className="font-normal text-slate-400">
                  你在社区中展示的名称
                </small>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#26365b]">
                用户名
                <div className="relative">
                  <input
                    readOnly
                    value={username === "—" ? "" : username}
                    className="h-11 w-full rounded-lg border border-[#e8dfd5] bg-[#fcfaf7] px-3 font-normal text-slate-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400">
                    唯一用户名
                  </span>
                </div>
                <small className="font-normal text-slate-400">
                  你的唯一用户名，用于个人主页链接
                </small>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#26365b]">
                个人简介
                <div className="relative">
                  <textarea
                    value={bio}
                    maxLength={120}
                    onChange={(event) => setBio(event.target.value)}
                    className="h-24 w-full resize-none rounded-lg border border-[#e8dfd5] bg-white/80 p-3 font-normal leading-6 outline-none focus:border-[#ee913f]"
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                    {bio.length}/120
                  </span>
                </div>
                <small className="font-normal text-slate-400">
                  介绍一下你自己吧（选填）
                </small>
              </label>
            </section>
            <section className="mt-6 space-y-4 border-t border-[#eee6de] pt-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-2 text-[#26375e]">
                  <Mail className="h-5 w-5 shrink-0" />
                  <span className="truncate">
                    {account?.email || "未绑定邮箱"}
                  </span>
                  {account?.emailVerified && (
                    <i className="rounded bg-[#e3f2e8] px-2 py-1 text-xs not-italic text-[#3d9160]">
                      已验证
                    </i>
                  )}
                </span>
                <Link
                  href="/settings/security/email"
                  className="shrink-0 rounded-lg border border-[#e8dfd5] px-3 py-2"
                >
                  更换邮箱
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#26375e]">
                  <LockKeyhole className="h-5 w-5" />
                  ••••••••••••
                </span>
                <Link
                  href="/settings/security"
                  className="rounded-lg border border-[#e8dfd5] px-3 py-2"
                >
                  修改密码
                </Link>
              </div>
            </section>
            {success && <Alert className="mt-4">{success}</Alert>}
            <footer className="mt-6 flex justify-center border-t border-[#eee6de] pt-6">
              <Button
                disabled={saving || !profile}
                className="h-12 rounded-xl bg-[#ee8d38] px-12 text-white hover:bg-[#e17f2d]"
              >
                {saving ? "保存中…" : "保存更改"}
              </Button>
            </footer>
          </form>
          <aside className="rounded-[30px] border border-white/80 bg-white/75 p-3 shadow-[0_15px_42px_rgba(85,64,35,.08)]">
            <h2 className="px-3 pt-3 font-semibold text-[#24355c]">
              个人主页预览
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eee5db] bg-white text-center">
              <img
                src="/prototype-assets/profile/profile-space.png"
                alt="个人主页封面"
                className="h-32 w-full object-cover"
              />
              <img
                src={avatar}
                alt=""
                className="mx-auto -mt-11 h-20 w-20 rounded-full border-4 border-white object-cover shadow"
              />
              <h3 className="mt-3 text-2xl font-bold text-[#1a2e58]">
                {displayName}
              </h3>
              <p className="mt-1 text-sm text-slate-400">@{username}</p>
              <p className="mx-auto mt-4 max-w-[235px] whitespace-pre-line text-sm leading-6 text-slate-500">
                {profileBio}
              </p>
              <div className="mt-5 grid grid-cols-3 border-t border-[#eee6de] py-4 text-sm">
                <span>
                  <b>{insights?.articleCount ?? "—"}</b>
                  <small>文章</small>
                </span>
                <span>
                  <b>{insights?.followerCount ?? "—"}</b>
                  <small>关注者</small>
                </span>
                <span>
                  <b>{insights?.followingCount ?? "—"}</b>
                  <small>关注中</small>
                </span>
              </div>
              <Link
                href={username === "—" ? "/me" : "/users/" + username}
                className="mb-5 inline-block text-sm text-[#e88534]"
              >
                查看我的主页　→
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

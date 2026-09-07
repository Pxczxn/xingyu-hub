"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Bell,
  CircleUserRound,
  Eye,
  History,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi, type ProfileDetail } from "@/lib/community-api";

export default function PrivacySettingsPage() {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [followersVisibility, setFollowersVisibility] = useState("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    communityApi
      .getMyProfile()
      .then((data) => {
        setProfile(data);
        setFollowersVisibility(data.followersVisibility ?? "PUBLIC");
      })
      .catch(() => setError("请先登录后再设置隐私"));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await communityApi.updatePrivacy({ followersVisibility });
      setProfile(updated);
      setSuccess("隐私设置已保存");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.problem.detail || "保存失败"
          : "保存失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  }
  const item = (
    Icon: typeof Eye,
    title: string,
    desc: string,
    control: React.ReactNode,
  ) => (
    <div className="flex items-center gap-4 border-b border-[#eee7df] px-5 py-5 last:border-0">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f9f3ea] text-[#21355e]">
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-[#1a2d58]">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      {control}
    </div>
  );
  return (
    <AppShell>
      <main className="mx-auto max-w-[1450px] px-5 pb-14 pt-8 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
          <aside className="rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_12px_32px_rgba(85,64,35,.07)]">
            <h1 className="text-[28px] font-bold text-[#142957]">设置</h1>
            <nav className="mt-7 space-y-2">
              {[
                ["账号设置", CircleUserRound, "/settings/account"],
                ["安全设置", ShieldCheck, "/settings/security"],
                ["隐私设置", LockKeyhole, "/settings/privacy"],
                ["通知设置", Bell, "/settings/notifications"],
                ["内容偏好", Eye, "/settings/preferences"],
                ["举报记录", UsersRound, "/me/reports"],
              ].map(([label, Icon, href]) => {
                const C = Icon as typeof Eye;
                return (
                  <Link
                    key={label as string}
                    href={href as string}
                    className={`flex h-12 items-center gap-3 rounded-xl px-4 text-sm transition ${label === "隐私设置" ? "bg-[#fff1df] font-semibold text-[#ed842f] shadow-[inset_-3px_0_0_#f18d36]" : "text-[#293a60] hover:bg-[#fbf7f1]"}`}
                  >
                    <C className="h-5 w-5" />
                    {label as string}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <form
            onSubmit={submit}
            className="rounded-[30px] border border-white/80 bg-white/75 p-6 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md lg:p-9"
          >
            <header className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#fbf5ec] text-[#18305d] shadow">
                <LockKeyhole className="h-8 w-8" />
              </span>
              <div>
                <h1 className="text-[30px] font-bold tracking-tight text-[#132957]">
                  隐私设置
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  管理谁可以看到你的内容，以及你与他人的互动方式
                </p>
              </div>
            </header>
            <section className="mt-7 overflow-hidden rounded-2xl border border-[#eee5db] bg-white/75">
              {item(
                CircleUserRound,
                "个人资料可见范围",
                "选择谁可以查看你的个人资料和基本信息",
                <select
                  value={followersVisibility}
                  onChange={(e) => setFollowersVisibility(e.target.value)}
                  className="h-11 rounded-xl border border-[#e9dfd3] bg-white px-4 text-sm text-[#26375d]"
                >
                  <option value="PUBLIC">所有人</option>
                  <option value="PRIVATE">仅自己可见</option>
                </select>,
              )}
              {item(
                Eye,
                "内容可被搜索",
                "搜索隐私接口开放后可在这里调整",
                <span className="text-sm text-slate-400">暂未开放</span>,
              )}
              {item(
                History,
                "阅读历史可见性",
                "活动隐私接口开放后可在这里调整",
                <span className="text-sm text-slate-400">暂未开放</span>,
              )}
              {item(
                UsersRound,
                "互动权限",
                "互动隐私接口开放后可在这里调整",
                <span className="text-sm text-slate-400">暂未开放</span>,
              )}
              {item(
                Eye,
                "黑名单管理",
                "查看和管理已屏蔽的用户",
                <span className="text-sm text-slate-400">暂未开放</span>,
              )}
            </section>
            {error && (
              <Alert variant="destructive" className="mt-5">
                {error}
              </Alert>
            )}
            {success && <Alert className="mt-5">{success}</Alert>}
            <footer className="mt-6 flex items-center justify-between">
              <p className="flex max-w-md items-center gap-2 text-xs leading-5 text-slate-500">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#1e395f]" />
                你的隐私很重要。我们不会将你的个人信息用于个性化广告等用途。
              </p>
              <Button
                disabled={submitting || !profile}
                className="h-12 rounded-full bg-[#ed8c38] px-8 text-white hover:bg-[#df7d2d]"
              >
                {submitting ? "保存中…" : "保存设置"}
              </Button>
            </footer>
          </form>
          <aside className="rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_15px_42px_rgba(85,64,35,.08)]">
            <div className="grid h-40 place-items-center rounded-3xl bg-[radial-gradient(circle_at_50%_55%,#f4ba79_0%,#ffe8cf_28%,#fffaf3_60%)] text-[#e58a38]">
              <ShieldCheck className="h-20 w-20" />
            </div>
            <h2 className="mt-7 text-[26px] font-bold leading-tight text-[#1b2e58]">
              你的隐私，
              <br />
              由你掌控
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              在星语社区，你可以自由分享与交流。我们提供多种隐私选项，帮助你掌控个人信息与互动的可见范围。
            </p>
            <ul className="mt-6 space-y-4 border-t border-[#eee7dd] pt-6 text-sm leading-6 text-slate-600">
              <li>●　你的设置将仅应用于当前账号</li>
              <li>●　部分内容的可见性可能受话题或社区规则影响</li>
              <li>
                ●　如有疑问，可查看{" "}
                <span className="text-[#e38334]">帮助中心</span>{" "}
                了解更多隐私说明
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

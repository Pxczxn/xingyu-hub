"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AtSign, Bell, Check, CircleUserRound, Eye, Heart, History, LockKeyhole, Mail, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getNotificationPrefs, hydrateClientSettingsFromServer, saveNotificationPrefs, type NotificationPrefs } from "@/lib/user-preferences";

type PreferenceItem = {
  key: keyof NotificationPrefs;
  title: string;
  description: string;
  icon: typeof Bell;
};

const preferenceItems: PreferenceItem[] = [
  { key: "mentions", title: "提及与 @", description: "有人在内容或评论中提到你时提醒", icon: AtSign },
  { key: "comments", title: "评论与回复", description: "收到新评论、回复或讨论互动时提醒", icon: MessageCircle },
  { key: "follows", title: "新关注", description: "有人关注你或开始追更你的系列时提醒", icon: Heart },
  { key: "system", title: "系统通知", description: "接收账号安全、审核结果与社区公告提醒", icon: Bell },
];

const settingsNav = [
  ["账号设置", CircleUserRound, "/settings/account"],
  ["安全设置", ShieldCheck, "/settings/security"],
  ["隐私设置", LockKeyhole, "/settings/privacy"],
  ["通知设置", Bell, "/settings/notifications"],
  ["内容偏好", Eye, "/settings/preferences"],
  ["屏蔽与举报", UsersRound, "/reports"],
  ["外观设置", History, "/settings/preferences"],
] as const;

function PreferenceToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}${checked ? "已开启" : "已关闭"}`}
      onClick={onChange}
      className={`relative h-8 w-[54px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e88739] focus-visible:ring-offset-2 ${checked ? "bg-[#ef8b31]" : "bg-[#d9dfe8]"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_5px_rgba(20,41,87,.22)] transition-transform ${checked ? "translate-x-7" : "translate-x-1"}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void hydrateClientSettingsFromServer().then(() => setPrefs(getNotificationPrefs()));
  }, []);

  function toggle(key: keyof NotificationPrefs) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    saveNotificationPrefs(prefs);
    setSaved(true);
  }

  const enabledCount = prefs ? preferenceItems.filter((item) => prefs[item.key]).length : 0;

  return (
    <AppShell>
      <main className="xy-notification-settings-page mx-auto max-w-[1450px] px-5 pb-14 pt-8 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
          <aside className="h-fit rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_12px_32px_rgba(85,64,35,.07)] backdrop-blur-md">
            <h1 className="text-[28px] font-bold tracking-tight text-[#142957]">设置</h1>
            <nav className="mt-7 space-y-2" aria-label="设置菜单">
              {settingsNav.map(([label, Icon, href]) => (
                <Link key={label} href={href} className={`flex h-12 items-center gap-3 rounded-xl px-4 text-sm transition-colors ${label === "通知设置" ? "bg-[#fff1df] font-semibold text-[#ed842f] shadow-[inset_-3px_0_0_#f18d36]" : "text-[#293a60] hover:bg-[#fbf7f1]"}`}>
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          <form onSubmit={onSubmit} className="rounded-[30px] border border-white/80 bg-white/75 p-6 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md lg:p-9">
            <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#eee7df] pb-7">
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[#fbf5ec] text-[#18305d] shadow-[0_7px_16px_rgba(54,41,22,.1)]"><Bell className="h-8 w-8" /></span>
                <div>
                  <p className="text-sm font-medium text-[#e58436]">互动提醒</p>
                  <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">通知设置</h1>
                  <p className="mt-1 text-sm text-slate-500">选择想接收的社区消息类型</p>
                </div>
              </div>
              {prefs && <span className="inline-flex items-center gap-2 rounded-full border border-[#f0dfc8] bg-[#fffaf3] px-3 py-2 text-sm text-[#9a6131]"><Check className="h-4 w-4 text-[#e88739]" />已开启 {enabledCount} 项</span>}
            </header>

            {!prefs ? (
              <div className="grid min-h-72 place-items-center text-sm text-slate-500">正在加载你的通知偏好…</div>
            ) : (
              <>
                <section className="mt-7" aria-labelledby="notification-types-title">
                  <div className="flex items-end justify-between gap-4">
                    <div><h2 id="notification-types-title" className="text-lg font-bold text-[#1a2d58]">站内通知</h2><p className="mt-1 text-sm text-slate-500">关闭后，不再接收对应类型的站内提醒。</p></div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#eee5db] bg-white/75">
                    {preferenceItems.map(({ key, title, description, icon: Icon }) => (
                      <div key={key} className="flex items-center gap-4 border-b border-[#eee7df] px-5 py-5 last:border-b-0">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f9f3ea] text-[#21355e]"><Icon className="h-6 w-6" /></span>
                        <div className="min-w-0 flex-1"><h3 className="font-semibold text-[#1a2d58]">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>
                        <PreferenceToggle checked={prefs[key]} onChange={() => toggle(key)} label={title} />
                      </div>
                    ))}
                  </div>
                </section>
                <section className="mt-7 rounded-2xl border border-[#f0e4d7] bg-[#fffaf4] px-5 py-4">
                  <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#e88739]" /><p className="text-sm leading-6 text-[#745a42]">目前通知会通过站内消息送达。邮件和推送渠道将在对应服务配置完成后开放。</p></div>
                </section>
                {saved && <Alert className="mt-5">通知偏好已保存</Alert>}
                <footer className="mt-7 flex flex-wrap items-center justify-between gap-4"><p className="text-xs leading-5 text-slate-500">账号安全和必要服务提醒会优先保障送达。</p><Button type="submit" className="h-12 rounded-full bg-[#ed8c38] px-8 text-white hover:bg-[#df7d2d]">保存设置</Button></footer>
              </>
            )}
          </form>

          <aside className="h-fit rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_15px_42px_rgba(85,64,35,.08)] backdrop-blur-md">
            <div className="grid h-40 place-items-center rounded-3xl bg-[radial-gradient(circle_at_50%_40%,#f7c58d_0%,#ffe9d1_30%,#fffaf3_68%)] text-[#e58a38]"><Bell className="h-20 w-20 stroke-[1.35]" /></div>
            <h2 className="mt-7 text-[26px] font-bold leading-tight text-[#1b2e58]">把重要消息，<br />留在恰当的时候</h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">你可以按自己的阅读节奏管理提醒。互动、关注和系统消息都会在通知中心保留记录。</p>
            <Link href="/notifications" className="mt-6 inline-flex h-11 items-center rounded-full border border-[#e5d7c7] bg-white px-5 text-sm font-medium text-[#26375d] transition-colors hover:border-[#e88739] hover:text-[#d97827]">查看通知中心</Link>
            <ul className="mt-6 space-y-4 border-t border-[#eee7dd] pt-6 text-sm leading-6 text-slate-600"><li>站内通知支持随时标记已读</li><li>审核与账号安全通知不建议关闭</li><li>设置会同步到当前账号</li></ul>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

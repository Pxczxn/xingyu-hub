"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, BookOpen, LockKeyhole, Palette, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";

export default function SettingsPage() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    communityApi.getMyProfile().then((profile) => setUsername(profile.username)).catch(() => {});
  }, []);

  const sections = [
    {
      title: "账户",
      links: [
        { href: "/settings/profile", label: "个人资料" },
        { href: "/settings/security", label: "安全与会话" },
        { href: "/account/status", label: "账户状态" },
      ],
    },
    {
      title: "创作",
      links: [
        { href: "/studio", label: "创作控制台" },
        ...(username
          ? [{ href: `/users/${username}/works/settings/categories`, label: "创作空间分类" }]
          : []),
      ],
    },
    {
      title: "隐私与偏好",
      links: [
        { href: "/settings/privacy", label: "隐私设置" },
        { href: "/settings/notifications", label: "通知设置" },
        { href: "/settings/preferences", label: "偏好与无障碍" },
        { href: "/settings/search-history", label: "搜索历史" },
        { href: "/settings/data", label: "数据导出" },
        { href: "/settings/api-tokens", label: "开放 API" },
      ],
    },
  ];

  return (
    <AppShell>
      <main className="xy-page xy-settings-page max-w-5xl">
        <PageHero variant="compact" eyebrow="账户中心" title="设置" description="把星语社区调整成更适合你的样子。" />

        <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="hidden rounded-2xl border border-white/80 bg-white/65 p-3 shadow-[0_12px_30px_rgba(30,45,82,.05)] backdrop-blur-xl lg:block">
            <p className="px-3 py-2 text-xs font-semibold tracking-[.12em] text-[#8a93a6]">设置目录</p>
            {sections.map((section, index) => <a key={section.title} href={`#settings-${index}`} className="mt-1 block rounded-xl px-3 py-2.5 text-sm text-[#53617d] transition-colors hover:bg-[#f3f5fb] hover:text-[#273a68]">{section.title}</a>)}
          </aside>
          <div className="flex min-w-0 flex-col gap-4">
          {sections.map((section) => (
            <Card key={section.title} id={`settings-${sections.indexOf(section)}`} className="scroll-mt-24 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><CardTitle>{section.title}</CardTitle><CardDescription className="mt-1">管理{section.title}相关选项</CardDescription></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3fb] text-[#5368b2]">{section.title === "账户" ? <UserRound className="h-4 w-4" /> : section.title === "创作" ? <BookOpen className="h-4 w-4" /> : <Palette className="h-4 w-4" />}</span></div>
              <nav className="mt-4 grid gap-2 sm:grid-cols-2">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#e6e9f0] bg-white/60 px-4 py-3 text-sm transition-all hover:-translate-y-0.5 hover:border-[#d8b07d] hover:bg-white hover:shadow-[0_8px_18px_rgba(50,65,105,.07)]"
                  >
                    <span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f5f6fb] text-[#6072b5]">{link.label.includes("安全") || link.label.includes("状态") ? <ShieldCheck className="h-4 w-4" /> : link.label.includes("通知") ? <Bell className="h-4 w-4" /> : link.label.includes("开放") ? <LockKeyhole className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span><span className="truncate">{link.label}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#a4adbf] transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </nav>
            </Card>
          ))}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

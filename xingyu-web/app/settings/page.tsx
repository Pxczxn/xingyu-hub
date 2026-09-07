"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Download,
  Eye,
  LockKeyhole,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SETTINGS_MAIN_NAV } from "@/lib/settings-nav";
import { communityApi } from "@/lib/community-api";

const iconFor = (href: string) => {
  if (href.includes("profile")) return UserRound;
  if (href.includes("privacy")) return LockKeyhole;
  if (href.includes("notifications")) return Bell;
  if (href.includes("security")) return ShieldCheck;
  if (href.includes("data")) return Download;
  if (href.includes("preferences")) return Eye;
  if (href.includes("appearance")) return Palette;
  return UserRound;
};

export default function SettingsPage() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    communityApi.getMyProfile().then((profile) => setUsername(profile.username)).catch(() => {});
  }, []);

  const extraLinks = [
    { href: "/settings/search-history", label: "搜索历史" },
    { href: "/settings/api-tokens", label: "开放 API" },
    { href: "/account/status", label: "账号状态" },
    ...(username ? [{ href: `/u/${username}`, label: "查看公开主页" }] : []),
  ];

  return (
    <AppShell>
      <main className="xy-page xy-settings-page max-w-5xl">
        <PageHero variant="compact" eyebrow="账户中心" title="设置" description="管理账号、隐私、通知与数据。" />
        <Card className="p-4 sm:p-5">
          <CardTitle>设置目录</CardTitle>
          <CardDescription className="mt-1">所有设置页共享统一侧边导航</CardDescription>
          <nav className="mt-4 grid gap-2 sm:grid-cols-2">
            {SETTINGS_MAIN_NAV.filter((item) => item.href !== "/settings").map((item) => {
              const Icon = iconFor(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#e6e9f0] bg-white/60 px-4 py-3 text-sm transition-all hover:-translate-y-0.5 hover:border-[#d8b07d] hover:bg-white hover:shadow-[0_8px_18px_rgba(50,65,105,.07)]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f5f6fb] text-[#6072b5]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#a4adbf] transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </nav>
        </Card>
        <Card className="mt-4 p-4 sm:p-5">
          <CardTitle>更多</CardTitle>
          <nav className="mt-4 grid gap-2 sm:grid-cols-2">
            {extraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-[#e6e9f0] bg-white/60 px-4 py-3 text-sm text-[#35415d] hover:bg-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </Card>
      </main>
    </AppShell>
  );
}

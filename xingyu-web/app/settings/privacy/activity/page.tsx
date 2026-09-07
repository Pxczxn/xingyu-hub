"use client";

import Link from "next/link";
import { Compass, History, Sparkles } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

const items = [
  {
    icon: Compass,
    title: "内容可被搜索",
    description: "控制你的公开内容是否出现在搜索结果中",
    href: "/settings/search-history",
    action: "管理搜索历史",
  },
  {
    icon: History,
    title: "阅读历史可见性",
    description: "控制他人是否可以看到你的阅读足迹",
    status: "接口待接入",
  },
  {
    icon: Sparkles,
    title: "推荐与个性化",
    description: "管理推荐算法使用的偏好信号",
    href: "/settings/recommendation-feedback",
    action: "减少推荐记录",
  },
];

export default function PrivacyActivitySettingsPage() {
  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">隐私</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">阅读与推荐隐私</h1>
        <p className="mt-1 text-sm text-slate-500">管理搜索、阅读历史与推荐相关的隐私选项</p>
      </header>
      <section className="mt-7 overflow-hidden rounded-2xl border border-[#eee5db] bg-white/75">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-4 border-b border-[#eee7df] px-5 py-5 last:border-b-0"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#f9f3ea] text-[#21355e]">
              <item.icon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-[#1a2d58]">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
            {item.href ? (
              <Link
                href={item.href}
                className="shrink-0 rounded-xl border border-[#e9dfd3] px-4 py-2.5 text-sm text-[#26375d] hover:bg-[#faf7f1]"
              >
                {item.action}
              </Link>
            ) : (
              <span className="text-sm text-slate-400">{item.status}</span>
            )}
          </div>
        ))}
      </section>
    </SettingsLayout>
  );
}

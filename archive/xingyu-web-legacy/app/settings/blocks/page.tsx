"use client";

import Link from "next/link";
import { MessageSquareOff, ShieldOff, UsersRound } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

const links = [
  {
    icon: ShieldOff,
    title: "屏蔽用户",
    description: "查看与管理已屏蔽的用户列表（接口待接入）",
    href: null,
    status: "暂未开放",
  },
  {
    icon: MessageSquareOff,
    title: "减少推荐",
    description: "记录不感兴趣的内容类型，优化推荐结果",
    href: "/settings/recommendation-feedback",
    status: null,
  },
  {
    icon: UsersRound,
    title: "举报记录",
    description: "查看你提交的社区举报与处理进度",
    href: "/reports",
    status: null,
  },
];

export default function BlocksSettingsPage() {
  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">屏蔽</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">屏蔽管理</h1>
        <p className="mt-1 text-sm text-slate-500">管理屏蔽用户与减少推荐记录</p>
      </header>
      <section className="mt-7 overflow-hidden rounded-2xl border border-[#eee5db] bg-white/75">
        {links.map((item) => (
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
                管理
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

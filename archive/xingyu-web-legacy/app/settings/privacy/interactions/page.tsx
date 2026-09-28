"use client";

import Link from "next/link";
import { AtSign, Eye, UsersRound } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

const items = [
  {
    icon: UsersRound,
    title: "陌生人私信",
    description: "控制谁可以向你发起私信（EVERYONE / FOLLOWING / NOBODY）",
    status: "接口待接入",
  },
  {
    icon: AtSign,
    title: "@ 提及",
    description: "控制谁可以在内容或评论中 @ 你",
    status: "接口待接入",
  },
  {
    icon: Eye,
    title: "在线与输入状态",
    description: "是否向他人展示在线状态与正在输入",
    status: "接口待接入",
  },
];

export default function PrivacyInteractionsSettingsPage() {
  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">隐私</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">互动隐私</h1>
        <p className="mt-1 text-sm text-slate-500">管理私信、提及与在线状态等互动权限</p>
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
            <span className="text-sm text-slate-400">{item.status}</span>
          </div>
        ))}
      </section>
      <p className="mt-6 text-sm text-slate-500">
        拉黑用户请前往
        <Link href="/settings/blocks" className="mx-1 text-[#e38334] hover:underline">屏蔽管理</Link>
        。拉黑优先级高于上述互动偏好。
      </p>
    </SettingsLayout>
  );
}

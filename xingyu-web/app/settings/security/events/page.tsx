"use client";

import Link from "next/link";
import { Clock3, ShieldCheck } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default function SecurityEventsPage() {
  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">安全</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">安全事件</h1>
        <p className="mt-1 text-sm text-slate-500">查看近期登录、密码与邮箱变更等安全相关记录</p>
      </header>
      <section className="mt-7 rounded-2xl border border-dashed border-[#e8dfd5] bg-white/70 p-8 text-center">
        <Clock3 className="mx-auto h-10 w-10 text-[#a4adbf]" />
        <p className="mt-4 text-sm text-slate-500">安全事件时间线接口待接入。</p>
        <p className="mt-2 text-sm text-slate-400">
          你仍可在
          <Link href="/settings/security/sessions" className="mx-1 text-[#e38334] hover:underline">
            设备与会话
          </Link>
          中管理登录设备。
        </p>
      </section>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-[#4a9a68]" />
        异常登录与安全设置变更将产生通知提醒。
      </p>
    </SettingsLayout>
  );
}

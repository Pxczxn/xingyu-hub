"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { ArrowRight, MessageSquare, Users, UserRound } from "lucide-react";

export default function MessagesEmptyPage() {
  return (
    <AppShell>
      <main className="xy-page max-w-4xl">
        <section className="xy-orbit-bg rounded-[26px] border border-white/80 bg-white/72 p-6 shadow-[0_16px_42px_rgba(30,45,82,.08)] backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef1ff] text-[#5266b0]"><MessageSquare className="h-6 w-6" /></span><div><p className="xy-kicker">社区沟通</p><h1 className="mt-1 text-[28px] font-bold tracking-[-.04em] text-[#172b58]">从一次对话开始</h1><p className="mt-2 text-sm leading-6 text-[#69748a]">和同频的人分享想法，也可以创建一个小组一起交流。</p></div></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href="/messages/new" className="group flex items-center gap-4 rounded-2xl border border-[#e3e7f0] bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0df] text-[#d17b2b]"><UserRound className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block text-[#2a3d68]">发起私信</b><small className="mt-1 block text-xs text-[#8992a4]">找到一位创作者聊聊</small></span><ArrowRight className="h-4 w-4 text-[#a1aabd] transition-transform group-hover:translate-x-1" /></Link><Link href="/messages/groups/new" className="group flex items-center gap-4 rounded-2xl border border-[#e3e7f0] bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef7f2] text-[#4d9470]"><Users className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block text-[#2a3d68]">创建群聊</b><small className="mt-1 block text-xs text-[#8992a4]">邀请朋友一起讨论</small></span><ArrowRight className="h-4 w-4 text-[#a1aabd] transition-transform group-hover:translate-x-1" /></Link></div>
        </section>
      </main>
    </AppShell>
  );
}

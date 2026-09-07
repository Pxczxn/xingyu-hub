"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Compass, PenLine, UserRound } from "lucide-react";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";

export default function MeEmptyPage() {
  return (
    <CompactPageShell eyebrow="个人中心" title="个人中心还是空的" description="从一个小动作开始，慢慢建立属于你的星语轨迹" width="md">
      <section className="xy-orbit-bg rounded-[24px] border border-white/80 bg-white/72 p-5 shadow-[0_16px_40px_rgba(30,45,82,.07)] backdrop-blur-xl sm:p-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1ff] text-[#5368b4]"><UserRound className="h-5 w-5" /></span><div><h2 className="font-semibold text-[#263963]">建立你的个人轨迹</h2><p className="mt-1 text-xs text-[#8a93a5]">完善资料、阅读内容、记录灵感</p></div></div>
        <div className="mt-5 grid gap-2.5">{[[UserRound,"完善个人资料","让别人更快了解你","/settings/profile"],[Compass,"探索社区内容","发现感兴趣的文章与话题","/discover"],[BookOpen,"开始一次阅读","把喜欢的内容留在书架","/me/bookshelf"],[PenLine,"发布第一条动态","分享此刻的想法","/studio/moments/new"]].map(([Icon,title,desc,href]) => { const C=Icon as typeof UserRound; return <Link key={String(title)} href={String(href)} className="group flex items-center gap-3 rounded-xl border border-[#e6e9f0] bg-white/65 p-3 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f5f6fb] text-[#6073b6]"><C className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block text-sm text-[#304267]">{String(title)}</b><small className="mt-0.5 block text-xs text-[#8992a4]">{String(desc)}</small></span><ArrowRight className="h-4 w-4 text-[#a1aabd] transition-transform group-hover:translate-x-1" /></Link> })}</div>
      </section>
    </CompactPageShell>
  );
}

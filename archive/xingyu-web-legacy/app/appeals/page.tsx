"use client";

import Link from "next/link";
import { CircleAlert, FileClock, Gavel, HeartHandshake, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

const statusLabel: Record<string, string> = { PENDING: "处理中", UNDER_REVIEW: "复核中", APPROVED: "已支持", REJECTED: "未支持", CLOSED: "已关闭" };
const statusClass: Record<string, string> = { PENDING: "bg-[#fff0dd] text-[#d77b27]", UNDER_REVIEW: "bg-[#eaf1ff] text-[#5479bf]", APPROVED: "bg-[#e8f5eb] text-[#368357]", REJECTED: "bg-[#fff0ed] text-[#b55f4a]", CLOSED: "bg-slate-100 text-slate-500" };

export default function AppealsPage() {
  const { data: appeals, loading, error } = useAsyncData(() => communityApi.getMyAppeals(), []);
  return <AppShell><main className="mx-auto max-w-[1325px] px-5 pb-16 pt-10 lg:px-8"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_365px]">
    <section className="rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_16px_44px_rgba(85,64,35,.09)] backdrop-blur-md">
      <header className="text-center"><h1 className="font-serif text-[38px] font-bold tracking-[.08em] text-[#18305c]">举报与申诉</h1><p className="mt-3 text-[15px] text-slate-500">查看申诉处理进度，维护你的正当权益</p><div className="mx-auto mt-7 flex max-w-[490px] rounded-full border border-[#eadfce] bg-white/70 p-1"><Link href="/reports" className="flex h-11 flex-1 items-center justify-center rounded-full text-[16px] font-semibold text-[#263961]">我的举报</Link><span className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#e89425] text-[16px] font-semibold text-white">我的申诉</span></div></header>
      <div className="mt-7 overflow-hidden rounded-[23px] border border-[#eee2d6] bg-white/70">
        <div className="grid grid-cols-[1fr_1fr_.78fr_1fr_auto] gap-3 border-b border-[#eee5dc] px-6 py-4 text-sm font-semibold text-[#50607d]"><span>关联案件</span><span>申诉说明</span><span>状态</span><span>提交时间</span><span>操作</span></div>
        {loading ? <p className="py-16 text-center text-sm text-slate-400">正在加载申诉记录…</p> : error ? <p className="py-16 text-center text-sm text-[#b75e42]">{error}</p> : !appeals?.length ? <EmptyState title="暂无申诉" description="如你认为治理处理存在误判，可提交申诉申请复核。" actionLabel="提交申诉" actionHref="/appeals/new" /> : <div>{appeals.map(appeal => <div key={appeal.id} className="grid grid-cols-[1fr_1fr_.78fr_1fr_auto] items-center gap-3 border-b border-[#f0e8df] px-6 py-4 last:border-0"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eef2f8] text-[#304a7c]"><Gavel className="h-5 w-5" /></span><div><b className="text-[#1d315d]">案件 {appeal.caseId}</b><p className="mt-1 text-xs text-slate-400">申诉编号 {appeal.id}</p></div></div><p className="line-clamp-2 text-sm text-[#52627d]">{appeal.body || "未提供补充说明"}</p><span className={"w-fit rounded-full px-3 py-1.5 text-xs font-semibold " + (statusClass[appeal.status] || "bg-slate-100 text-slate-500")}>{statusLabel[appeal.status] || appeal.status}</span><time className="text-sm text-slate-500">{formatDateTime(appeal.createdAt)}</time><Link href={"/appeals/" + appeal.id} className="rounded-full border border-[#eccdab] px-4 py-2 text-sm text-[#486080]">查看详情</Link></div>)}</div>}
      </div>
      <p className="mt-5 text-center text-sm text-slate-400">申诉提交后将由独立人员复核；请基于事实补充必要的说明或证据。</p>
    </section>
    <aside className="rounded-[30px] border border-white/80 bg-white/75 p-7 shadow-[0_16px_44px_rgba(85,64,35,.09)]"><div className="text-center"><HeartHandshake className="mx-auto h-11 w-11 text-[#e59a35]" /><h2 className="mt-3 font-serif text-2xl font-bold text-[#1b315d]">公平复核每一次申诉</h2><p className="mt-3 text-sm leading-7 text-slate-500">我们会重新审阅处理依据，确保治理决定清晰、可追溯。</p></div><div className="mt-8 space-y-4 text-sm leading-6 text-slate-500"><p><b className="text-[#263961]">补充事实</b><br />说明你认为需要复核的具体内容与原因。</p><p><b className="text-[#263961]">提交证据</b><br />如有需要，可在申诉说明中补充相关线索。</p><p><b className="text-[#263961]">耐心等待</b><br />复核完成后，处理结果会同步到申诉详情。</p></div><div className="mt-7 border-t border-dashed border-[#eadaca] pt-5"><h3 className="flex items-center gap-2 font-semibold text-[#263961]"><ShieldCheck className="h-4 w-4" />申诉说明</h3><p className="mt-3 text-sm leading-7 text-slate-500">申诉不会自动撤销已执行措施，最终结果以复核决定为准。</p></div><Link href="/appeals/new" className="mt-7 flex h-12 items-center justify-center rounded-xl bg-[#e88b25] font-semibold text-white">提交新的申诉</Link><p className="mt-5 rounded-2xl bg-[#fff5e8] p-4 text-center text-sm text-[#8c6638]"><FileClock className="mr-1 inline h-4 w-4" />我们会在处理完成后通知你。</p></aside>
  </div></main></AppShell>;
}

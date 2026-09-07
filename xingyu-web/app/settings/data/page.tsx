"use client";

import Link from "next/link";
import { Archive, Download, FileText, UserRound } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";

export default function DataOverviewPage() {
  return (
    <SettingsLayout
      aside={
        <>
          <div className="grid h-40 place-items-center rounded-3xl bg-[#f7f2ea] text-[#1c335f]">
            <Archive className="h-20 w-20" />
          </div>
          <h2 className="mt-7 text-[26px] font-bold leading-tight text-[#1b2e58]">数据安全，我们始终认真对待</h2>
          <p className="mt-5 text-sm leading-7 text-slate-500">
            你可以导出个人数据副本，或在充分了解影响后申请注销账号。
          </p>
          <Link href="/guide" className="mt-6 inline-flex text-sm text-[#e38334] hover:underline">
            查看数据与隐私说明 →
          </Link>
        </>
      }
    >
      <header className="border-b border-[#eee7df] pb-7">
        <h1 className="text-[30px] font-bold tracking-tight text-[#132957]">数据与注销</h1>
        <p className="mt-1 text-sm text-slate-500">导出个人数据副本，或申请注销账号</p>
      </header>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#eee6de] bg-white/70 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#fbf1e4] text-[#1c335f]">
            <Download className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-[#1d315d]">数据导出</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            申请导出内容与账号相关数据，生成 JSON 副本供备份或迁移。
          </p>
          <Button asChild className="mt-4 bg-[#ed8c35] hover:bg-[#df7b28]">
            <Link href="/settings/data/export">前往导出</Link>
          </Button>
        </article>
        <article className="rounded-2xl border border-[#f1dcc8] bg-[#fff9f1]/85 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#ffe7cc] text-[#1c335f]">
            <UserRound className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-[#1d315d]">注销账号</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            提交注销申请前，请了解冷静期与数据保留政策。
          </p>
          <Button asChild variant="outline" className="mt-4 border-[#eb8532] text-[#df7624]">
            <Link href="/settings/data/delete-account">申请注销</Link>
          </Button>
        </article>
      </div>
      <section className="mt-6 rounded-2xl border border-[#eee6de] bg-[#faf9f7] p-5">
        <div className="flex gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6072b5]" />
          <p className="text-sm leading-6 text-slate-600">
            合规审计、治理证据等数据按保留策略处理，不会随普通注销立即物理删除。
          </p>
        </div>
      </section>
    </SettingsLayout>
  );
}

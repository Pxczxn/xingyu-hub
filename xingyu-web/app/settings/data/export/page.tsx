"use client";

import { useState } from "react";
import { Clock3, FileText, ShieldCheck, UserRound } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";

export default function DataExportPage() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await communityApi.getDataExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `xingyu-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("数据已导出到本地 JSON 文件");
    } catch {
      setError("导出失败，请确认已登录");
    } finally {
      setExporting(false);
    }
  }

  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">数据</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">数据导出</h1>
        <p className="mt-1 text-sm text-slate-500">申请导出你的内容与账号相关数据副本</p>
      </header>
      <div className="mt-7 divide-y divide-[#eee6de] rounded-2xl border border-[#eee6de] bg-white/70">
        <article className="flex flex-wrap items-center gap-5 p-6">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fbf1e4] text-[#1c335f]">
            <FileText className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[#1a2d58]">内容数据</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              包括帖子、评论、点赞、收藏、关注与互动相关数据。
            </p>
            <small className="mt-3 flex items-center gap-1 text-slate-400">
              <Clock3 className="h-4 w-4" />预计生成时间：10–30 分钟
            </small>
          </div>
          <Button
            disabled={exporting}
            onClick={() => void exportData()}
            className="h-12 bg-[#ed8c35] px-6 text-white hover:bg-[#df7b28]"
          >
            {exporting ? "导出中…" : "申请导出"}
          </Button>
        </article>
        <article className="flex flex-wrap items-center gap-5 p-6">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f0eef7] text-[#1c335f]">
            <UserRound className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[#1a2d58]">账号数据</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              包括账号信息、资料与设置；部分敏感信息将脱敏处理。
            </p>
          </div>
          <Button
            disabled={exporting}
            onClick={() => void exportData()}
            className="h-12 bg-[#ed8c35] px-6 text-white hover:bg-[#df7b28]"
          >
            {exporting ? "导出中…" : "申请导出"}
          </Button>
        </article>
      </div>
      <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#fbf7f1] p-4 text-sm text-slate-500">
        <ShieldCheck className="h-5 w-5 text-[#e99642]" />
        导出链接将通过站内信发送，仅在 7 天内有效，请及时下载。
      </p>
      {message && <Alert className="mt-5">{message}</Alert>}
      {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
    </SettingsLayout>
  );
}

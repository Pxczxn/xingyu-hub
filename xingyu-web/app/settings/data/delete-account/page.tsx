"use client";

import Link from "next/link";
import { useState } from "react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi } from "@/lib/community-api";

export default function DeleteAccountPage() {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitDeletion() {
    if (!confirm("确定提交账号注销申请？冷静期内可撤销，但公开创作将受限。")) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await communityApi.requestAccountDeletion();
      setMessage("注销申请已提交。冷静期内可前往账号状态页了解进度。");
    } catch {
      setError("提交失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SettingsLayout>
      <header className="border-b border-[#eee7df] pb-7">
        <p className="text-sm font-medium text-[#e58436]">数据</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight text-[#132957]">注销账号</h1>
        <p className="mt-1 text-sm text-slate-500">提交前请了解默认 7 天冷静期与数据保留政策</p>
      </header>
      <section className="mt-7 rounded-2xl border border-[#f1dcc8] bg-[#fff9f1]/85 p-6">
        <h2 className="font-semibold text-[#27385b]">注销后将发生：</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <li>个人资料与公开内容将删除或匿名化处理</li>
          <li>冷静期内账号处于 DEACTIVATING，可重新认证后撤销</li>
          <li>合规审计与治理证据按保留策略保留最小必要数据</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={deleting}
            onClick={() => void submitDeletion()}
            className="border-[#eb8532] text-[#df7624]"
          >
            {deleting ? "提交中…" : "申请注销账号"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/account/status">查看账号状态</Link>
          </Button>
        </div>
      </section>
      {message && <Alert className="mt-5">{message}</Alert>}
      {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
    </SettingsLayout>
  );
}

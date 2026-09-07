"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";

export default function NewReportPage() {
  const router = useRouter();
  const [targetType, setTargetType] = useState("ARTICLE");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("SPAM");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.createReport({ targetType, targetId, reason, detail: detail || undefined });
      router.push("/reports");
    } catch {
      setError("提交失败，请确认已登录并填写完整信息");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="xy-page mx-auto max-w-xl">
        <PageHero variant="compact" eyebrow="社区治理" title="提交举报" description="举报是线索，处理结果会独立通知。" />
        {error && <Alert variant="destructive">{error}</Alert>}
        <form onSubmit={submit} className="xy-panel space-y-4 p-5">
          <label className="block text-sm font-medium">
            对象类型
            <Input value={targetType} onChange={(e) => setTargetType(e.target.value)} className="mt-2" required />
          </label>
          <label className="block text-sm font-medium">
            对象 ID
            <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} className="mt-2" required />
          </label>
          <label className="block text-sm font-medium">
            原因
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2" required />
          </label>
          <label className="block text-sm font-medium">
            补充说明
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm" />
          </label>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "提交中…" : "提交举报"}
          </Button>
        </form>
      </main>
    </AppShell>
  );
}

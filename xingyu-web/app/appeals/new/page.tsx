"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityApi } from "@/lib/community-api";

function NewAppealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCaseId = searchParams.get("caseId") ?? "";
  const initialMeasureId = searchParams.get("measureId") ?? "";
  const [measureId, setMeasureId] = useState(initialMeasureId);
  const [caseId, setCaseId] = useState(initialCaseId);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await communityApi.createAppeal({
        measureId: measureId || undefined,
        caseId: caseId || undefined,
        detail,
      });
      router.push("/appeals");
    } catch {
      setError("提交失败，请确认已登录并填写案件/措施编号与申诉说明");
      setSubmitting(false);
    }
  }

  return (
    <>
      {error && <Alert variant="destructive">{error}</Alert>}
      <form onSubmit={submit} className="xy-panel space-y-4 p-5">
        <label className="block text-sm font-medium">
          案件 ID（与措施 ID 二选一或都填）
          <Input value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-2" />
        </label>
        <label className="block text-sm font-medium">
          治理措施 ID
          <Input value={measureId} onChange={(e) => setMeasureId(e.target.value)} className="mt-2" />
        </label>
        <label className="block text-sm font-medium">
          申诉说明
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
            required
          />
        </label>
        <Button type="submit" disabled={submitting || (!measureId && !caseId)} className="w-full">
          {submitting ? "提交中…" : "提交申诉"}
        </Button>
      </form>
    </>
  );
}

export default function NewAppealPage() {
  return (
    <AppShell>
      <main className="xy-page mx-auto max-w-xl">
        <PageHero variant="compact" eyebrow="社区治理" title="提交申诉" description="对治理措施提出申诉，平台将独立审核。" />
        <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
          <NewAppealForm />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/reports" className="underline">返回我的举报</Link>
        </p>
      </main>
    </AppShell>
  );
}

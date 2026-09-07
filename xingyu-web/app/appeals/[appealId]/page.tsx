"use client";

import { useParams } from "next/navigation";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function AppealDetailPage() {
  const params = useParams<{ appealId: string }>();
  const appealId = params.appealId;
  const { data: appeal, loading, error } = useAsyncData(
    () => communityApi.getMyAppeal(appealId),
    [appealId]
  );

  if (loading) {
    return (
      <CompactPageShell eyebrow="治理" title="申诉详情" width="md" backHref="/appeals" backLabel="返回列表">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </CompactPageShell>
    );
  }

  if (error || !appeal) {
    return (
      <CompactPageShell eyebrow="治理" title="申诉详情" width="md" backHref="/appeals" backLabel="返回列表">
        <EmptyState compact title="无法加载申诉" description={error || "申诉不存在或无权查看"} actionLabel="返回列表" actionHref="/appeals" />
      </CompactPageShell>
    );
  }

  return (
    <CompactPageShell eyebrow="治理" title="申诉详情" width="md" backHref="/appeals" backLabel="返回列表">
      <Card>
        <CardTitle>案件 {appeal.caseId}</CardTitle>
        <CardDescription className="mt-1">状态：{appeal.status}</CardDescription>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">申诉说明</dt>
            <dd className="mt-1 whitespace-pre-wrap">{appeal.body}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">提交时间</dt>
            <dd className="mt-1">{formatDateTime(appeal.createdAt)}</dd>
          </div>
        </dl>
      </Card>
    </CompactPageShell>
  );
}

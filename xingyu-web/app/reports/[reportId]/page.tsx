"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CompactPageShell } from "@/components/community/compact-page-shell";
import { EmptyState } from "@/components/community/empty-state";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function ReportDetailPage() {
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId;
  const { data: report, loading, error } = useAsyncData(
    () => communityApi.getMyReport(reportId),
    [reportId]
  );

  if (loading) {
    return (
      <CompactPageShell eyebrow="治理" title="举报详情" width="md" backHref="/reports" backLabel="返回列表">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </CompactPageShell>
    );
  }

  if (error || !report) {
    return (
      <CompactPageShell eyebrow="治理" title="举报详情" width="md" backHref="/reports" backLabel="返回列表">
        <EmptyState compact title="无法加载举报" description={error || "举报不存在或无权查看"} actionLabel="返回列表" actionHref="/reports" />
      </CompactPageShell>
    );
  }

  return (
    <CompactPageShell eyebrow="治理" title="举报详情" width="md" backHref="/reports" backLabel="返回列表">
      <Card>
        <CardTitle>{report.targetType} · {report.targetId}</CardTitle>
        <CardDescription className="mt-1">状态：{report.status}</CardDescription>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">举报原因</dt>
            <dd className="mt-1">{report.reason}</dd>
          </div>
          {report.detail && (
            <div>
              <dt className="text-muted-foreground">补充说明</dt>
              <dd className="mt-1">{report.detail}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">提交时间</dt>
            <dd className="mt-1">{formatDateTime(report.createdAt)}</dd>
          </div>
          {report.caseStatus && (
            <div>
              <dt className="text-muted-foreground">案件状态</dt>
              <dd className="mt-1">{report.caseStatus}</dd>
            </div>
          )}
          {report.measureId && (
            <div className="pt-1">
              <Link
                href={`/appeals/new?caseId=${encodeURIComponent(report.caseId ?? "")}&measureId=${encodeURIComponent(report.measureId)}`}
                className="text-sm text-accent hover:underline"
              >
                对此处置提出申诉
              </Link>
            </div>
          )}
        </dl>
      </Card>
    </CompactPageShell>
  );
}

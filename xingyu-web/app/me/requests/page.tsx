"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

function statusLabel(status: string) {
  if (status === "PENDING") return "待处理";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已拒绝";
  return status;
}

export default function RequestsPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getMyGroupJoinRequests(), []);

  const pending = (data ?? []).filter((item) => item.status === "PENDING");
  const history = (data ?? []).filter((item) => item.status !== "PENDING");

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact"
          eyebrow="个人中心"
          title="关系请求"
          description="关注为开放模式；此处展示你发起的群聊入群申请。"
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <EmptyState title="无法加载" description="请登录后查看" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="暂无入群申请"
            description="当你向需要审批的群聊提交入群申请时，会显示在这里"
          />
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">待处理</h2>
                {pending.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.conversationTitle || "群聊"}</p>
                        {item.message && (
                          <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline">{statusLabel(item.status)}</Badge>
                    </div>
                    <Link
                      href={`/messages/group/${item.conversationId}`}
                      className="mt-3 inline-block text-sm text-accent hover:underline"
                    >
                      查看群聊
                    </Link>
                  </Card>
                ))}
              </section>
            )}
            {history.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">历史记录</h2>
                {history.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.conversationTitle || "群聊"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                          {item.resolvedAt ? ` · 处理于 ${formatDateTime(item.resolvedAt)}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">{statusLabel(item.status)}</Badge>
                    </div>
                  </Card>
                ))}
              </section>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}

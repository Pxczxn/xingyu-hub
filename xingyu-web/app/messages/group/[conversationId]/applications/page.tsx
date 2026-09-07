"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function canManageGroup(role?: string | null) {
  return role === "OWNER" || role === "ADMIN";
}

export default function GroupApplicationsPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { data: conversation, loading: convLoading } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );
  const { data: requests, loading, error, reload } = useAsyncData(
    () => {
      if (!canManageGroup(conversation?.myRole)) {
        return Promise.resolve([]);
      }
      return communityApi.getGroupJoinRequests(conversationId);
    },
    [conversationId, conversation?.myRole]
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const isApprovalMode = conversation?.joinMode === "APPROVAL";
  const canManage = canManageGroup(conversation?.myRole);

  async function handleApprove(requestId: string) {
    setActingId(requestId);
    setActionError(null);
    try {
      await communityApi.approveGroupJoinRequest(conversationId, requestId);
      reload();
    } catch (err) {
      if (err instanceof ApiError) setActionError(err.problem.detail || "操作失败");
      else setActionError("操作失败");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(requestId: string) {
    setActingId(requestId);
    setActionError(null);
    try {
      await communityApi.rejectGroupJoinRequest(conversationId, requestId);
      reload();
    } catch (err) {
      if (err instanceof ApiError) setActionError(err.problem.detail || "操作失败");
      else setActionError("操作失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">入群申请</h1>
          <Link href={`/messages/group/${conversationId}`} className="text-sm text-accent hover:underline">
            返回聊天
          </Link>
        </div>
        {convLoading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : !canManage ? (
          <Alert>仅群主或管理员可查看入群申请</Alert>
        ) : !isApprovalMode ? (
          <Card>
            <CardTitle>开放入群</CardTitle>
            <CardDescription className="mt-1">当前群聊为开放模式，用户可直接加入，暂无待处理申请。</CardDescription>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">{error}</Alert>
        ) : (
          <Card>
            <CardTitle>待处理申请</CardTitle>
            <CardDescription className="mt-1">共 {(requests ?? []).length} 条</CardDescription>
            {actionError && <Alert className="mt-4" variant="destructive">{actionError}</Alert>}
            {(requests ?? []).length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">暂无待处理申请</p>
            ) : (
              <ul className="mt-6 divide-y divide-border">
                {(requests ?? []).map((request) => (
                  <li key={request.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/users/${request.username}`}
                          className="font-medium hover:text-[rgb(var(--violet))]"
                        >
                          {request.displayName || request.username}
                        </Link>
                        {request.message && (
                          <p className="mt-1 text-sm text-muted-foreground">{request.message}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          disabled={actingId === request.id}
                          onClick={() => handleApprove(request.id)}
                        >
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === request.id}
                          onClick={() => handleReject(request.id)}
                        >
                          拒绝
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </main>
    </AppShell>
  );
}

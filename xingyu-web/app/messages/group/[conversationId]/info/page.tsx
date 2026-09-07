"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function GroupInfoPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { data: conversation, loading, error } = useAsyncData(
    () => communityApi.getGroupConversation(conversationId),
    [conversationId]
  );

  if (loading) {
    return (
      <AppShell>
        <main className="px-4 py-8 text-sm text-muted-foreground sm:px-6">加载中…</main>
      </AppShell>
    );
  }

  if (error || !conversation) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
          <Alert variant="destructive">{error || "群聊不存在"}</Alert>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Card>
          <CardTitle>{conversation.title || "群聊"}</CardTitle>
          <CardDescription className="mt-1">会话 ID：{conversation.id}</CardDescription>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href={`/messages/group/${conversationId}`} className="text-accent hover:underline">返回聊天</Link>
            <Link href={`/messages/group/${conversationId}/members`} className="text-accent hover:underline">成员列表</Link>
            <Link href={`/messages/group/${conversationId}/announcement`} className="text-accent hover:underline">群公告</Link>
            <Link href={`/messages/group/${conversationId}/settings`} className="text-accent hover:underline">群设置</Link>
            {(conversation.myRole === "OWNER" || conversation.myRole === "ADMIN") && (
              <Link href={`/messages/group/${conversationId}/applications`} className="text-accent hover:underline">
                入群申请
              </Link>
            )}
          </div>
          {conversation.announcement && (
            <p className="mt-4 text-sm text-muted-foreground line-clamp-3">{conversation.announcement}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            入群方式：{conversation.joinMode === "APPROVAL" ? "需要审批" : "开放加入"}
          </p>
        </Card>
      </main>
    </AppShell>
  );
}

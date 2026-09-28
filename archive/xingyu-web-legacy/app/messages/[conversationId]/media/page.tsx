"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

export default function ConversationMediaPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { data: messages, loading, error } = useAsyncData(
    () => communityApi.getConversationMedia(conversationId),
    [conversationId]
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">会话图片</h1>
          <Link href="/?openMessages=1" className="text-sm text-accent hover:underline">返回消息</Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">{error}</Alert>
        ) : (messages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无图片消息</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(messages ?? []).map((message) => (
              <li key={message.id}>
                <Card className="overflow-hidden p-2">
                  {message.attachmentUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={message.attachmentUrl}
                      alt={message.attachmentName ?? "图片"}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  )}
                  <p className="mt-2 px-1 text-xs text-muted-foreground">
                    {formatDateTime(message.createdAt)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

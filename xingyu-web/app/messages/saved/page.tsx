"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/community/page-primitives";
import { EmptyState } from "@/components/community/empty-state";
import { Bookmark } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

function conversationHref(type: string, conversationId: string) {
  return type === "GROUP"
    ? `/messages/group/${conversationId}`
    : `/messages/direct/${conversationId}`;
}

export default function SavedMessagesPage() {
  const { data, loading, error, reload } = useAsyncData(() => communityApi.getSavedMessages(), []);

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact" eyebrow="消息" title="收藏的消息" description="你在聊天中收藏的消息会同步到账号。" />
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <Alert variant="destructive">需要登录后查看</Alert>
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="还没有收藏消息"
            description="在对话中收藏重要内容，它们会集中出现在这里。"
            actionLabel="返回消息"
            actionHref="/?openMessages=1"
            compact
          />
        ) : (
          <ul className="space-y-3">
            {(data ?? []).map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {item.conversationTitle || (item.conversationType === "GROUP" ? "群聊" : "私信")}
                      </p>
                      {item.messageType === "IMAGE" && item.attachmentUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.attachmentUrl}
                          alt={item.attachmentName ?? "图片"}
                          className="mt-2 max-h-40 rounded-lg object-cover"
                        />
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{item.body}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        收藏于 {formatDateTime(item.savedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Link
                        href={conversationHref(item.conversationType, item.conversationId)}
                        className="text-xs text-accent hover:underline"
                      >
                        查看会话
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void communityApi.removeSavedMessage(item.messageId).then(() => reload());
                        }}
                      >
                        取消收藏
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {(data ?? []).length > 0 && <Link href="/?openMessages=1" className="text-sm text-accent hover:underline">返回消息</Link>}
      </main>
    </AppShell>
  );
}

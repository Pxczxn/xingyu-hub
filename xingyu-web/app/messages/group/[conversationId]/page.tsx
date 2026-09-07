"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ChatComposer } from "@/components/community/chat-composer";
import { ChatMessageCard } from "@/components/community/chat-message-card";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { communityApi, type ChatMessage, type ConversationDetail } from "@/lib/community-api";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";

export default function GroupMessagePage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      communityApi.getGroupConversation(conversationId).then(setConversation).catch(() => setError("无法加载群聊")),
    [conversationId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useCommunityChatSocket((incomingConversationId, message: ChatMessage) => {
    if (incomingConversationId !== conversationId) return;
    setConversation((prev) => {
      if (!prev) return prev;
      const existing = prev.messages ?? [];
      if (existing.some((item) => item.id === message.id)) return prev;
      return { ...prev, messages: [...existing, message] };
    });
  });

  const messages = conversation?.messages ?? [];

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/?openMessages=1"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回消息列表
        </Link>

        {error && <Alert variant="destructive" className="mt-6">{error}</Alert>}

        {!conversation && !error && (
          <p className="mt-6 text-sm text-muted-foreground">加载中…</p>
        )}

        {conversation && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{conversation.title || "群聊"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">群聊会话</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href={`/messages/group/${conversationId}/members`} className="text-accent hover:underline">
                  成员
                </Link>
                <Link href={`/messages/group/${conversationId}/info`} className="text-accent hover:underline">
                  详情
                </Link>
                <Link href={`/messages/${conversationId}/media`} className="text-accent hover:underline">图片</Link>
                <Link href={`/messages/${conversationId}/files`} className="text-accent hover:underline">文件</Link>
                <Link href="/messages/saved" className="text-accent hover:underline">收藏</Link>
              </div>
            </div>

            {messages.length === 0 ? (
              <EmptyState title="暂无消息" description="发送第一条消息开始群聊" />
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((message) => (
                  <li key={message.id}>
                    <ChatMessageCard
                      message={message}
                      onSave={() => void communityApi.saveMessage(message.id)}
                    />
                  </li>
                ))}
              </ul>
            )}

            <ChatComposer
              conversationId={conversationId}
              mode="group"
              onSent={() => void load()}
              onError={(message) => setError(message)}
            />
          </div>
        )}
      </main>
    </AppShell>
  );
}

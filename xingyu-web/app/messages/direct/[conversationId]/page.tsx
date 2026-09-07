"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ChatComposer } from "@/components/community/chat-composer";
import { ChatMessageCard } from "@/components/community/chat-message-card";
import { EmptyState } from "@/components/community/empty-state";
import { Alert } from "@/components/ui/alert";
import { communityApi, type ChatMessage, type ConversationDetail } from "@/lib/community-api";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";

export default function DirectMessageThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const loadConversation = useCallback(() =>
    communityApi
      .getDirectConversation(conversationId)
      .then(setConversation)
      .catch((err) => {
        const status =
          err && typeof err === "object" && "problem" in err
            ? (err as { problem: { status?: number } }).problem.status
            : undefined;
        if (status === 401 || status === 403) setNeedsLogin(true);
        else if (status === 404) setError("会话不存在或无权访问");
        else setError("加载失败，请稍后重试");
      }), [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

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
          <ArrowLeft className="h-4 w-4" />
          返回消息列表
        </Link>

        {needsLogin ? (
          <div className="mt-8">
            <EmptyState
              icon={MessageSquare}
              title="登录后查看会话"
              description="私信需要登录后才能访问"
              actionLabel="去登录"
              actionHref="/login"
            />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mt-8">{error}</Alert>
        ) : !conversation ? (
          <p className="mt-8 text-sm text-muted-foreground">加载中…</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{conversation.title || "私信"}</h1>
                <p className="mt-1 text-sm text-muted-foreground">私信会话</p>
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/messages/${conversationId}/media`} className="text-accent hover:underline">
                  图片
                </Link>
                <Link href={`/messages/${conversationId}/files`} className="text-accent hover:underline">
                  文件
                </Link>
                <Link href="/messages/saved" className="text-accent hover:underline">收藏</Link>
              </div>
            </div>

            {messages.length === 0 ? (
              <EmptyState icon={MessageSquare} title="暂无消息" description="发送第一条消息开始对话" />
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
              mode="direct"
              onSent={() => void loadConversation()}
              onError={(message) => setError(message)}
            />
          </div>
        )}
      </main>
    </AppShell>
  );
}

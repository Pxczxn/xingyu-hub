"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Smile, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/community/empty-state";
import { ChatComposer } from "@/components/community/chat-composer";
import { MessageBubble } from "@/components/community/messaging";
import { communityApi, type ChatMessage, type ConversationSummary } from "@/lib/community-api";
import { formatRelativeTime } from "@/lib/format";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";
import { FloatingCard, FloatingCardBody, FloatingCardHeader } from "./floating-card";

export function FloatingChatThread({
  conversation,
  onBack,
}: {
  conversation: ConversationSummary;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGroup = conversation.type === "GROUP";

  const loadConversation = useCallback(() => {
    const loader = isGroup
      ? communityApi.getGroupConversation(conversation.id)
      : communityApi.getDirectConversation(conversation.id);

    return loader
      .then((detail) => {
        setMessages(detail.messages ?? []);
        setError(null);
      })
      .catch(() => setError("无法加载会话"));
  }, [conversation.id, isGroup]);

  useEffect(() => {
    setLoading(true);
    loadConversation().finally(() => setLoading(false));
  }, [loadConversation]);

  useCommunityChatSocket((incomingConversationId, message) => {
    if (incomingConversationId !== conversation.id) return;
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  return (
    <FloatingCard width={400} className="flex h-[34rem] flex-col">
      <FloatingCardHeader
        title={conversation.title || (isGroup ? "群聊" : "私信")}
        description={isGroup ? "群聊会话" : "私信会话"}
        actions={
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="返回会话列表" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <div className="flex shrink-0 items-center gap-2.5 border-b border-[#ece8e1] bg-[#fffdf9] px-4 py-2.5">
        <Avatar fallback={conversation.title} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{conversation.title}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {isGroup ? <Users className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            {isGroup ? "群聊 · 成员在线" : "在线"}
          </p>
        </div>
      </div>

      <FloatingCardBody className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="px-1 text-sm text-muted-foreground">加载消息…</p>
          ) : error ? (
            <p className="px-1 text-sm text-destructive">{error}</p>
          ) : messages.length === 0 ? (
            <EmptyState compact title="暂无消息" description="发送第一条消息开始对话" />
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                body={message.body}
                time={formatRelativeTime(message.createdAt)}
                sender={isGroup ? message.senderId : undefined}
              />
            ))
          )}
        </div>
      </FloatingCardBody>

      <div className="shrink-0 border-t border-[#ece8e1] bg-[#fffdf9] p-2">
        <div className="mb-1.5 flex items-center gap-1 px-1 text-muted-foreground">
          <button type="button" disabled className="rounded-md p-1.5 opacity-45" aria-label="表情功能暂未开放">
            <Smile className="h-4 w-4" />
          </button>
        </div>
        <ChatComposer
          conversationId={conversation.id}
          mode={isGroup ? "group" : "direct"}
          onSent={() => void loadConversation()}
          onError={(message) => setError(message)}
        />
      </div>
    </FloatingCard>
  );
}

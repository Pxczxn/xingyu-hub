"use client";

import Link from "next/link";
import { MessageSquare, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { Button } from "@/components/ui/button";
import { communityApi, type ConversationSummary } from "@/lib/community-api";
import { formatRelativeTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

function conversationHref(conversation: ConversationSummary) {
  return conversation.type === "GROUP"
    ? `/messages/group/${conversation.id}`
    : `/messages/direct/${conversation.id}`;
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  const unread = conversation.unreadCount ?? 0;

  return (
    <li>
      <Link
        href={conversationHref(conversation)}
        className="flex min-w-0 items-center gap-3 border-b border-border/70 px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/45 sm:px-5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--violet)/.10)] text-[rgb(var(--violet))]">
          {conversation.type === "GROUP" ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <strong className="truncate text-sm text-foreground">{conversation.title || "未命名会话"}</strong>
            <time className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</time>
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {conversation.lastMessage || (conversation.type === "GROUP" ? "群聊会话" : "私信会话")}
          </span>
        </span>
        {unread > 0 ? (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export default function MessagesPage() {
  const { data: conversations, loading, error } = useAsyncData(() => communityApi.getConversations(), []);
  const items = conversations ?? [];
  const unread = items.reduce((total, item) => total + (item.unreadCount ?? 0), 0);

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero
          variant="compact"
          eyebrow="社区沟通"
          title="消息"
          description="查看私信与群聊，继续和同频的人交流。"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/messages/new"><Plus className="h-4 w-4" />发起私信</Link>
              </Button>
              <Button variant="accent" size="sm" asChild>
                <Link href="/messages/groups/new"><Users className="h-4 w-4" />创建群聊</Link>
              </Button>
            </div>
          }
        />

        {error ? (
          <div className="mt-4">
            <EmptyState
              icon={MessageSquare}
              title="登录后查看消息"
              description="登录后即可查看会话、发送私信和参与群聊。"
              actionLabel="去登录"
              actionHref="/login"
              compact
            />
          </div>
        ) : loading ? (
          <section className="mt-4 rounded-2xl border border-border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
            正在加载会话…
          </section>
        ) : items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={MessageSquare}
              title="暂无会话"
              description="发起私信或创建群聊后，会话会出现在这里。"
              actionLabel="发起私信"
              actionHref="/messages/new"
              compact
            />
          </div>
        ) : (
          <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(36_49_84/0.06)]">
            <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">全部会话</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">共 {items.length} 个会话</p>
              </div>
              {unread > 0 ? <span className="text-xs text-[rgb(var(--accent))]">{unread} 条未读</span> : null}
            </header>
            <ul>
              {items.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} />)}
            </ul>
          </section>
        )}

        {!error ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>消息会在打开会话后自动同步。</span>
            <Link href="/messages/saved" className="text-accent hover:underline">查看收藏消息</Link>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

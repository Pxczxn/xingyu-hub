"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function MyGroupsPage() {
  const { data: conversations, loading, error } = useAsyncData(() => communityApi.getConversations(), []);
  const groups = (conversations ?? []).filter((item) => item.type === "GROUP");

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact"
          eyebrow="个人中心"
          title="我的群聊"
          description="你参与或创建的群聊会话。"
          actions={
            <Link href="/messages/groups/new" className="text-sm text-accent hover:underline">
              创建群聊
            </Link>
          }
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <EmptyState title="需要登录" description={error} actionLabel="去登录" actionHref="/login" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="暂无群聊"
            description="创建群聊与创作者或读者交流"
            actionLabel="创建群聊"
            actionHref="/messages/groups/new"
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => (
              <li key={group.id}>
                <Link href={`/messages/group/${group.id}`}>
                  <Card className="transition-colors hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{group.title}</CardTitle>
                        <CardDescription className="mt-1">{formatDateTime(group.updatedAt)}</CardDescription>
                      </div>
                      <Badge variant="outline">GROUP</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

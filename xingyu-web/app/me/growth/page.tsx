"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ContentRow } from "@/components/community/content-card";
import { PageHero } from "@/components/community/page-primitives";
import { Badge } from "@/components/ui/badge";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";

export default function GrowthPage() {
  const { data: history } = useAsyncData(() => communityApi.getHistory(), []);
  const { data: comments } = useAsyncData(() => communityApi.getMyComments(10), []);
  const { data: badges } = useAsyncData(() => communityApi.getMyBadges(), []);
  const { data: insights } = useAsyncData(() => communityApi.getMyInsights(), []);
  const { data: home } = useAsyncData(() => communityApi.getHome().catch(() => null), []);

  const pendingActions = home?.pendingActions ?? [];

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact" eyebrow="个人中心" title="成长记录" description="阅读轨迹、徽章与待办事项。" />

        {insights && (
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="xy-panel p-4 text-center">
              <p className="text-2xl font-semibold">{insights.articleCount}</p>
              <p className="text-xs text-muted-foreground">已发布文章</p>
            </div>
            <div className="xy-panel p-4 text-center">
              <p className="text-2xl font-semibold">{insights.followerCount}</p>
              <p className="text-xs text-muted-foreground">粉丝</p>
            </div>
            <div className="xy-panel p-4 text-center">
              <p className="text-2xl font-semibold">{insights.likeCount}</p>
              <p className="text-xs text-muted-foreground">获得喜欢</p>
            </div>
          </section>
        )}

        {pendingActions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">待处理</h2>
            <ul className="mt-3 space-y-2">
              {pendingActions.map((action) => (
                <li key={`${action.type}-${action.href}`}>
                  <Link href={action.href} className="xy-panel-interactive block px-4 py-3 text-sm">
                    {action.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {badges && badges.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">徽章</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li key={badge.id}>
                  <Badge variant={badge.earned ? "accent" : "outline"} title={badge.description}>
                    {badge.title}
                  </Badge>
                </li>
              ))}
            </ul>
            <Link href="/me/badges" className="mt-2 inline-block text-sm text-accent hover:underline">
              查看全部徽章
            </Link>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold">最近阅读</h2>
          <div className="mt-3 xy-panel divide-y divide-border">
            {(history?.items ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">暂无阅读记录</p>
            ) : (
              history!.items.map((item) => (
                <ContentRow key={item.id} href={contentHref(item)} title={item.title} meta={item.updatedAt} />
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">最近评论</h2>
          <ul className="mt-3 space-y-3">
            {(comments ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">暂无评论</li>
            ) : (
              comments!.map((comment) => (
                <li key={comment.id} className="xy-panel p-4 text-sm">
                  <p>{comment.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <Link href="/me/insights" className="text-sm text-accent hover:underline">查看创作数据</Link>
      </main>
    </AppShell>
  );
}

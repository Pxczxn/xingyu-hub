"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";
import { formatDateTime } from "@/lib/format";
import { LoaderCircle } from "lucide-react";

export default function MyLikesPage() {
  const { data: likes, loading, error } = useAsyncData(() => communityApi.getMyLikes(), []);

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact" eyebrow="个人中心" title="我的喜欢" description="你点赞过的内容。" />
        {loading ? (
          <EmptyState icon={LoaderCircle} title="正在加载喜欢的内容" description="马上就好，请稍候。" compact className="min-h-40" />
        ) : error ? (
          <EmptyState title="需要登录" description={error} actionLabel="去登录" actionHref="/login" />
        ) : !likes?.length ? (
          <EmptyState title="暂无点赞" description="为喜欢的内容点个赞" actionLabel="去发现" actionHref="/discover" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {likes.map((like) => (
              <li key={`${like.objectType}:${like.objectId}`} className="px-4 py-3">
                <Link
                  href={contentHref({ id: like.objectId, objectType: like.objectType })}
                  className="font-medium hover:text-[rgb(var(--violet))]"
                >
                  {like.title || like.objectId}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {like.objectType} · {formatDateTime(like.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}

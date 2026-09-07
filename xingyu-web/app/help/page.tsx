"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { PageHero } from "@/components/community/page-primitives";
import { communityApi } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function HelpPage() {
  const { data: pages, loading, error } = useAsyncData(() => communityApi.getGuidePages(), []);

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero eyebrow="帮助" title="帮助中心" description="常见问题与使用说明。" />
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : error ? (
          <EmptyState title="加载失败" description={error} />
        ) : !pages?.length ? (
          <EmptyState title="暂无帮助内容" actionLabel="返回首页" actionHref="/" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pages.map((page) => (
              <li key={page.id} className="px-4 py-4">
                <Link href={`/guide/${page.slug}`} className="font-medium hover:text-[rgb(var(--violet))]">
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          也可查看 <Link href="/rules" className="text-accent hover:underline">社区规则</Link>
        </p>
      </main>
    </AppShell>
  );
}

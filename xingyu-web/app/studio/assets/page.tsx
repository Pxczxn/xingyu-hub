"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ContentRow } from "@/components/community/content-card";
import { PageHero } from "@/components/community/page-primitives";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

export default function StudioAssetsPage() {
  const { data: articles, loading } = useAsyncData(() => communityApi.listMyArticles(), []);
  const { data: series } = useAsyncData(() => communityApi.listMySeries(), []);

  const items = [
    ...(articles ?? []).map((item) => ({ id: item.id, title: item.title, objectType: "ARTICLE", meta: item.status })),
    ...(series ?? []).map((item) => ({ id: item.id, title: item.title, objectType: "SERIES", meta: item.status })),
  ];

  return (
    <AppShell>
      <main className="xy-page">
        <PageHero variant="compact" eyebrow="创作台" title="创作素材库" description="你的文章与系列创作资产。" />
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无创作内容</p>
        ) : (
          <div className="xy-panel divide-y divide-border">
            {items.map((item) => (
              <ContentRow
                key={`${item.objectType}-${item.id}`}
                href={contentHref(item)}
                title={item.title}
                meta={item.meta}
              />
            ))}
          </div>
        )}
        <Link href="/studio" className="text-sm text-accent hover:underline">返回创作台</Link>
      </main>
    </AppShell>
  );
}

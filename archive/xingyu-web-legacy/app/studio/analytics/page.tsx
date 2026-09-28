"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { communityApi, type InsightsView } from "@/lib/community-api";
import { cn } from "@/lib/utils";
import shellStyles from "@/components/community/shell-primitives.module.css";

export default function StudioAnalyticsPage() {
  const [insights, setInsights] = useState<InsightsView | null>(null);

  useEffect(() => {
    communityApi.getMyInsights().then(setInsights).catch(() => setInsights(null));
  }, []);

  return (
    <AppShell>
      <main className={cn(shellStyles.page, "mx-auto max-w-4xl py-8")}>
        <h1 className="text-2xl font-semibold">创作数据分析</h1>
        <p className="mt-2 text-sm text-muted-foreground">汇总你的创作与互动数据。</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="已发布文章" value={insights?.articleCount ?? "—"} />
          <StatCard label="获得喜欢" value={insights?.likeCount ?? "—"} />
          <StatCard label="收到评论" value={insights?.commentCount ?? "—"} />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          原 <code className="text-xs text-muted-foreground">/me/insights</code> 数据已迁移至此。
        </p>
      </main>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-[#e8e2da] bg-white/80 p-5">
      <p className="text-sm text-[#7b8698]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#1d315a]">{value}</p>
    </article>
  );
}

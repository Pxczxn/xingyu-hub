"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHero } from "@/components/community/page-primitives";

export default function HelpArticlePage() {
  return (
    <AppShell>
      <main className="xy-page">
        <PageHero eyebrow="帮助中心" title="使用说明" description="快速了解星语社区的主要功能与操作方式。" />
        <article className="xy-panel max-w-3xl space-y-5 text-sm leading-7 text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">开始探索星语</h2>
          <p>你可以从发现页浏览文章、专题和话题，也可以在动态广场参与讨论。登录后还能收藏内容、关注创作者并管理阅读记录。</p>
          <h2 className="text-lg font-semibold text-foreground">遇到问题怎么办？</h2>
          <p>请先查看社区规则；如果仍未解决，可前往反馈中心提交具体描述。</p>
          <Link className="inline-flex text-accent hover:underline" href="/help">返回帮助中心</Link>
        </article>
      </main>
    </AppShell>
  );
}
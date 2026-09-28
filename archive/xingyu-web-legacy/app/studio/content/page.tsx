"use client";
import styles from "@/components/studio/studio-workspace.module.css";
import { cn } from "@/lib/utils";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, CircleCheck, Clock3, FileText, PenLine, Sparkles, Trash2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { communityApi, type ArticleSummary } from "@/lib/community-api";

const labels: Record<string, string> = {
  PUBLISHED: "已发布",
  DRAFT: "草稿",
  REVIEW: "审核中",
  REVIEWING: "审核中",
  RETURNED: "被退回",
};

const TABS = [
  ["all", "全部内容", BookOpen],
  ["published", "已发布", CircleCheck],
  ["drafts", "草稿", FileText],
  ["reviewing", "审核中", Clock3],
  ["returned", "被退回", XCircle],
  ["trash", "回收站", Trash2],
] as const;

export default function ContentManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const [items, setItems] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    communityApi.listMyArticles().then(setItems).catch(() => setError("无法加载内容，请确认已登录")).finally(() => setLoading(false));
  }, []);

  async function create() {
    setCreating(true);
    try {
      const draft = await communityApi.createArticle();
      router.push(`/studio/content/${draft.articleId}`);
    } catch {
      setError("创建文章失败，请确认已登录");
      setCreating(false);
    }
  }

  const visible = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "published") return items.filter((item) => item.status === "PUBLISHED");
    if (tab === "drafts") return items.filter((item) => item.status === "DRAFT");
    if (tab === "reviewing") return items.filter((item) => ["REVIEW", "REVIEWING"].includes(item.status));
    if (tab === "returned") return items.filter((item) => item.status === "RETURNED");
    return items;
  }, [items, tab]);

  const counters = useMemo(
    () => ({
      published: items.filter((x) => x.status === "PUBLISHED").length,
      draft: items.filter((x) => x.status === "DRAFT").length,
      review: items.filter((x) => ["REVIEW", "REVIEWING"].includes(x.status)).length,
      returned: items.filter((x) => x.status === "RETURNED").length,
    }),
    [items]
  );

  return (
    <AppShell>
      <main className={cn(styles.contentManagement)}>
        {error && <Alert variant="destructive">{error}</Alert>}
        <section className={cn(styles.panel)}>
          <div className={cn(styles.panelHead)}>
            <h1><Sparkles aria-hidden="true" /> 内容管理</h1>
            <Button className={cn(styles.createInline)} disabled={creating} onClick={() => void create()}>
              <PenLine aria-hidden="true" />
              {creating ? "创建中…" : "新建文章"}
            </Button>
          </div>
          <nav aria-label="内容状态筛选">
            {TABS.map(([value, label, Icon]) => (
              <Link
                key={value}
                href={value === "all" ? "/studio/content" : `/studio/content?tab=${value}`}
                className={tab === value ? "active" : undefined}
                aria-current={tab === value ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className={cn(styles.table)}>
            <header>
              <span>文章</span>
              <span>最新编辑时间</span>
              <span>状态</span>
              <span>操作</span>
            </header>
            {loading ? (
              <p className={cn(styles.status)}>正在加载内容…</p>
            ) : visible.length ? (
              visible.map((article, index) => {
                const state = article.status;
                return (
                  <article key={article.id}>
                    <Link className={cn(styles.rowMain)} href={`/studio/content/${article.id}`}>
                      <Image
                        src={`/prototype-assets/content-management/content-${(index % 5) + 1}.png`}
                        alt=""
                        aria-hidden="true"
                        width={107}
                        height={68}
                      />
                      <span>
                        <b>{article.title || "未命名文章"}</b>
                        <small>{article.summary || "文章摘要暂未提供"}</small>
                      </span>
                    </Link>
                    <div className={cn(styles.rowMeta)}>
                      <time className={cn(styles.rowTime)}>
                        {article.updatedAt ? new Date(article.updatedAt).toLocaleString("zh-CN") : "更新时间暂未提供"}
                      </time>
                      <em
                        className={cn(
                          styles.rowStatus,
                          (state === "REVIEW" || state === "REVIEWING") && styles.review,
                          state === "DRAFT" && styles.draft,
                          state === "RETURNED" && styles.returned,
                        )}
                      >
                        {labels[state] || state}
                      </em>
                      <div className={cn(styles.rowAction)}>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/studio/content/${article.id}`}>编辑</Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className={cn(styles.status)}>暂无符合条件的内容</p>
            )}
          </div>
          <footer><span>共 {items.length} 篇内容</span></footer>
        </section>
        <aside className={cn(styles.side)}>
          <Button className={cn(styles.create)} variant="outline" disabled={creating} onClick={() => void create()}>
            <PenLine aria-hidden="true" />
            {creating ? "创建中…" : "新建文章"}
          </Button>
          <section className={cn(styles.summary)}>
            <header><h2>创作总览</h2><Link href="/studio/analytics">查看数据 <ChevronRight aria-hidden="true" /></Link></header>
            <div>
              <Metric value={counters.published} label="已发布" />
              <Metric value={counters.draft} label="草稿" />
              <Metric value={counters.review} label="审核中" />
              <Metric value={counters.returned} label="被退回" />
            </div>
          </section>
          <section className={cn(styles.data)}><h2>创作设置</h2><p><Link href="/studio/settings">管理分类与素材</Link></p></section>
        </aside>
      </main>
    </AppShell>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <article><b>{value}</b><small>{label}</small></article>;
}

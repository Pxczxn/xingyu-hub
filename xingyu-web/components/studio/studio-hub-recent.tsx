"use client";
import styles from "./studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, PenLine } from "lucide-react";
import type { ArticleSummary } from "@/lib/community-api";
import { formatStudioDate, formatStudioDateTime } from "@/lib/format";
import {
  matchesStudioFilter,
  resolveArticleDisplayStatus,
  STUDIO_RECENT_TABS,
  type StudioArticleFilter,
} from "@/lib/studio-article-status";
import { RECENT_PAGE_SIZE } from "@/components/studio/use-studio-hub-data";

type Props = {
  articles: ArticleSummary[];
  scheduledIds: ReadonlySet<string>;
  loading: boolean;
  onCreateArticle: () => void;
};

export function StudioHubRecent({ articles, scheduledIds, loading, onCreateArticle }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("status");
  const filter: StudioArticleFilter = STUDIO_RECENT_TABS.some((tab) => tab.key === tabParam)
    ? (tabParam as StudioArticleFilter)
    : "all";
  const [visibleCount, setVisibleCount] = useState(RECENT_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(RECENT_PAGE_SIZE);
  }, [filter]);

  const sorted = useMemo(
    () => [...articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [articles]
  );

  const filtered = useMemo(
    () => sorted.filter((article) => matchesStudioFilter(article, filter, scheduledIds)),
    [sorted, filter, scheduledIds]
  );

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  function setFilter(next: StudioArticleFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    const query = params.toString();
    router.replace(query ? `/studio?${query}` : "/studio", { scroll: false });
  }

  return (
    <section className={cn(styles.recent)} aria-labelledby="studio-hub-recent-title">
      <header className={cn(styles.sectionHead)}>
        <h2 id="studio-hub-recent-title" className={cn(styles.sectionTitle)}>最近编辑</h2>
        <Link href="/studio/content" className={cn(styles.textLink)}>
          全部作品 <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <div className={cn(styles.tabs)} role="tablist" aria-label="内容状态筛选">
        {STUDIO_RECENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            className={filter === tab.key ? "is-active" : undefined}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={cn(styles.recentLoading)} aria-busy="true" aria-label="正在加载作品">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cn(styles.recentRow, styles.skeleton)}>
              <span className={cn(styles.thumb, styles.skeletonBlock)} />
              <span className={cn(styles.skeletonLine)} />
            </div>
          ))}
        </div>
      ) : visible.length ? (
        <ul className={cn(styles.recentList)}>
          {visible.map((article) => {
            const status = resolveArticleDisplayStatus(article, scheduledIds);
            return (
              <li key={article.id}>
                <Link href={`/studio/content/${encodeURIComponent(article.id)}`} className={cn(styles.recentRow)}>
                  <span className={cn(styles.thumb)} aria-hidden="true">
                    <FileText />
                  </span>
                  <span className={cn(styles.recentMain)}>
                    <strong>{article.title || "未命名文章"}</strong>
                    <small>最后编辑于 {formatStudioDateTime(article.updatedAt)}</small>
                  </span>
                  <span className={cn(styles.status, styles[`is${status.tone.charAt(0).toUpperCase()}${status.tone.slice(1)}` as keyof typeof styles])}>{status.label}</span>
                  <time dateTime={article.updatedAt}>{formatStudioDate(article.updatedAt)}</time>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={cn(styles.empty)} role="status">
          <FileText aria-hidden="true" />
          <h3>还没有作品</h3>
          <p>从第一篇内容开始，探索属于你的星语。</p>
          <button type="button" className={cn(styles.primaryBtn)} onClick={onCreateArticle}>
            <PenLine aria-hidden="true" />
            开始创作
          </button>
        </div>
      )}

      {hasMore ? (
        <div className={cn(styles.recentMore)}>
          <button type="button" className={cn(styles.textBtn)} onClick={() => setVisibleCount((count) => count + RECENT_PAGE_SIZE)}>
            加载更多
          </button>
        </div>
      ) : null}
    </section>
  );
}

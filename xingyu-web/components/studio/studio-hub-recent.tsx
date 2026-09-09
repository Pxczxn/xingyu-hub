"use client";

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
    <section className="xy-studio-hub-recent" aria-labelledby="studio-hub-recent-title">
      <header className="xy-studio-hub-section-head">
        <h2 id="studio-hub-recent-title" className="xy-studio-hub-section-title">最近编辑</h2>
        <Link href="/studio/content" className="xy-studio-hub-text-link">
          全部作品 <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <div className="xy-studio-hub-tabs" role="tablist" aria-label="内容状态筛选">
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
        <div className="xy-studio-hub-recent-loading" aria-busy="true" aria-label="正在加载作品">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="xy-studio-hub-recent-row xy-studio-hub-skeleton">
              <span className="xy-studio-hub-thumb xy-studio-hub-skeleton-block" />
              <span className="xy-studio-hub-skeleton-line" />
            </div>
          ))}
        </div>
      ) : visible.length ? (
        <ul className="xy-studio-hub-recent-list">
          {visible.map((article) => {
            const status = resolveArticleDisplayStatus(article, scheduledIds);
            return (
              <li key={article.id}>
                <Link href={`/studio/content/${encodeURIComponent(article.id)}`} className="xy-studio-hub-recent-row">
                  <span className="xy-studio-hub-thumb" aria-hidden="true">
                    <FileText />
                  </span>
                  <span className="xy-studio-hub-recent-main">
                    <strong>{article.title || "未命名文章"}</strong>
                    <small>最后编辑于 {formatStudioDateTime(article.updatedAt)}</small>
                  </span>
                  <span className={`xy-studio-hub-status is-${status.tone}`}>{status.label}</span>
                  <time dateTime={article.updatedAt}>{formatStudioDate(article.updatedAt)}</time>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="xy-studio-hub-empty" role="status">
          <FileText aria-hidden="true" />
          <h3>还没有作品</h3>
          <p>从第一篇内容开始，探索属于你的星语。</p>
          <button type="button" className="xy-studio-hub-primary-btn" onClick={onCreateArticle}>
            <PenLine aria-hidden="true" />
            开始创作
          </button>
        </div>
      )}

      {hasMore ? (
        <div className="xy-studio-hub-recent-more">
          <button type="button" className="xy-studio-hub-text-btn" onClick={() => setVisibleCount((count) => count + RECENT_PAGE_SIZE)}>
            加载更多
          </button>
        </div>
      ) : null}
    </section>
  );
}

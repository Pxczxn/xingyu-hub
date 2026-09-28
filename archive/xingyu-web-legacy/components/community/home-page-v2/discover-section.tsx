"use client";

import { useState, useMemo } from "react";
import { Sparkles, RefreshCw, LoaderCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ContentCardV2, ContentGrid } from "@/components/community/shared/content-card-v2";
import { resolveContentCoverUrl } from "@/lib/utils/content-helpers";
import type { ContentSummary } from "@/lib/community-api";
import styles from "./discover-section.module.css";

type DiscoverSectionProps = {
  items: ContentSummary[];
  loading?: boolean;
};

/**
 * 轮播内容（不修改原数组）
 */
function rotateItems<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const start = offset % items.length;
  return items.slice(start).concat(items.slice(0, start));
}

/**
 * 为你发现区块
 * 展示推荐内容，支持"换一批"功能
 */
export function DiscoverSection({ items, loading = false }: DiscoverSectionProps) {
  const [batch, setBatch] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const rotatedItems = useMemo(() => rotateItems(items, batch), [items, batch]);

  const featured = rotatedItems[0];
  const remaining = rotatedItems.slice(1, 7);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setBatch((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <section className={styles.discoverSection} aria-labelledby="discover-title">
      <header className={styles.sectionHeader}>
        <h2 id="discover-title" className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>
            <Sparkles />
          </span>
          为你发现
        </h2>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={handleRefresh}
          aria-label="换一批推荐内容"
          data-refreshing={isRefreshing}
        >
          <RefreshCw />
          换一批
        </button>
      </header>

      {loading ? (
        <div className={styles.loading} role="status" aria-label="正在加载推荐内容">
          <LoaderCircle className="animate-spin" />
        </div>
      ) : featured ? (
        <>
          {/* 特色大卡片 */}
          <a href={`/articles/${featured.id}`} className={styles.featuredCard}>
            <div className={styles.featuredCover}>
              <img
                src={resolveContentCoverUrl(featured.cover, featured.id, 0)}
                alt=""
                loading="lazy"
              />
              <span className={styles.featuredBadge}>编辑推荐</span>
            </div>
            <div className={styles.featuredContent}>
              <h3 className={styles.featuredTitle}>{featured.title}</h3>
              {featured.summary && (
                <p className={styles.featuredSummary}>{featured.summary}</p>
              )}
              {featured.authorName && (
                <div className={styles.featuredAuthor}>
                  <Avatar
                    src={featured.avatar}
                    fallback={featured.authorName}
                    size="md"
                  />
                  <div className={styles.featuredAuthorInfo}>
                    <strong>{featured.authorName}</strong>
                    <small>创作者</small>
                  </div>
                </div>
              )}
            </div>
          </a>

          {/* 其他内容网格 */}
          {remaining.length > 0 && (
            <ContentGrid columns={3}>
              {remaining.map((item, index) => (
                <ContentCardV2
                  key={item.id}
                  item={item}
                  variant="standard"
                  showAuthor
                />
              ))}
            </ContentGrid>
          )}
        </>
      ) : null}
    </section>
  );
}

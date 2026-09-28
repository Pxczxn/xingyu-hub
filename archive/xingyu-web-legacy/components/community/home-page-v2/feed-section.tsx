"use client";

import Link from "next/link";
import { Activity, ArrowRight, LoaderCircle } from "lucide-react";
import { ContentCardV2, ContentGrid } from "@/components/community/shared/content-card-v2";
import { EmptyStateV2 } from "@/components/community/shared/empty-state-v2";
import type { ContentSummary } from "@/lib/community-api";
import styles from "./feed-section.module.css";

type FeedSectionProps = {
  items: ContentSummary[];
  isGuest: boolean;
  loading?: boolean;
};

/**
 * 关注动态区块
 * 显示用户关注的创作者的最新更新
 */
export function FeedSection({ items, isGuest, loading = false }: FeedSectionProps) {
  const actionHref = isGuest ? "/discover" : "/me/following";
  const actionLabel = isGuest ? "去探索" : "管理关注";

  return (
    <section className={styles.feedSection} aria-labelledby="feed-title">
      <header className={styles.sectionHeader}>
        <h2 id="feed-title" className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>
            <Activity />
          </span>
          关注动态
        </h2>
        <Link href={actionHref} className={styles.actionLink}>
          {actionLabel}
          <ArrowRight />
        </Link>
      </header>

      {loading ? (
        <div className={styles.loading} role="status" aria-label="正在加载关注动态">
          <LoaderCircle className="animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <ContentGrid columns={2}>
          {items.slice(0, 6).map((item) => (
            <ContentCardV2
              key={item.id}
              item={item}
              variant="standard"
              showAuthor
              showTimestamp
            />
          ))}
        </ContentGrid>
      ) : (
        <EmptyStateV2
          icon={Activity}
          title="关注创作者后，他们的更新会出现在这里"
          action={{
            label: "去探索",
            href: "/discover",
            icon: ArrowRight,
          }}
        />
      )}
    </section>
  );
}

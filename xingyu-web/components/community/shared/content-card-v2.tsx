"use client";

import Link from "next/link";
import { Heart, MessageCircle, Eye, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { contentHref, resolveContentCoverUrl } from "@/lib/utils/content-helpers";
import { formatRelativeTime } from "@/lib/format";
import type { ContentSummary } from "@/lib/community-api";
import styles from "./content-card-v2.module.css";

type ContentCardV2Props = {
  item: ContentSummary;
  variant?: "standard" | "compact" | "feature";
  showAuthor?: boolean;
  showTimestamp?: boolean;
  showCover?: boolean;
  priority?: boolean;
};

/**
 * 统一的内容卡片组件 V2
 * 支持多种变体，替代旧版多个不同的卡片组件
 */
export function ContentCardV2({
  item,
  variant = "standard",
  showAuthor = true,
  showTimestamp = false,
  showCover = true,
  priority = false,
}: ContentCardV2Props) {
  const href = contentHref(item);
  const coverUrl = resolveContentCoverUrl(item.cover, item.id, 0);

  return (
    <Link href={href} className={`${styles.card} ${styles[variant]}`}>
      {showCover && item.cover && (
        <div className={styles.cover}>
          <img
            src={coverUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      )}

      <div className={styles.content}>
        {item.objectType && (
          <span className={styles.type}>
            {item.objectType === "series" ? "系列" : item.objectType === "moment" ? "动态" : "文章"}
          </span>
        )}

        <h3 className={styles.title}>{item.title}</h3>

        {item.summary && variant !== "compact" && (
          <p className={styles.summary}>{item.summary}</p>
        )}

        <div className={styles.meta}>
          {showAuthor && item.authorName && (
            <div className={styles.author}>
              {item.avatar && (
                <Avatar src={item.avatar} fallback={item.authorName} size="xs" />
              )}
              <span>{item.authorName}</span>
            </div>
          )}

          {showTimestamp && item.updatedAt && (
            <time className={styles.time}>{formatRelativeTime(item.updatedAt)}</time>
          )}

          {item.readMinutes && (
            <span className={styles.readTime}>{item.readMinutes} min</span>
          )}
        </div>

        <ArrowRight className={styles.arrow} aria-hidden="true" />
      </div>
    </Link>
  );
}

/**
 * 内容卡片网格容器
 */
export function ContentGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div className={styles.grid} data-columns={columns}>
      {children}
    </div>
  );
}

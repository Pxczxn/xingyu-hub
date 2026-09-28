"use client";

import styles from "./skeleton-card.module.css";

type SkeletonCardProps = {
  variant?: "standard" | "compact" | "feature";
  showCover?: boolean;
};

/**
 * 加载骨架屏卡片
 * 用于内容加载时的占位
 */
export function SkeletonCard({ variant = "standard", showCover = true }: SkeletonCardProps) {
  const textLines = variant === "compact" ? 2 : variant === "feature" ? 4 : 3;

  return (
    <div className={styles.skeleton} role="status" aria-label="加载中">
      {showCover && <div className={styles.skeletonCover} />}
      <div className={styles.skeletonContent}>
        <div className={styles.skeletonTitle} />
        {Array.from({ length: textLines }).map((_, i) => (
          <div
            key={i}
            className={styles.skeletonText}
            style={{ width: i === textLines - 1 ? "60%" : "100%" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 骨架屏列表
 */
export function SkeletonList({ count = 3, variant = "standard" }: { count?: number; variant?: SkeletonCardProps["variant"] }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant={variant} />
      ))}
    </>
  );
}

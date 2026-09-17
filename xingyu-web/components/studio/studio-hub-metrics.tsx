"use client";
import styles from "./studio-hub.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import type { InsightsView } from "@/lib/community-api";

type Props = {
  insights: InsightsView | null;
  loading: boolean;
};

const METRICS = [
  { key: "published", label: "已发布作品", anchor: "published" },
  { key: "readers", label: "读者数", anchor: "readers" },
  { key: "likes", label: "获得喜欢", anchor: "likes" },
  { key: "engagement", label: "互动数", anchor: "engagement" },
] as const;

export function StudioHubMetrics({ insights, loading }: Props) {
  const [expanded, setExpanded] = useState(true);

  const values: Record<string, number | null> = {
    published: insights?.articleCount ?? null,
    readers: insights?.followerCount ?? null,
    likes: insights?.likeCount ?? null,
    engagement: insights ? insights.commentCount + insights.likeCount : null,
  };

  return (
    <section className={cn(styles.metrics)} aria-labelledby="studio-hub-metrics-title">
      <header className={cn(styles.sectionHead)}>
        <h2 id="studio-hub-metrics-title" className={cn(styles.sectionTitle)}>创作数据</h2>
        <div className={cn(styles.metricsActions)}>
          <button
            type="button"
            className={cn(styles.textBtn)}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                收起 <ChevronUp aria-hidden="true" />
              </>
            ) : (
              <>
                展开 <ChevronDown aria-hidden="true" />
              </>
            )}
          </button>
          <Link href="/studio/analytics" className={cn(styles.textLink)}>
            查看详情 <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      {expanded ? (
        loading ? (
          <div className={cn(styles.metricsGrid)} aria-busy="true" aria-label="正在加载创作数据">
            {METRICS.map((metric) => (
              <div key={metric.key} className={cn(styles.metricCard, styles.skeleton)}>
                <span className={cn(styles.skeletonLine)} />
                <span className={cn(styles.skeletonLine, "short")} />
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(styles.metricsGrid)}>
            {METRICS.map((metric) => (
              <Link
                key={metric.key}
                href={`/studio/analytics#${metric.anchor}`}
                className={cn(styles.metricCard)}
              >
                <span className={cn(styles.metricLabel)}>{metric.label}</span>
                <strong className={cn(styles.metricValue)}>
                  {values[metric.key] == null ? "—" : values[metric.key]!.toLocaleString()}
                </strong>
                <svg className={cn(styles.sparkline)} viewBox="0 0 80 24" aria-hidden="true">
                  <polyline points="0,18 16,14 32,16 48,10 64,12 80,6" />
                </svg>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

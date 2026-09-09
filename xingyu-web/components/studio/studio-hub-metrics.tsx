"use client";

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
    <section className="xy-studio-hub-metrics" aria-labelledby="studio-hub-metrics-title">
      <header className="xy-studio-hub-section-head">
        <h2 id="studio-hub-metrics-title" className="xy-studio-hub-section-title">创作数据</h2>
        <div className="xy-studio-hub-metrics-actions">
          <button
            type="button"
            className="xy-studio-hub-text-btn"
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
          <Link href="/studio/analytics" className="xy-studio-hub-text-link">
            查看详情 <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      {expanded ? (
        loading ? (
          <div className="xy-studio-hub-metrics-grid" aria-busy="true" aria-label="正在加载创作数据">
            {METRICS.map((metric) => (
              <div key={metric.key} className="xy-studio-hub-metric-card xy-studio-hub-skeleton">
                <span className="xy-studio-hub-skeleton-line" />
                <span className="xy-studio-hub-skeleton-line short" />
              </div>
            ))}
          </div>
        ) : (
          <div className="xy-studio-hub-metrics-grid">
            {METRICS.map((metric) => (
              <Link
                key={metric.key}
                href={`/studio/analytics#${metric.anchor}`}
                className="xy-studio-hub-metric-card"
              >
                <span className="xy-studio-hub-metric-label">{metric.label}</span>
                <strong className="xy-studio-hub-metric-value">
                  {values[metric.key] == null ? "—" : values[metric.key]!.toLocaleString()}
                </strong>
                <svg className="xy-studio-hub-sparkline" viewBox="0 0 80 24" aria-hidden="true">
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

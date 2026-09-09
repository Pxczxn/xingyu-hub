"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, PenLine, Sparkles } from "lucide-react";
import type { ArticleSummary } from "@/lib/community-api";
import { formatStudioDateTime } from "@/lib/format";

type Props = {
  greeting: string;
  displayName: string;
  latestDraft: ArticleSummary | null;
  loading: boolean;
  onCreateArticle: () => void;
};

export function StudioHubHero({ greeting, displayName, latestDraft, loading, onCreateArticle }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("xy-studio-hero-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("xy-studio-hero-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <section className={`xy-studio-hub-hero${collapsed ? " is-collapsed" : ""}`} aria-labelledby="studio-hub-hero-title">
      <div className="xy-studio-hub-hero-inner">
        <div className="xy-studio-hub-hero-copy">
          <h1 id="studio-hub-hero-title" className="xy-studio-hub-hero-title">
            {greeting}，{displayName} <Sparkles className="xy-studio-hub-hero-star" aria-hidden="true" />
          </h1>
          {!collapsed ? (
            <p className="xy-studio-hub-hero-subtitle">
              今天想留下些什么？从一篇内容开始，慢慢沉淀你的星系。
            </p>
          ) : null}
        </div>
        <div className="xy-studio-hub-hero-actions">
          <button type="button" className="xy-studio-hub-hero-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed}>
            {collapsed ? (
              <>
                展开 <ChevronDown aria-hidden="true" />
              </>
            ) : (
              <>
                收起 <ChevronUp aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div className="xy-studio-hub-hero-card-wrap">
          {loading ? (
            <div className="xy-studio-hub-hero-card xy-studio-hub-skeleton" aria-busy="true" aria-label="正在加载草稿">
              <span className="xy-studio-hub-skeleton-line" />
              <span className="xy-studio-hub-skeleton-line short" />
            </div>
          ) : latestDraft ? (
            <Link href={`/studio/content/${encodeURIComponent(latestDraft.id)}`} className="xy-studio-hub-hero-card">
              <div>
                <strong>继续上次的创作</strong>
                <p>
                  {latestDraft.title || "未命名文章"} · 草稿 · {formatStudioDateTime(latestDraft.updatedAt)}
                </p>
              </div>
              <span className="xy-studio-hub-hero-card-cta">
                继续编辑 <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          ) : (
            <button type="button" className="xy-studio-hub-hero-card" onClick={onCreateArticle}>
              <div>
                <strong>开始第一篇创作</strong>
                <p>从一篇文章开始，记录你的想法</p>
              </div>
              <span className="xy-studio-hub-hero-card-cta">
                开始创作 <PenLine aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

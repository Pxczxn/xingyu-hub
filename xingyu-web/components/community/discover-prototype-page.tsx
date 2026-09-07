"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Filter,
  Hash,
  Sparkles,
  Users,
} from "lucide-react";
import { FollowButton } from "@/components/community/engagement";
import { Button } from "@/components/ui/button";
import {
  contentHref,
  type ContentSummary,
  type FollowUser,
  type SeriesSummary,
  type TopicSummary,
} from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type DiscoverPrototypePageProps = {
  articles: ContentSummary[];
  more: ContentSummary[];
  series: SeriesSummary[];
  topics: TopicSummary[];
  creators: FollowUser[];
};

const TYPE_TABS = ["全部", "文章", "系列", "创作者", "话题", "动态"] as const;
const SORT_TABS = ["最新", "精选", "近期热门", "兴趣相关"] as const;

const articleImages = [
  "/prototype-assets/discover/article-thumb-ai.png",
  "/prototype-assets/discover/article-thumb-reading.png",
  "/prototype-assets/discover/article-thumb-finance.png",
];

const seriesColors = ["#17295a", "#8a6547", "#437497", "#5e67b2"];
const topicColors = ["#13234d", "#7c79c7", "#e78d49", "#5e67b2", "#63b6ae", "#8a6547"];

function count(value?: number) {
  if (value === undefined) return "—";
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

function SectionHead({
  title,
  href,
  action = "查看全部",
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="xy-discover-section-head">
      <h2>{title}</h2>
      {href ? (
        <Link href={href} className="xy-discover-section-link">
          {action}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function FeaturedEmpty() {
  return (
    <div className="xy-discover-featured-empty">
      <div className="xy-discover-empty-intro">
        <span className="xy-discover-empty-icon"><Compass aria-hidden="true" /></span>
        <div><strong>从兴趣开始探索</strong><p>精选内容正在汇集，先从一个方向进入社区。</p></div>
      </div>
      <div className="xy-discover-empty-links">
        <Link href="/topics"><Hash aria-hidden="true" /><span><b>逛逛话题</b><small>找到正在讨论的方向</small></span><ArrowRight aria-hidden="true" /></Link>
        <Link href="/series"><BookOpen aria-hidden="true" /><span><b>阅读系列</b><small>沿着主题慢慢深入</small></span><ArrowRight aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

export function DiscoverPrototypePage({
  articles,
  more,
  series,
  topics,
  creators,
}: DiscoverPrototypePageProps) {
  const [typeTab, setTypeTab] = useState<(typeof TYPE_TABS)[number]>("全部");
  const [sortTab, setSortTab] = useState<(typeof SORT_TABS)[number]>("精选");

  const primary = articles[0];
  const secondary = articles.slice(1, 3);
  const latest = articles.slice(3, 7);

  const visibleCreators = useMemo(() => creators.slice(0, 6), [creators]);
  const visibleSeries = useMemo(() => series.slice(0, 3), [series]);
  const asideTopics = useMemo(() => topics.slice(0, 3), [topics]);

  return (
    <main className="xy-discover-page">
      <div className="xy-discover-first-screen">
        <header className="xy-discover-hero">
          <img src="/prototype-assets/discover/hero-cosmos.png" alt="" className="xy-discover-hero-art" />
          <div className="xy-discover-hero-copy">
            <span className="xy-discover-hero-kicker">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              发现
            </span>
            <h1>探索星辰大海，发现优质内容</h1>
            <p className="xy-discover-hero-desc">精选深度文章、优质系列与创作者，拓展你的认知边界</p>
            <Link href="/search" className="xy-discover-hero-cta">
              开始探索
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="xy-discover-hero-note"><span>今日探索</span><strong>从一个好奇的问题开始</strong><small>文章 · 系列 · 话题</small></div>
        </header>
      </div>

      <div className="xy-discover-toolbar" role="toolbar" aria-label="发现页筛选">
          <div className="xy-discover-type-tabs" role="tablist" aria-label="内容类型">
            {TYPE_TABS.map((label) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={typeTab === label}
                className={cn(typeTab === label && "is-active")}
                onClick={() => setTypeTab(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="xy-discover-sort-row">
            <div className="xy-discover-sort-tabs" role="tablist" aria-label="排序方式">
              {SORT_TABS.map((label) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={sortTab === label}
                  className={cn(sortTab === label && "is-active")}
                  onClick={() => setSortTab(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="xy-discover-filter-btn shrink-0 gap-1.5">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              筛选
            </Button>
          </div>
      </div>

      <div className="xy-discover-layout xy-discover-layout-first">
          <section className="xy-discover-panel">
            <SectionHead title="编辑精选" />
            {primary ? (
              <div className="xy-discover-featured">
                <Link href={contentHref(primary)} className="xy-discover-featured-primary group">
                  <img
                    src={primary.cover || "/prototype-assets/discover/featured-image.png"}
                    alt=""
                    className="xy-discover-featured-cover"
                  />
                  <div className="xy-discover-featured-body">
                    <h3>{primary.title}</h3>
                    <p>{primary.summary}</p>
                    <div className="xy-discover-meta">
                      <span className="xy-discover-avatar-fallback">
                        {(primary.authorName || "星").slice(0, 1)}
                      </span>
                      <span>{primary.authorName || "星语创作者"}</span>
                      <time className="ml-auto">
                        {primary.updatedAt ? formatDateTime(primary.updatedAt) : "刚刚"}
                      </time>
                    </div>
                  </div>
                </Link>
                {secondary.length > 0 ? (
                  <ul className="xy-discover-featured-list">
                    {secondary.map((item, index) => (
                      <li key={item.id}>
                        <Link href={contentHref(item)} className="xy-discover-featured-item">
                          <img src={item.cover || articleImages[index % articleImages.length]} alt="" />
                          <span className="min-w-0 flex-1">
                            <strong>{item.title}</strong>
                            <small>
                              {item.authorName || "星语创作者"}
                              <span aria-hidden="true"> · </span>
                              {item.updatedAt ? formatDateTime(item.updatedAt) : "刚刚"}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <FeaturedEmpty />
            )}
          </section>

          <aside className="xy-discover-aside">
            <section className="xy-discover-panel">
              <SectionHead title="热门系列" href="/series" />
              {visibleSeries.length > 0 ? (
                <ul className="xy-discover-series-list">
                  {visibleSeries.map((item, index) => (
                    <li key={item.id}>
                      <Link href={`/series/${item.id}`} className="xy-discover-series-row">
                        <span
                          className="xy-discover-series-mark"
                          style={{ background: seriesColors[index % seriesColors.length] }}
                        >
                          <BookOpen className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong>{item.title}</strong>
                          <small>
                            {item.chapterCount !== undefined ? `共 ${item.chapterCount} 篇` : "连载中"}
                          </small>
                        </span>
                        <span className="xy-discover-series-action">订阅</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="xy-discover-inline-empty">暂无系列推荐</p>
              )}
            </section>

            <section className="xy-discover-panel xy-discover-panel-compact">
              <SectionHead title="话题探索" href="/topics" action="全部话题" />
              {asideTopics.length > 0 ? (
                <ul className="xy-discover-topic-list">
                  {asideTopics.map((topic, index) => (
                    <li key={topic.id}>
                      <Link href={`/topics/${topic.slug}`} className="xy-discover-topic-chip">
                        <span
                          className="xy-discover-topic-icon"
                          style={{ background: topicColors[index % topicColors.length] }}
                        >
                          <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong># {topic.name}</strong>
                          <small>{count(topic.contentCount)} 讨论</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="xy-discover-inline-empty">暂无话题</p>
              )}
            </section>
          </aside>
      </div>

      <div className="xy-discover-below-fold">
        <div className="xy-discover-below-grid">
          <section className="xy-discover-panel">
            <SectionHead title="最新优质文章" href="/discover" />
            {latest.length > 0 ? (
              <ul className="xy-discover-article-list">
                {latest.map((item, index) => (
                  <li key={item.id}>
                    <Link href={contentHref(item)} className="xy-discover-article-row">
                      <img src={item.cover || articleImages[index % articleImages.length]} alt="" />
                      <span className="min-w-0 flex-1">
                        <strong>{item.title}</strong>
                        <small>
                          {item.authorName || "星语创作者"}
                          <span aria-hidden="true"> · </span>
                          {item.updatedAt ? formatDateTime(item.updatedAt) : "刚刚"}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="xy-discover-inline-empty">暂无文章，稍后再来看看</p>
            )}
          </section>

          {more.length > 0 ? (
            <section className="xy-discover-panel">
              <SectionHead title="社区动态精选" href="/moments" />
              <ul className="xy-discover-moment-list">
                {more.slice(0, 4).map((item, index) => (
                  <li key={item.id}>
                    <Link href={contentHref(item)} className="xy-discover-moment-row">
                      <span className="xy-discover-moment-index">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <strong>{item.title}</strong>
                        <small>{item.summary}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {visibleCreators.length > 0 ? (
          <section className="xy-discover-panel xy-discover-creators">
            <SectionHead title="推荐创作者" href="/search?type=USER" />
            <div className="xy-discover-creator-track">
              {visibleCreators.map((creator, index) => (
                <article key={creator.userId} className="xy-discover-creator-card">
                  <span
                    className="xy-discover-creator-avatar"
                    style={{ background: index % 2 ? "#7490c7" : "#13234d" }}
                  >
                    {(creator.displayName || creator.username).slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/users/${creator.username}`} className="xy-discover-creator-name">
                      {creator.displayName || creator.username}
                    </Link>
                    <span className="xy-discover-creator-role">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      创作者
                    </span>
                  </div>
                  <FollowButton
                    username={creator.username}
                    compact
                    className="h-8 shrink-0 px-2.5 text-xs [&_svg]:hidden"
                  />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

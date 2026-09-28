"use client";

import styles from "./announcements.module.css";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { ArrowRight, Bell, Megaphone, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/ui/alert";
import {
  ANNOUNCEMENT_TABS,
  countAnnouncementsByCategory,
  filterAnnouncements,
  type AnnouncementTabId,
} from "@/lib/announcement-categories";
import { communityApi } from "@/lib/community-api";
import { formatDateTime } from "@/lib/format";
import { useAsyncData } from "@/lib/use-async-data";

const announcementIcons = [Megaphone, Bell, Wrench];

function AnnouncementEmptyIllustration() {
  return (
    <svg
      className={styles.emptyArt}
      viewBox="0 0 180 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="90" cy="68" r="54" fill="url(#announcementNebulaGlow)" />
      <circle cx="64" cy="48" r="22" fill="rgb(94 103 178 / 0.12)" />
      <circle cx="118" cy="40" r="12" fill="rgb(19 35 77 / 0.08)" />
      <circle cx="126" cy="82" r="16" fill="rgb(228 139 76 / 0.1)" />
      <path
        d="M48 86c10-12 22-18 42-18s32 6 42 18"
        stroke="rgb(94 103 178 / 0.2)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g transform="translate(52 38)">
        <rect x="0" y="22" width="76" height="50" rx="12" fill="rgb(255 255 255 / 0.95)" />
        <path
          d="M0 30 38 56 76 30"
          fill="rgb(94 103 178 / 0.14)"
          stroke="rgb(94 103 178 / 0.28)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect x="0" y="22" width="76" height="50" rx="12" stroke="rgb(19 35 77 / 0.1)" strokeWidth="1.2" />
        <circle cx="58" cy="36" r="2.5" fill="rgb(228 139 76 / 0.55)" />
        <circle cx="66" cy="46" r="1.8" fill="rgb(94 103 178 / 0.4)" />
        <circle cx="16" cy="40" r="1.8" fill="rgb(94 103 178 / 0.35)" />
      </g>
      <defs>
        <radialGradient
          id="announcementNebulaGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(90 68) rotate(90) scale(54)"
        >
          <stop stopColor="rgb(94 103 178 / 0.18)" />
          <stop offset="1" stopColor="rgb(94 103 178 / 0)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function ListEmptyState({
  variant,
  onResetFilters,
}: {
  variant: "catalog" | "filtered";
  onResetFilters?: () => void;
}) {
  if (variant === "filtered") {
    return (
      <div className={cn(styles.empty, styles.emptyFiltered)} role="status">
        <p className={styles.emptyTitle}>没有匹配的公告</p>
        <p className={styles.emptyHint}>换个关键词试试，或切回全部分类。</p>
        {onResetFilters ? (
          <button type="button" className={styles.emptyReset} onClick={onResetFilters}>
            查看全部公告
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(styles.empty, styles.emptyCatalog)} role="status">
      <AnnouncementEmptyIllustration />
      <p className={styles.emptyTitle}>这里暂时没有新公告</p>
      <p className={styles.emptyHint}>有新通知时会出现在这里，你可以先去首页探索更多内容。</p>
      <Link href="/" className={styles.emptyAction}>
        去首页看看
      </Link>
    </div>
  );
}

export default function AnnouncementsPage() {
  const { data, loading, error } = useAsyncData(() => communityApi.getAnnouncements(), []);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<AnnouncementTabId>("ALL");

  const announcements = data ?? [];
  const pinned = announcements[0] ?? null;
  const categoryCounts = useMemo(() => countAnnouncementsByCategory(announcements), [announcements]);
  const items = useMemo(
    () => filterAnnouncements(announcements, activeTab, query),
    [announcements, activeTab, query],
  );

  const isCatalogEmpty = !loading && announcements.length === 0;
  const isFilteredEmpty =
    !loading && announcements.length > 0 && items.length === 0;
  const showToolbar = !loading && announcements.length > 0;
  const showSidebar = announcements.length > 0;

  function resetFilters() {
    setQuery("");
    setActiveTab("ALL");
  }

  return (
    <AppShell>
      <main className={cn(styles.page)} data-layout="announcements">
        <div className={cn(styles.inner, isCatalogEmpty && styles.innerEmpty)}>
          {error ? <Alert variant="destructive">{error}</Alert> : null}

          <header className={cn(styles.heading, isCatalogEmpty && styles.headingEmpty)}>
            <h1>公告中心</h1>
          </header>

          <div className={cn(styles.layout, isCatalogEmpty && styles.layoutSingle)}>
            <section
              className={cn(
                styles.card,
                styles.listCard,
                isCatalogEmpty && styles.listCardEmpty,
              )}
              aria-label="公告列表"
            >
              {showToolbar ? (
                <div className={cn(styles.toolbarRow)}>
                  <div className={cn(styles.tabs)} role="tablist" aria-label="公告分类">
                    {ANNOUNCEMENT_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={cn(styles.tab, activeTab === tab.id && styles.isActive)}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span className={styles.tabLabel}>{tab.label}</span>
                        <span className={styles.tabBadge}>{categoryCounts[tab.id]}</span>
                      </button>
                    ))}
                  </div>

                  <div className={cn(styles.toolbarActions)}>
                    <span className={cn(styles.resultCount)}>{announcements.length} 条已发布</span>
                    <label className={cn(styles.search)}>
                      <Search aria-hidden="true" />
                      <span className="sr-only">搜索公告</span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索公告标题或内容"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  styles.listBody,
                  isCatalogEmpty && styles.listBodyEmpty,
                  isFilteredEmpty && styles.listBodyFiltered,
                )}
              >
                {loading ? (
                  <p className={cn(styles.status)}>正在加载公告…</p>
                ) : !items.length ? (
                  <ListEmptyState
                    variant={isCatalogEmpty ? "catalog" : "filtered"}
                    onResetFilters={isFilteredEmpty ? resetFilters : undefined}
                  />
                ) : (
                  items.map((item, index) => {
                    const Icon = announcementIcons[index % announcementIcons.length];
                    return (
                      <Link
                        href={`/announcements/${encodeURIComponent(item.id)}`}
                        key={item.id}
                        className={cn(styles.item)}
                      >
                        <span className={cn(styles.itemIcon)} aria-hidden="true">
                          <Icon />
                        </span>
                        <span className={cn(styles.itemCopy)}>
                          <h3>{item.title}</h3>
                          <p>
                            {item.body
                              ? item.body
                              : "点击查看这条公告的完整说明。"}
                          </p>
                        </span>
                        <time>{item.publishedAt ? formatDateTime(item.publishedAt) : "—"}</time>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {showSidebar ? (
              <aside className={cn(styles.side)} aria-label="公告辅助信息">
                {pinned ? (
                  <section className={cn(styles.card, styles.sideCard)}>
                    <h2>置顶公告</h2>
                    <Link
                      href={`/announcements/${encodeURIComponent(pinned.id)}`}
                      className={cn(styles.pinnedCard)}
                    >
                      <span className={cn(styles.pinnedBadge)}>置顶</span>
                      <strong className={cn(styles.pinnedTitle)}>{pinned.title}</strong>
                      <p className={cn(styles.pinnedSummary)}>
                        {pinned.body || "点击查看完整公告内容。"}
                      </p>
                      <span className={cn(styles.pinnedAction)}>
                        查看详情
                        <ArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  </section>
                ) : null}

                {announcements.length > 1 ? (
                  <section className={cn(styles.card, styles.sideCard, styles.infoCard)}>
                    <h2>公告说明</h2>
                    <p>这里发布社区规则、版本更新、活动与维护通知。最新一条会置顶展示，其余按发布时间排列。</p>
                  </section>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

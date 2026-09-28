"use client";
import styles from "@/components/community/discover-prototype-page.module.css";
import { cn } from "@/lib/utils";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { DiscoverPrototypePage } from "@/components/community/discover-prototype-page";
import {
  communityApi,
  DEFAULT_EXPLORE_NAV,
  type ContentSummary,
  type ExploreNav,
  type FollowUser,
  type GalaxySummary,
  type SeriesSummary,
  type TopicCreatorSummary,
  type TopicSummary,
} from "@/lib/community-api";

type DiscoverData = {
  feed: ContentSummary[];
  series: SeriesSummary[];
  topics: TopicSummary[];
  creators: FollowUser[];
  galaxies: GalaxySummary[];
};

function isArticle(item: ContentSummary) {
  return !item.objectType || item.objectType === "ARTICLE";
}

function pickDefaultTab<T extends { key: string; defaultSelected?: boolean }>(tabs: T[], fallbackKey: string) {
  return tabs.find((tab) => tab.defaultSelected)?.key ?? tabs[0]?.key ?? fallbackKey;
}

function toFollowUser(creator: TopicCreatorSummary): FollowUser {
  return {
    userId: creator.username,
    username: creator.username,
    displayName: creator.displayName,
  };
}

async function loadCreators(topics: TopicSummary[]): Promise<FollowUser[]> {
  try {
    const suggested = await communityApi.getSuggestedUsers(6);
    if (suggested.length > 0) return suggested;
  } catch {
    // 访客或未登录时回退到热门话题下的创作者
  }

  const hotTopics = [...topics].sort((left, right) => (right.contentCount ?? 0) - (left.contentCount ?? 0)).slice(0, 3);
  const results = await Promise.allSettled(hotTopics.map((topic) => communityApi.getTopicCreators(topic.slug, 4)));
  const seen = new Set<string>();
  const creators: FollowUser[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const creator of result.value) {
      if (seen.has(creator.username)) continue;
      seen.add(creator.username);
      creators.push(toFollowUser(creator));
      if (creators.length >= 6) return creators;
    }
  }

  return creators;
}

async function loadDiscoverData(domainKey: string, sortKey: string): Promise<DiscoverData> {
  const [feedResult, series, topicsResult, galaxiesResult] = await Promise.allSettled([
    communityApi.getExploreFeed(domainKey, sortKey, 20),
    communityApi.listSeries(8),
    communityApi.getTopics(),
    communityApi.getGalaxies(),
  ]);

  const topics = topicsResult.status === "fulfilled" ? topicsResult.value : [];
  const creators = await loadCreators(topics).catch(() => []);

  return {
    feed: feedResult.status === "fulfilled" ? feedResult.value : [],
    series: series.status === "fulfilled" ? series.value : [],
    topics,
    creators,
    galaxies: galaxiesResult.status === "fulfilled" ? galaxiesResult.value : [],
  };
}

function DiscoverPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nav, setNav] = useState<ExploreNav>(DEFAULT_EXPLORE_NAV);
  const domainKey =
    searchParams.get("domain") ?? (nav.mode === "user" ? "all" : pickDefaultTab(nav.domainTabs, "tech"));
  const sortKey = searchParams.get("sort") ?? pickDefaultTab(nav.sortTabs, "featured");
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi
      .getExploreNav()
      .then(setNav)
      .catch(() => setNav(DEFAULT_EXPLORE_NAV));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadDiscoverData(domainKey, sortKey)
      .then(setData)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [domainKey, sortKey]);

  const handleFilterChange = useCallback(
    (nextDomain: string, nextSort: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("domain", nextDomain);
      params.set("sort", nextSort);
      const query = params.toString();
      router.replace(query ? `/discover?${query}` : "/discover", { scroll: false });
    },
    [router, searchParams]
  );

  const articles = (data?.feed ?? []).filter(isArticle);
  const more = (data?.feed ?? []).filter((item) => !isArticle(item));

  return (
    <AppShell>
      <main>
        {loading ? (
          <div className={cn(styles.loading, "mx-auto", "w-[min(100%-2rem,1180px)]")} aria-busy="true" aria-label="加载探索内容">
            <div className={styles.loadingToolbar}>
              <div className={styles.loadingToolbarRow}>
                <span className={styles.loadingPill} />
                <span className={styles.loadingPillWide} />
                <span className={styles.loadingPill} />
                <span className={styles.loadingPill} />
              </div>
              <div className={styles.loadingToolbarRow}>
                <span className={styles.loadingTab} />
                <span className={styles.loadingTab} />
                <span className={styles.loadingTab} />
                <span className={styles.loadingTabShort} />
              </div>
            </div>
            <div className={styles.loadingGrid}>
              <div className={styles.loadingMain}>
                <span className={styles.loadingLineTitle} />
                <span className={styles.loadingLineSub} />
                <div className={styles.loadingStream}>
                  <span className={styles.loadingStreamItem} />
                  <span className={styles.loadingStreamItem} />
                  <span className={styles.loadingStreamItem} />
                </div>
              </div>
              <div className={styles.loadingSide}>
                <span className={styles.loadingLineTitle} />
                <span className={styles.loadingSideItem} />
                <span className={styles.loadingSideItem} />
                <span className={styles.loadingLineTitle} />
                <span className={styles.loadingSideItem} />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className={cn(styles.stateShell)}>
            <EmptyState title="加载失败" description={error} />
          </div>
        ) : (
          <DiscoverPrototypePage
            nav={nav}
            domainKey={domainKey}
            sortKey={sortKey}
            onFilterChange={handleFilterChange}
            articles={articles}
            more={more}
            series={data?.series ?? []}
            topics={data?.topics ?? []}
            creators={data?.creators ?? []}
            galaxies={data?.galaxies ?? []}
          />
        )}
      </main>
    </AppShell>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className={cn(styles.stateShell)}>加载中…</div>}>
      <DiscoverPageContent />
    </Suspense>
  );
}

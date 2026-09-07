"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { DiscoverPrototypePage } from "@/components/community/discover-prototype-page";
import {
  communityApi,
  DEFAULT_DISCOVER_NAV,
  type ContentSummary,
  type DiscoverNav,
  type FollowUser,
  type SeriesSummary,
  type TopicCreatorSummary,
  type TopicSummary,
} from "@/lib/community-api";

type DiscoverData = {
  articles: ContentSummary[];
  more: ContentSummary[];
  series: SeriesSummary[];
  topics: TopicSummary[];
  creators: FollowUser[];
};

function isArticle(item: ContentSummary) {
  return !item.objectType || item.objectType === "ARTICLE";
}

function sortKeyToFeedType(sort: string) {
  switch (sort) {
    case "latest":
      return "latest";
    case "hot":
      return "hot";
    case "interest":
      return "recommended";
    default:
      return "recommended";
  }
}

function filterByType(items: ContentSummary[], type: string) {
  switch (type) {
    case "article":
      return items.filter(isArticle);
    case "moment":
      return items.filter((item) => item.objectType === "MOMENT");
    case "series":
      return items.filter((item) => item.objectType === "SERIES");
    default:
      return items;
  }
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

async function loadDiscoverData(typeKey: string, sortKey: string): Promise<DiscoverData> {
  const feedType = sortKeyToFeedType(sortKey);
  const [feedItems, series, topicsResult] = await Promise.allSettled([
    communityApi.getFeed(feedType, 0, 20),
    communityApi.listSeries(8),
    communityApi.getTopics(),
  ]);

  const topics = topicsResult.status === "fulfilled" ? topicsResult.value : [];
  const creators = await loadCreators(topics).catch(() => []);
  const items = feedItems.status === "fulfilled" ? filterByType(feedItems.value, typeKey) : [];
  const articles = items.filter(isArticle);
  const more = items.filter((item) => !isArticle(item));

  return {
    articles,
    more,
    series: series.status === "fulfilled" ? series.value : [],
    topics,
    creators,
  };
}

function DiscoverPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nav, setNav] = useState<DiscoverNav>(DEFAULT_DISCOVER_NAV);
  const typeKey = searchParams.get("type") ?? pickDefaultTab(nav.typeTabs, "all");
  const sortKey = searchParams.get("sort") ?? pickDefaultTab(nav.sortTabs, "featured");
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityApi
      .getDiscoverNav()
      .then(setNav)
      .catch(() => setNav(DEFAULT_DISCOVER_NAV));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadDiscoverData(typeKey, sortKey)
      .then(setData)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [typeKey, sortKey]);

  const handleFilterChange = useCallback(
    (nextType: string, nextSort: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("type", nextType);
      params.set("sort", nextSort);
      const query = params.toString();
      router.replace(query ? `/discover?${query}` : "/discover", { scroll: false });
    },
    [router, searchParams]
  );

  const hasContent = useMemo(
    () =>
      Boolean(
        data &&
          (data.articles.length > 0 ||
            data.more.length > 0 ||
            data.series.length > 0 ||
            data.topics.length > 0 ||
            data.creators.length > 0)
      ),
    [data]
  );

  return (
    <AppShell>
      <main>
        {loading ? (
          <div className="xy-discover-loading mx-auto w-[min(100%-2rem,1408px)]">
            <div className="xy-discover-loading-hero">
              <span className="h-3 w-28 rounded-full bg-white/60" />
              <span className="mt-5 block h-10 w-2/3 rounded-lg bg-white/70" />
              <span className="mt-4 block h-4 w-1/2 rounded-full bg-white/50" />
            </div>
            <div className="xy-discover-loading-grid">
              <div className="xy-discover-loading-card" />
              <div className="xy-discover-loading-card" />
              <div className="xy-discover-loading-side" />
            </div>
          </div>
        ) : error ? (
          <div className="xy-page">
            <EmptyState title="加载失败" description={error} />
          </div>
        ) : (
          <DiscoverPrototypePage
            nav={nav}
            typeKey={typeKey}
            sortKey={sortKey}
            onFilterChange={handleFilterChange}
            articles={hasContent ? data!.articles : []}
            more={data?.more ?? []}
            series={data?.series ?? []}
            topics={data?.topics ?? []}
            creators={data?.creators ?? []}
          />
        )}
      </main>
    </AppShell>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="xy-page">加载中…</div>}>
      <DiscoverPageContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { DiscoverPrototypePage } from "@/components/community/discover-prototype-page";
import {
  communityApi,
  type ContentSummary,
  type EventSummary,
  type FollowUser,
  type GalaxySummary,
  type SeriesSummary,
  type TopicSummary,
  type TopicCreatorSummary,
} from "@/lib/community-api";

type DiscoverData = {
  articles: ContentSummary[];
  more: ContentSummary[];
  series: SeriesSummary[];
  topics: TopicSummary[];
  events: EventSummary[];
  galaxies: GalaxySummary[];
  creators: FollowUser[];
};

function isArticle(item: ContentSummary) {
  return !item.objectType || item.objectType === "ARTICLE";
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

async function loadDiscoverData(): Promise<DiscoverData> {
  const [discoverResult, series, topicsResult, events, galaxies] = await Promise.allSettled([
    communityApi.getDiscover({ limit: 20 }),
    communityApi.listSeries(8),
    communityApi.getTopics(),
    communityApi.getEvents(5),
    communityApi.getGalaxies(),
  ]);

  const topics = topicsResult.status === "fulfilled" ? topicsResult.value : [];
  const creators = await loadCreators(topics);
  const items = discoverResult.status === "fulfilled" ? discoverResult.value.items : [];
  const articles = items.filter(isArticle);
  const more = items.filter((item) => !isArticle(item));

  return {
    articles,
    more,
    series: series.status === "fulfilled" ? series.value : [],
    topics,
    events: events.status === "fulfilled" ? events.value : [],
    galaxies: galaxies.status === "fulfilled" ? galaxies.value : [],
    creators,
  };
}

export default function DiscoverPage() {
  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiscoverData()
      .then(setData)
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const hasContent = Boolean(
    data &&
      (data.articles.length > 0 ||
        data.more.length > 0 ||
        data.series.length > 0 ||
        data.topics.length > 0 ||
        data.events.length > 0 ||
        data.galaxies.length > 0 ||
        data.creators.length > 0)
  );

  return (
    <AppShell>
      <main>
        {loading ? (
          <div className="xy-discover-loading mx-auto w-[min(100%-2rem,1408px)]"><div className="xy-discover-loading-hero"><span className="h-3 w-28 rounded-full bg-white/60"/><span className="mt-5 block h-10 w-2/3 rounded-lg bg-white/70"/><span className="mt-4 block h-4 w-1/2 rounded-full bg-white/50"/></div><div className="xy-discover-loading-grid"><div className="xy-discover-loading-card"/><div className="xy-discover-loading-card"/><div className="xy-discover-loading-side"/></div></div>
        ) : error ? (
          <div className="xy-page"><EmptyState title="加载失败" description={error} /></div>
        ) : !hasContent ? (
          <DiscoverPrototypePage articles={[]} more={[]} series={[]} topics={[]} creators={[]} />
        ) : (
          <DiscoverPrototypePage articles={data!.articles} more={data!.more} series={data!.series} topics={data!.topics} creators={data!.creators} />
        )}
      </main>
    </AppShell>
  );
}

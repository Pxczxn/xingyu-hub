"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Eye, MessageSquare, Sparkles, Star } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { FollowButton } from "@/components/community/engagement";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { communityApi, contentHref } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function formatCount(value?: number) {
  if (!value) return "0";
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

const relatedNames: string[] = [];

export default function TopicDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug || "");
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [contentType, setContentType] = useState("ALL");
  const [contentSort, setContentSort] = useState<"latest" | "hot">("latest");
  const {
    data: topic,
    loading,
    error,
  } = useAsyncData(() => communityApi.getTopic(slug), [slug]);
  const { data: latest, loading: latestLoading } = useAsyncData(
    () =>
      topic
        ? communityApi.getTopicContent(slug, "latest", 8)
        : Promise.resolve([]),
    [slug, topic?.id],
  );
  const { data: hot } = useAsyncData(
    () =>
      topic
        ? communityApi.getTopicContent(slug, "hot", 4)
        : Promise.resolve([]),
    [slug, topic?.id],
  );
  const { data: creators } = useAsyncData(
    () =>
      topic ? communityApi.getTopicCreators(slug, 8) : Promise.resolve([]),
    [slug, topic?.id],
  );

  useEffect(() => {
    if (topic?.following != null) setFollowing(topic.following);
  }, [topic?.following]);

  async function toggleFollow() {
    if (!topic) return;
    setFollowLoading(true);
    setFollowError(null);
    try {
      if (following) await communityApi.unfollowTopic(topic.id);
      else await communityApi.followTopic(topic.id);
      setFollowing((value) => !value);
    } catch (err) {
      setFollowError(
        err instanceof ApiError
          ? err.problem.detail || "操作失败"
          : "操作失败，请确认已登录",
      );
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading)
    return (
      <AppShell>
        <main className="xy-page">
          <p className="text-sm text-muted-foreground">加载中…</p>
        </main>
      </AppShell>
    );
  if (error || !topic)
    return (
      <AppShell>
        <main className="xy-page">
          <Alert variant="destructive">{error || "话题不存在"}</Alert>
        </main>
      </AppShell>
    );

  const hotItems = hot ?? [];
  const latestItems = latest ?? [];
  const creatorItems = creators ?? [];
  const sortedItems = contentSort === "hot" ? hotItems : latestItems;
  const visibleItems = contentType === "ALL"
    ? sortedItems
    : sortedItems.filter((item) => (item.objectType || "ARTICLE") === contentType);

  return (
    <AppShell>
      <main className="mx-auto w-[calc(100%_-_2rem)] max-w-[1408px] pb-8 pt-4">
        <section className="relative min-h-[192px] overflow-hidden rounded-2xl bg-white/32">
          <img
            src="/prototype-assets/topic-detail/hero-orbits.png"
            alt=""
            className="absolute inset-y-0 right-0 h-full w-[52%] object-cover opacity-80"
          />
          <div className="relative z-10 flex items-center gap-6 px-4 py-4 sm:px-5">
            <img
              src="/prototype-assets/topic-detail/topic-emblem.png"
              alt=""
              className="h-[155px] w-[169px] shrink-0 rounded-full object-cover"
            />
            <div className="max-w-[520px]">
              <h1 className="text-[40px] font-semibold tracking-[-0.05em] text-[#13234d]">
                {topic.name}
              </h1>
              <p className="mt-2 max-w-lg text-base leading-6 text-[#556078]">
                {topic.description ||
                  "探索智能的边界，聚焦技术、应用与未来影响，连接思想，启发创造。"}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-8 text-sm">
                <span>
                  <strong className="text-lg">
                    {formatCount(topic.followerCount)}
                  </strong>{" "}
                  关注者
                </span>
                <span>
                  <strong className="text-lg">
                    {formatCount(topic.contentCount)}
                  </strong>{" "}
                  内容
                </span>
                <Button
                  disabled={followLoading}
                  onClick={() => void toggleFollow()}
                  className="gap-2 px-6"
                >
                  <Star className="h-4 w-4" />
                  {followLoading ? "处理中…" : following ? "已关注" : "关注"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {followError && (
          <Alert variant="destructive" className="mt-3">
            {followError}
          </Alert>
        )}

        <section className="xy-home-source-panel mt-1 flex min-h-[74px] items-center gap-6 overflow-x-auto px-5">
          <h2 className="shrink-0 text-[17px] font-semibold">相关话题</h2>
          {relatedNames.map((name, index) => (
            <Link
              href={`/search?q=${encodeURIComponent(name)}`}
              key={name}
              className="flex min-w-48 items-center gap-3"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[#dde3f0] text-[#3f5f9f]">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <strong className="block text-sm">{name}</strong>
                <small className="text-[#8991a2]">
                  {formatCount(184000 - index * 28000)} 关注
                </small>
              </span>
            </Link>
          ))}
          <Link
            href="/topics"
            className="ml-auto shrink-0 text-sm text-[#566178]"
          >
            查看全部 ›
          </Link>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-semibold">精选内容</h2>
              <span className="text-sm text-[#8991a1]">
                编辑推荐 · 优质内容精选
              </span>
            </div>
            <Link
              href={`/search?q=${encodeURIComponent(topic.name)}`}
              className="text-sm text-[#566178]"
            >
              查看全部 ›
            </Link>
          </div>
          {hotItems.length ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
              <Link
                href={contentHref(hotItems[0])}
                className="relative min-h-[310px] overflow-hidden rounded-xl bg-[#15295a] text-white"
              >
                <img
                  src="/prototype-assets/topic-detail/featured-landscape.png"
                  alt=""
                  className="absolute inset-x-0 top-0 h-[211px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10214d] via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                  <span className="rounded-full bg-[#17284f]/85 px-3 py-1 text-xs">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />深度好文
                  </span>
                  <h3 className="mt-3 text-[21px] font-semibold">
                    {hotItems[0].title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm text-white/78">
                    {hotItems[0].summary}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-white/85">
                    <span>{hotItems[0].authorName || "作者信息暂未提供"} · {hotItems[0].updatedAt ? new Date(hotItems[0].updatedAt).toLocaleDateString("zh-CN") : "更新时间暂未提供"}</span>
                    <Eye className="ml-auto h-4 w-4" />
                    <span>阅读数据暂未提供</span>
                    <MessageSquare className="h-4 w-4" />
                    <span>评论数据暂未提供</span>
                  </div>
                </div>
              </Link>
              <div className="grid gap-3">
                {hotItems.slice(1, 3).map((item, index) => (
                  <Link
                    href={contentHref(item)}
                    key={item.id}
                    className={`relative min-h-[149px] overflow-hidden rounded-xl p-5 text-white ${index ? "bg-[linear-gradient(135deg,#1a3269,#6e73c5)]" : "bg-[radial-gradient(circle_at_75%_35%,#3158b4,#0f234e_62%)]"}`}
                  >
                    <span className="rounded-full bg-black/20 px-3 py-1 text-xs">
                      <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{index ? "实践教程" : "前沿观察"}
                    </span>
                    <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-white/78">
                      {item.summary}
                    </p>
                    <div className="absolute bottom-4 left-5 right-5 flex items-center text-xs text-white/85">
                      <span>{item.authorName || "作者信息暂未提供"} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("zh-CN") : "更新时间暂未提供"}</span>
                      <span className="ml-auto">互动数据暂未提供</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="暂无精选内容"
              description="该话题下还没有可展示的公开内容"
              actionLabel="去发现"
              actionHref="/discover"
            />
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center gap-8 border-b border-[#e6e3dc]">
            <h2 className="pb-3 text-[20px] font-semibold">最新内容</h2>
            {[["ALL", "全部"], ["ARTICLE", "文章"], ["SERIES", "系列"], ["MOMENT", "动态"]].map(
              ([type, name]) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={contentType === type}
                  onClick={() => setContentType(type)}
                  className={`px-1 pb-3 text-sm ${contentType === type ? "border-b-2 border-[#5d66b0] text-[#3f4792]" : "text-[#667087]"}`}
                >
                  {name}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setContentSort((value) => value === "latest" ? "hot" : "latest")}
              className="ml-auto pb-3 text-sm text-[#667087]"
            >
              {contentSort === "latest" ? "最新发布" : "热门优先"}⌄
            </button>
          </div>
          {latestLoading ? (
            <p className="py-8 text-sm text-[#7d8597]">加载中…</p>
          ) : visibleItems.length ? (
            <div className="mt-3 space-y-3">
              {visibleItems.slice(0, 3).map((item, index) => (
                <Link
                  href={contentHref(item)}
                  key={item.id}
                  className="xy-home-source-panel flex min-h-[105px] items-center gap-4 px-4 py-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#17295a] text-sm text-white">
                    {item.authorName?.slice(0, 1) || "星"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <small className="text-[#747d90]">
                      {item.authorName || "作者信息暂未提供"} · {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("zh-CN") : "更新时间暂未提供"}
                    </small>
                    <strong className="mt-1 block truncate text-base">
                      {item.title}
                    </strong>
                    <span className="mt-1 block line-clamp-1 text-sm text-[#7c8495]">
                      {item.summary}
                    </span>
                  </span>
                  {index === 0 ? (
                    <div className="hidden h-20 w-48 rounded-lg bg-[linear-gradient(135deg,#304a75,#a77b56)] lg:block" />
                  ) : null}
                  <span className="hidden shrink-0 text-sm text-[#7c8495] sm:block">
                    互动数据暂未提供　
                    <Bookmark className="ml-3 inline h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无相关内容"
              description="该话题下还没有可展示的公开内容"
              actionLabel="去发现"
              actionHref="/discover"
            />
          )}
        </section>

        {creatorItems.length ? (
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold">优质创作者</h2>
              <Link href="/search?type=USER" className="text-sm text-[#667087]">
                查看全部 ›
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {creatorItems.slice(0, 5).map((creator, index) => (
                <article key={creator.username} className="xy-home-source-panel flex items-center gap-3 px-3 py-2">
                  <Link href={`/users/${creator.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full ${index % 2 ? "bg-[#6e75bb]" : "bg-[#17295a]"} text-sm text-white`}
                  >
                    {(creator.displayName || creator.username).slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {creator.displayName || creator.username}
                    </strong>
                    <small className="text-[#8890a1]">
                      {creator.contentCount} 篇内容
                    </small>
                  </span>
                  </Link>
                  <FollowButton username={creator.username} compact />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

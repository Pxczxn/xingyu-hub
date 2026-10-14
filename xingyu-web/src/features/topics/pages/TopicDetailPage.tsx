import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { topicsApi } from "@/api/topics/topics.api";
import { useAuth } from "@/features/auth/auth.store";
import type {
  TopicContentSort,
  TopicCreatorSummary,
  TopicSummary,
} from "@/api/topics/topics.types";
import type { ContentSummary } from "@/api/common.types";
import { PageState } from "@/components/shared/PageState";
import type { SectionStatus } from "@/components/shared/SectionState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";
import { TopicHeader } from "@/features/topics/components/TopicHeader";
import { TopicContentItem } from "@/features/topics/components/TopicContentItem";
import { TopicCreatorsPanel } from "@/features/topics/components/TopicCreatorsPanel";

/*
 * Topic detail (Phase 1A).
 * Real endpoints: GET /api/v1/topics/{slug}, /content, /creators.
 *
 * Follow (2026-10-10 P0-A): POST/DELETE /api/v1/follows/topics/{id} were fixed
 * backend-side (SocialService previously required status=ENABLED while topics
 * are created ACTIVE, so every follow 404'd), and GET /topics/{slug} now runs
 * through the auth interceptor so `following` is populated for signed-in
 * viewers (null for guests). The follow control is rendered again, with the
 * same optimistic-update / duplicate-guard / rollback discipline as the
 * article interaction bar.
 *
 * 2026-10-13 (批次 04) — 按设计方案 §3.3 重排：P0 是「该话题下的讨论内容」，
 * 于是页面读作 身份头(P1) → 排序条(P1) + 内容列表(P0) ｜ 创作者(P2)。
 *
 * 三处改动，都指向同一件事——把内容从「卡片里的东西」变回页面本身：
 *
 *   1. 内容列表不再被一张 `bg-card/70` 半透明卡片包住。半透明的底会把 P0 压成
 *      一个附属区块，卡片边框又暗示「这是一整块可以操作的东西」，而它不是。
 *      现在列表直接铺在页面上，行与行之间靠自身的分隔线，与星系内容列表同构。
 *   2. 排序条的下划线改成 `::after` + `scale-x` 过渡：切换「最新 / 热门」时金色
 *      标记从中间展开，而不是颜色瞬间跳变。容器不加下内边距、按钮 `pb-2.5` 配
 *      `after:-bottom-px`，金线正好压住容器的灰线。
 *   3. 列表行错峰入场（`animate-rise-in` + `staggerDelay`），创作者侧栏同帧浮起。
 *
 * 身份头保持轻量（~120px：名称、简介、计数、关注），因为它承载的是 P1 的「话题
 * 身份」。话题没有成员体系、没有跨页 tab、也没有「加入」概念——把它做厚只会挤掉
 * 真正的 P0。它的 sticky 是既有决定，理由写在 TopicHeader 里：话题名与计数是列表
 * 每一行的上下文，滚走之后读者就不知道自己在读什么。
 */
export function TopicDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();

  const [topic, setTopic] = useState<TopicSummary | null>(null);
  const [content, setContent] = useState<ContentSummary[]>([]);
  const [sort, setSort] = useState<TopicContentSort>("latest");
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followPending, setFollowPending] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [contentStatus, setContentStatus] = useState<SectionStatus>("loading");
  const [creators, setCreators] = useState<TopicCreatorSummary[]>([]);
  const [creatorsStatus, setCreatorsStatus] = useState<SectionStatus>("loading");
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branches below. The effects keep their per-run `active` guards. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    topicsApi
      .getTopic(slug)
      .then((data) => {
        if (!active) return;
        setTopic(data);
        setFollowing(typeof data.following === "boolean" ? data.following : null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setContentStatus("loading");
    topicsApi
      .getTopicContent(slug, sort, 12)
      .then((data) => {
        if (!active) return;
        setContent(data);
        setContentStatus(data.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!active) return;
        setContent([]);
        setContentStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug, sort, topic?.id, reloadKey]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setCreatorsStatus("loading");
    Promise.resolve(topicsApi.getTopicCreators(slug, 8))
      .then((data) => {
        if (!active) return;
        const next = data ?? [];
        setCreators(next);
        setCreatorsStatus(next.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (active) setCreatorsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  async function toggleFollow() {
    if (!topic || followPending || following === null) return; // duplicate-click guard
    const next = !following;
    // Optimistic update, rolled back if the request fails.
    setFollowing(next);
    setTopic((t) =>
      t ? { ...t, followerCount: Math.max(0, (t.followerCount ?? 0) + (next ? 1 : -1)) } : t,
    );
    setFollowPending(true);
    try {
      if (next) await topicsApi.followTopic(topic.id);
      else await topicsApi.unfollowTopic(topic.id);
    } catch {
      setFollowing(!next);
      setTopic((t) =>
        t ? { ...t, followerCount: Math.max(0, (t.followerCount ?? 0) + (next ? -1 : 1)) } : t,
      );
    } finally {
      setFollowPending(false);
    }
  }

  if (loading) return <PageState kind="loading" />;
  if (error) {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }
  if (!topic) return <PageState kind="empty" />;

  return (
    <div className="section-gap gap-5">
      <TopicHeader
        topic={topic}
        isAuthenticated={isAuthenticated}
        following={following}
        followPending={followPending}
        onToggleFollow={toggleFollow}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          {/*
            排序条。容器不带下内边距：按钮用 `pb-2.5` 自己撑开，于是按钮盒底正好
            落在容器的下边框上，`after:-bottom-px` 的金线因此压住灰线而不是悬在
            它上方（星系 tab 的容器多了一层 `pb-2`，金线悬空 8px——那是待修的小
            瑕疵，不在这批范围内）。
            `aria-pressed` 让「当前按哪个排」对辅助技术可读；视觉上由金线表达。
          */}
          <div
            className="flex items-center gap-5 border-b border-border/70"
            role="group"
            aria-label="内容排序"
          >
            {(["latest", "hot"] as TopicContentSort[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  "focus-ring relative rounded-none px-1 pb-2.5 text-sm transition-colors",
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:bg-accent after:transition-transform",
                  sort === key
                    ? "font-medium text-primary after:scale-x-100"
                    : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                )}
              >
                {key === "latest" ? "最新" : "热门"}
              </button>
            ))}
          </div>

          {/*
            内容列表（P0）直接铺在页面上。状态块同样去掉边框与底色——空话题不需要
            一张占位卡片来撑版面（设计方案 §六 第 4 条），它需要的是把话说清楚。
          */}
          <section data-testid="topic-content">
            {contentStatus === "loading" ? (
              <PageState kind="loading" className="border-0 bg-transparent py-6" />
            ) : null}
            {contentStatus === "error" ? (
              <>
                <PageState kind="error" className="border-0 bg-transparent py-6" />
                <div className="text-center pb-6">
                  <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                    重新加载
                  </Button>
                </div>
              </>
            ) : null}
            {contentStatus === "empty" ? (
              <PageState kind="empty" className="border-0 bg-transparent py-6" />
            ) : null}
            {contentStatus === "ready" ? (
              <div>
                {content.map((item, index) => (
                  <TopicContentItem
                    key={item.id}
                    item={item}
                    className="animate-rise-in"
                    /* Inline, not a class: `animate-rise-in` is the `animation`
                       shorthand and resets `animation-delay` (see lib/stagger.ts). */
                    style={{ animationDelay: staggerDelay(index) }}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </main>

        {creatorsStatus === "ready" ? <TopicCreatorsPanel creators={creators} /> : null}
      </div>
    </div>
  );
}

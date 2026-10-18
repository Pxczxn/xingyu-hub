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

/** 一页的行数。和后端 `limit` 默认值一致，改动时两边要一起看。 */
const PAGE_SIZE = 12;

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
 *   2. 排序条的下划线改成 `::after` + `scale-x` 过渡：切换「最近更新 / 热门」时金色
 *      标记从中间展开，而不是颜色瞬间跳变。容器不加下内边距、按钮 `pb-2.5` 配
 *      `after:-bottom-px`，金线正好压住容器的灰线。
 *   3. 列表行错峰入场（`animate-rise-in` + `staggerDelay`），创作者侧栏同帧浮起。
 *
 * 2026-10-17 — 内容可达性。列表原来固定 12 条且没有出口：一个有 50 篇文章的话题
 * 只能读到 12 篇。现在按页递增（每次 +12），并在确实还有内容时给出带真实差额的
 * 「加载更多」。总数直接用 `topic.contentCount`（与行查询同源），所以不需要后端
 * 新增 total 字段。同一批还改了两处表述与重量：排序标签「最新」→「最近更新」
 * （底层是 indexed_at，不是发布时间），卡片去掉阴影、内边距收紧，与首页 Feed 的
 * 轻量语言对齐。
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

  /*
   * 分页游标。
   *
   * 后端 `GET /topics/{slug}/content` 只有 `limit`、没有 offset/cursor，所以「加载
   * 更多」只能靠逐步放大 limit 再整体重取。这不是理想实现（会重复下载已读行），
   * 但它让话题内容真正可达 —— 在此之前，一个有 50 篇文章的话题永远只显示 12 篇，
   * 没有任何出口。等后端补上 offset 后，这里应当改成增量追加。
   *
   * 状态刻意做成「按 slug|sort 归属」的对象，而不是一个裸数字：切换话题或排序时，
   * 派生出来的 limit 必须在同一次渲染里就回到第一页。裸数字 + 重置 effect 会先用
   * 旧的 limit 取一次新话题，再用新 limit 取第二次 —— 一次多余的请求和一个会闪的
   * 列表。
   */
  const [paging, setPaging] = useState<{ key: string; limit: number }>({
    key: "",
    limit: PAGE_SIZE,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [contentStatus, setContentStatus] = useState<SectionStatus>("loading");
  const [creators, setCreators] = useState<TopicCreatorSummary[]>([]);
  const [creatorsStatus, setCreatorsStatus] = useState<SectionStatus>("loading");
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branches below. The effects keep their per-run `active` guards. */
  const [reloadKey, setReloadKey] = useState(0);

  const pagingKey = `${slug}|${sort}`;
  /** Reset to page one the moment the route or the sort changes. */
  const limit = paging.key === pagingKey ? paging.limit : PAGE_SIZE;

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
    /*
     * 首屏才接管整页的加载态；「加载更多」不能把已经在读的列表清空 —— 那样每翻
     * 一页读者都会失去当前位置。后续页只禁用按钮。
     */
    if (limit === PAGE_SIZE) setContentStatus("loading");
    topicsApi
      .getTopicContent(slug, sort, limit)
      .then((data) => {
        if (!active) return;
        setContent(data);
        setContentStatus(data.length > 0 ? "ready" : "empty");
        setLoadingMore(false);
      })
      .catch(() => {
        if (!active) return;
        setContent([]);
        setContentStatus("error");
        setLoadingMore(false);
      });
    return () => {
      active = false;
    };
  }, [slug, sort, limit, topic?.id, reloadKey]);

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

  /*
   * 是否还有下一页。
   *
   * `topic.contentCount` 来自 `countPublicContent`，和 `listContent` 的 WHERE 完全
   * 同源（PUBLISHED + 未下架的 ARTICLE），所以它就是真实总数，可以直接比较 ——
   * 不需要额外的 total 字段。总数缺失时退回「这一页取满了」的保守判断：最多多给
   * 一次没有新内容的点击，不会提前截断内容。
   */
  const contentTotal = topic.contentCount;
  const remaining =
    typeof contentTotal === "number" ? Math.max(0, contentTotal - content.length) : undefined;
  const hasMore =
    contentStatus === "ready" &&
    content.length > 0 &&
    (typeof contentTotal === "number" ? content.length < contentTotal : content.length >= limit);

  function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setPaging({ key: pagingKey, limit: limit + PAGE_SIZE });
  }

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
                {/*
                  「最近更新」，不是「最新」。
                  这个排序在 SQL 里是 `ORDER BY sd.indexed_at DESC`，而 indexed_at 是
                  索引写入时间 —— 文章被重新索引（编辑、治理、重建索引）就会前移。它
                  不是发布时间，所以标签不能声称「最新」（同一个判断写在 HomeFeedItem
                  和 TopicContentItem 的注释里：不把 indexed_at 当内容时间展示）。
                  「最近更新」既准确，也仍然是读者想要的那个顺序。
                */}
                {key === "latest" ? "最近更新" : "热门"}
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

            {/*
              「加载更多」是这页唯一的内容出口。在此之前，一个有 50 篇文章的话题
              永远停在 12 篇，读者拿不到剩下的 38 篇 —— 这是功能缺陷，不是排版问题。

              只在确实还有内容时出现：总数取自 `topic.contentCount`，所以「还有 N 篇」
              是真话，不是估计。按钮下方的分隔线补上列表最后一行没有的那条线
              （`TopicContentItem` 的 `last:border-0`）。
            */}
            {hasMore ? (
              <div className="flex justify-center border-t border-border/50 py-5">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore
                    ? "加载中…"
                    : remaining && remaining > 0
                      ? `加载更多（还有 ${remaining} 篇）`
                      : "加载更多"}
                </Button>
              </div>
            ) : null}
          </section>
        </main>

        {creatorsStatus === "ready" ? <TopicCreatorsPanel creators={creators} /> : null}
      </div>
    </div>
  );
}

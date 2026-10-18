import { useEffect, useMemo, useState } from "react";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { staggerDelay } from "@/lib/stagger";
import {
  DISCOVERY_LIMIT,
  TopicDiscoverySection,
} from "@/features/topics/components/TopicDiscoverySection";
import { TopicCard } from "@/features/topics/components/TopicCard";
import { SearchField } from "@/components/shared/SearchField";

type FollowEntry = {
  following: boolean;
  pending: boolean;
  /** Optimistically adjusted, rolled back with the flag. */
  followerCount: number;
};

/*
 * Topics plaza.
 * Real endpoint: GET /api/v1/topics.
 *
 * 当前信息层级（2026-10-17）：
 *   第一层 页头（P3，无横幅）
 *   第二层 发现区：热门话题（contentCount 降序）｜ 最近活跃（lastPublishedAt 降序）
 *   第三层 全部话题：标题 + 数量 + 搜索框，卡片网格（P0）
 *
 * 历史（保留原因，不保留已删除的结构）：
 *   2026-10-13 — 搜索离开页头横幅卡成为独立筛选条；卡片从分隔线列表改成网格；
 *                 关注按钮回到卡片右下角（关注端点 404 已于 2026-10-10 后端修复）。
 *   2026-10-17 — 发现区拆成「热门话题 + 最近活跃」双模块；搜索搬到「全部话题」标题行。
 *
 * 两处改动值得记下来：
 *
 *   1. 发现区不再复用 `TopicCard`。卡片网格是这页的主体，发现区如果长得一样，读者
 *      分不清哪块是目录、哪块是入口。现在它是紧凑列表：一行一个话题，名称 + 一条
 *      有依据的辅助信息（内容数 / 真实发布时间）。
 *   2. 搜索从独立的 sticky 筛选条搬到它真正作用的那一节的标题行。原先那条「筛选带」
 *      在页面顶部独立成块，离开列表很远；现在它在「全部话题」标题旁边，过滤结果数也
 *      就在同一行。搜索语义没变（名称 / 简介 / slug 客户端匹配）。
 *
 * 页尾的「如何开始？」引导已移除：那是指南（/guide → 快速上手）的内容，而广场读者是
 * 来找话题的。它留在页尾既读不到，又和发现区重复了同一句「从这里开始」。
 *
 * 页头本身没有数据要展示，也没有本页独有的动作——「关注」分散在每张卡片上——
 * 所以它保持最轻：只有 eyebrow、标题和一句话。
 */
export function TopicsPage() {
  const { isAuthenticated } = useAuth();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [followState, setFollowState] = useState<Record<string, FollowEntry>>({});
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    topicsApi
      .getTopics()
      .then((data) => {
        if (!active) return;
        setTopics(data);
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
  }, [reloadKey]);

  /*
   * Seed the follow map from the server's `following` flag once the list lands.
   * The `!(topic.id in next)` guard matters: this effect re-runs whenever `topics`
   * or the session changes, and without it a re-run would overwrite a follow the
   * reader just toggled with the stale value the list was fetched with.
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    setFollowState((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const topic of topics) {
        if (typeof topic.following === "boolean" && !(topic.id in next)) {
          next[topic.id] = {
            following: topic.following,
            pending: false,
            followerCount: topic.followerCount ?? 0,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [topics, isAuthenticated]);

  /*
   * Same optimistic-update / duplicate-guard / rollback discipline as the detail
   * header: the button flips and the count moves immediately, and a failed request
   * restores both.
   *
   * Two rules keep the count honest, and both were learned the hard way here:
   *
   *   - The new count is computed ONCE, from the pre-click value, and written
   *     verbatim on both passes. Deriving it inside the setter would make the
   *     settled pass add the +1 a second time.
   *   - A failure restores the snapshot instead of applying the inverse. `+1`
   *     followed by `-1` reads as if it should cancel out, but it only does so when
   *     both are measured against the same base — and the base moves the moment the
   *     first write lands, so the inverse lands on a count the reader never saw.
   *     The pre-click entry is the only value we know to be correct, so that is what
   *     we put back.
   *
   * The `pending` guard is what makes the pre-click snapshot safe to trust: with one
   * request in flight per topic, nothing else can have moved the entry in between.
   */
  async function toggleFollow(topic: TopicSummary) {
    const entry = followState[topic.id];
    if (!entry || entry.pending) return; // duplicate-click guard
    const next = !entry.following;
    const optimisticCount = Math.max(0, entry.followerCount + (next ? 1 : -1));
    const write = (following: boolean, pending: boolean, followerCount: number) =>
      setFollowState((prev) => ({
        ...prev,
        [topic.id]: { following, pending, followerCount },
      }));

    write(next, true, optimisticCount);
    try {
      if (next) await topicsApi.followTopic(topic.id);
      else await topicsApi.unfollowTopic(topic.id);
      write(next, false, optimisticCount);
    } catch {
      write(entry.following, false, entry.followerCount);
    }
  }

  const visible = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return topics;
    return topics.filter((topic) =>
      `${topic.name} ${topic.description ?? ""} ${topic.slug}`.toLowerCase().includes(text),
    );
  }, [topics, keyword]);

  const featured = useMemo(() => {
    /*
     * 热门话题：按公开内容数降序。名次/顺序是这一组的真实属性，所以并列时用服务端
     * 返回顺序（slug 升序）做 tie-break —— 结果稳定，刷新不会跳动。
     */
    const ranked = topics
      .map((topic, index) => ({ topic, index }))
      .filter(({ topic }) => (topic.contentCount ?? 0) > 0)
      .sort(
        (a, b) => (b.topic.contentCount ?? 0) - (a.topic.contentCount ?? 0) || a.index - b.index,
      );
    const hot = ranked.slice(0, DISCOVERY_LIMIT).map(({ topic }) => topic);

    /*
     * 最近活跃：按 `lastPublishedAt`（published_revision.published_at）降序。
     * 字段缺失或不可解析的话题直接排除 —— 宁可不展示，也不拿索引时间或创建时间冒充。
     */
    const timed = topics
      .map((topic, index) => ({ topic, index, at: Date.parse(topic.lastPublishedAt ?? "") }))
      .filter(({ at }) => Number.isFinite(at))
      .sort((a, b) => b.at - a.at || a.index - b.index);

    /*
     * 先按时间取全部候选，再去掉已经出现在热门里的话题，最后截前 4。
     *
     * 顺序不能反：先截 4 再去重，热门占掉的那几条会白白吃掉名额，于是一个内容不少的
     * 社区可能只剩 1 条「最近活跃」——这不是数据不足，是取数顺序浪费了候选。
     *
     * 去重之后不足 4 条时，用「比已选最后一条更旧的热门话题」补齐。这样既尽量不和热门
     * 重复，又始终保持严格的时间倒序——补进来的那条本来就比前面的更旧，所以它出现在
     * 末尾是排序的事实，不是为了让列表变长而挪位置。
     */
    const timedTopics = timed.map(({ topic }) => topic);
    const hotIds = new Set(hot.map((topic) => topic.id));
    const lastTime = (topic: TopicSummary) => Date.parse(topic.lastPublishedAt ?? "");
    const recent: TopicSummary[] = timedTopics
      .filter((topic) => !hotIds.has(topic.id))
      .slice(0, DISCOVERY_LIMIT);

    if (recent.length < DISCOVERY_LIMIT) {
      const oldestSelected = recent.length > 0 ? lastTime(recent[recent.length - 1]) : Infinity;
      const fillers = timedTopics.filter(
        (topic) => hotIds.has(topic.id) && lastTime(topic) <= oldestSelected,
      );
      recent.push(...fillers.slice(0, DISCOVERY_LIMIT - recent.length));
    }

    return { hot, recent };
  }, [topics]);

  const searching = keyword.trim().length > 0;

  return (
    <div className="section-gap">
      {/*
       * 批次 08 改进：话题广场改用 PageMasthead（无表面开头）。
       * 页头是 P3（eyebrow、标题和一句话），筛选条是 P1（sticky），话题网格是 P0。
       * 无需 banner 包装——读者来这里是为了找话题，不是被"卖"一个概念。
       */}
      <PageMasthead
        eyebrow="TOPICS"
        title="话题广场"
        description="从感兴趣的话题出发，找到正在发生的讨论，并持续关注它们。"
      />

      {/*
        话题发现区（第二层）：热门话题 + 最近活跃，1:1 两列。
        搜索时整块让位，让过滤结果成为唯一焦点。
      */}
      {!searching && !loading && !error ? (
        <TopicDiscoverySection hot={featured.hot} recent={featured.recent} />
      ) : null}

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        <>
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}
      {!loading && !error && topics.length === 0 ? <PageState kind="empty" /> : null}

      {!loading && !error && topics.length > 0 ? (
        <>
          <PageSection
            id="all-topics"
            title={searching ? "搜索结果" : "全部话题"}
            count={visible.length}
            action={
              <SearchField
                value={keyword}
                onChange={setKeyword}
                ariaLabel="搜索话题"
                placeholder="搜索话题名称或简介"
              />
            }
            /*
              `w-full` on a phone so the field wraps onto its own line under the
              title; `sm:w-auto` lets it sit at the trailing edge on desktop.
            */
            actionClassName="w-full sm:w-auto"
          >
            {visible.length > 0 ? (
              <ul
                className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="topic-list"
              >
                {visible.map((topic, index) => {
                  const entry = followState[topic.id];
                  return (
                    <TopicCard
                      key={topic.id}
                      /*
                       * The optimistic count lives in `followState`, so the topic
                       * handed to the card carries the ADJUSTED value — the card
                       * renders facts, it does not own them. Without this merge the
                       * toggle would flip the button while the number stayed put,
                       * which is the one thing an optimistic update must not do.
                       */
                      topic={entry ? { ...topic, followerCount: entry.followerCount } : topic}
                      /*
                       * `entry` absent means the state is unknown — a guest, or a
                       * list fetched without a viewer. `following={null}` is what
                       * makes the card render no control at all, rather than a
                       * button whose first click would have to guess.
                       */
                      following={entry?.following ?? null}
                      followPending={entry?.pending ?? false}
                      onToggleFollow={entry ? () => void toggleFollow(topic) : undefined}
                      className="animate-rise-in"
                      /* Inline, not a class: `animate-rise-in` is the `animation`
                         shorthand and resets `animation-delay` (see lib/stagger.ts). */
                      style={{ animationDelay: staggerDelay(index) }}
                    />
                  );
                })}
              </ul>
            ) : (
              <div
                role="status"
                className="rounded-lg border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground"
              >
                没有找到匹配的话题
              </div>
            )}
          </PageSection>
        </>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Star } from "lucide-react";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { staggerDelay } from "@/lib/stagger";
import { FeaturedTopics } from "@/features/topics/components/FeaturedTopics";
import { TopicCard } from "@/features/topics/components/TopicCard";
import { TopicsFilterBar } from "@/features/topics/components/TopicsFilterBar";

/** 页尾引导（P3）：两个动作，不承诺任何本页无法验证的后续效果。 */
const TOPIC_STEPS = [
  { title: "浏览话题", icon: Search },
  { title: "关注感兴趣的方向", icon: Star },
] as const;

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
 * 2026-10-13 (批次 04) — 按设计方案 §3.3 重排为四层：
 * 页头(P3) → 筛选条(P1, sticky) → 话题网格(P0) → 引导说明(P3)。
 *
 * 三处与旧版不同：
 *
 *   1. 搜索从页头里搬出来，成为独立的 P1 筛选条并 sticky 在 shell header 之下。
 *      它原本和标题共用一张横幅卡，于是「过滤整个列表」这个动作读起来像标题的
 *      附属说明；移出后它有了自己的宽度，滚动时也一直可用（方案点名 sticky）。
 *      筛选条本体是 components/TopicsFilterBar.tsx，理由写在那里。
 *   2. 卡片网格从「分隔线列表行」改成真正的卡片网格（见 TopicCard），间距也从
 *      分隔线布局的 `gap-y-1` 换成卡片网格的 `gap-3`。入场用 staggerDelay 错峰。
 *   3. 关注按钮回到卡片右下角。旧注释记的「关注端点 404」已于 2026-10-10 修复
 *      （SocialService 曾硬编码 status=ENABLED，而话题状态是 ACTIVE），后端有
 *      TopicFollowIntegrationTest 钉死闭环，CommunityAuthInterceptor 也对
 *      `/api/v1/topics` 整段走可选认证，因此列表端点会带上 viewer 的 following。
 *      关注状态集中在本页持有，卡片只负责渲染。
 *   4. 页尾补回一行「如何开始？」引导（P3），与星系广场同构。它不在搜索态出现。
 *
 * 页头本身没有数据要展示，也没有本页独有的动作——「关注」分散在每张卡片上——
 * 所以它保持最轻：只有 eyebrow、标题和一句话。方案 §3.3 把页头定级为 P3，
 * 这里不额外加东西就是执行这个定级。
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

  const featuredTopics = useMemo(
    () =>
      topics
        .filter((topic) => (topic.contentCount ?? 0) > 0)
        .map((topic, index) => ({ topic, index }))
        .sort(
          (a, b) => (b.topic.contentCount ?? 0) - (a.topic.contentCount ?? 0) || a.index - b.index,
        )
        .slice(0, 6)
        .map(({ topic }) => topic),
    [topics],
  );

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

      {/* P1 筛选：全页过滤器，作用于下面的热门入口与话题网格。 */}
      <TopicsFilterBar keyword={keyword} onKeywordChange={setKeyword} />

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
          {!searching ? <FeaturedTopics topics={featuredTopics} /> : null}

          <PageSection
            id="all-topics"
            title={searching ? "搜索结果" : "全部话题"}
            count={visible.length}
          >
            {visible.length > 0 ? (
              <ul
                className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3"
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

          {/*
            页尾引导（P3）。和星系广场同一个结构、同一个位置：读者是来找话题的，
            这段只给还没找到方向的人一句话。搜索时它整块让位——已经会搜的人不需要
            再被教一遍「怎么开始」，而且搜索结果是短页面，页尾多一块反而抢眼。
          */}
          {!searching ? (
            <section aria-labelledby="about-topics" className="border-t border-border/70 pt-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <h2 id="about-topics" className="text-card font-semibold text-primary">
                  如何开始？
                </h2>
                <ol className="flex list-none flex-wrap items-center gap-x-2 gap-y-1.5 p-0 text-meta text-muted-foreground">
                  {TOPIC_STEPS.map(({ title, icon: Icon }, index) => (
                    <li key={title} className="flex items-center gap-2">
                      {index > 0 ? (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" aria-hidden />
                      ) : null}
                      <Icon
                        className="h-3.5 w-3.5 text-muted-foreground/70"
                        strokeWidth={1.7}
                        aria-hidden
                      />
                      <span>{title}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="mt-2.5 text-meta text-muted-foreground">
                话题按讨论方向聚合内容；星系则围绕长期参与其中的人与内容。
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { usersApi } from "@/api/users/users.api";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatorCardItem } from "../components/CreatorCardItem";
import {
  CREATOR_CARD_LIMIT,
  CREATOR_PER_TOPIC_LIMIT,
  filterCreators,
  mergeCreatorRows,
  type CreatorCard,
} from "../creator-card";

/*
 * /creators — 发现创作者 (Phase 2K-1)
 *
 * This is a PURE FRONT-END AGGREGATION page: there is no `/creators` backend
 * endpoint. Legacy built the same thing, and V2 reuses the already-migrated
 * topics/users APIs — so this phase adds zero backend surface.
 *
 * Fan-out shape (matching Legacy, with the failure rules made explicit):
 *   1. GET /topics                       → use the published topic list
 *   2. GET /topics/{slug}/creators       → per topic; a failing topic yields []
 *   3. GET /users/{username}             → decorative (avatar, following)
 *      GET /users/{username}/works       → decorative (latest public work)
 *
 * Honesty points:
 *  - Step 1 is REQUIRED: if it fails the page fails, because there is nothing
 *    to aggregate from. Steps 2-3 are best-effort.
 *  - The topic chips and the search box are CLIENT-SIDE over the creators we
 *    actually fanned out to. There is no server-side creator search, so the
 *    copy says "在本页收录的作者中搜索" rather than implying a global search.
 *  - Follow state changes ONLY after the request succeeds. Legacy flipped the
 *    button first and left it flipped on failure; V2 keeps the previous state
 *    and surfaces an error.
 */
export function CreatorsPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeTopic, setActiveTopic] = useState("ALL");
  const [query, setQuery] = useState("");
  const [followError, setFollowError] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);

    topicsApi
      .getTopics()
      .then(async (allTopics) => {
        if (!active) return;
        const selected = allTopics;

        // Per-topic failures degrade to an empty list rather than failing the page.
        const perTopic = await Promise.all(
          selected.map(async (topic) => ({
            topic,
            creators: await topicsApi
              .getTopicCreators(topic.slug, CREATOR_PER_TOPIC_LIMIT)
              .catch(() => []),
          })),
        );
        if (!active) return;

        const merged = mergeCreatorRows(perTopic).slice(0, CREATOR_CARD_LIMIT);

        // Enrichment is decorative: a failure leaves profile null / work null.
        const enriched = await Promise.all(
          merged.map(async (creator): Promise<CreatorCard> => {
            const [profile, works] = await Promise.all([
              usersApi.getProfile(creator.username).catch(() => null),
              usersApi
                .getUserWorks(creator.username)
                .then((data) => data.works)
                .catch(() => []),
            ]);
            return { ...creator, profile, latestWork: works[0] ?? null };
          }),
        );
        if (!active) return;

        setTopics(selected);
        setCreators(enriched);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const toggleFollow = useCallback(async (creator: CreatorCard) => {
    const wasFollowing = creator.profile?.following === true;
    setFollowError(null);
    setPendingUsername(creator.username);
    try {
      if (wasFollowing) {
        await usersApi.unfollowUser(creator.username);
      } else {
        await usersApi.followUser(creator.username);
      }
      // Only now flip the state — the request is what makes it true.
      setCreators((rows) =>
        rows.map((row) =>
          row.username === creator.username && row.profile
            ? { ...row, profile: { ...row.profile, following: !wasFollowing } }
            : row,
        ),
      );
    } catch {
      setFollowError("关注操作未完成，请确认登录状态后重试。");
    } finally {
      setPendingUsername(null);
    }
  }, []);

  const visible = useMemo(
    () => filterCreators(creators, activeTopic, query),
    [creators, activeTopic, query],
  );

  const hasAnyTopic = topics.length > 0;

  /*
   * SK2 画廊 · H 幅 / D 松 / R 错（A §3 里 Creators 这一行）。
   *
   * 骨架、页头、密度、侧轨全部来自共享层，页面只声明自己的身份，不再手写栅格：
   *
   *   skeleton="SK2"   → 画廊原型：无卡面的发现带 + 等权卡格、卡即链接。传了 `rail`
   *                      时是 `[1fr | 320]` 的主列 + 侧轨（这就是 R=错），没传就退回
   *                      单列（见下方 rail 的三态门）。
   *   header="banner"  → H=幅：`PageHero` 有面横幅，自带本页唯一的 h1（原来手写的
   *                      `eyebrow + text-2xl` 两行标题收敛掉）。`motif-orbit` 是
   *                      B §6 的几何母题，与 /announcements 同一处用法（一页 ≤1 种）。
   *   density="loose"  → D=松：卡格间距与卡内 padding 都走 `--density-*` 变量，
   *                      所以「松」只有一处定义。
   *   R=错             → 右轨（下方 `CreatorsRail`）只放两类**由本页已有数据派生**的
   *                      真实信息；本页是纯前端聚合（见文件顶部注释），右轨**不新增
   *                      任何请求**。加载中 / 失败 / 一个专题都没有时不挂右轨 ——
   *                      派生不出数字就留空，不硬编占位数据。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <PageHero
          eyebrow="CREATORS"
          title="探索创作者"
          description="从社区专题中探索持续创作的人。"
          className="motif-orbit"
        />
      }
      rail={
        !loading && !failed && hasAnyTopic ? (
          <CreatorsRail
            topics={topics}
            creators={creators}
            visibleCount={visible.length}
            activeTopic={activeTopic}
            query={query}
          />
        ) : null
      }
      railLabel="收录与筛选说明"
    >
      {followError ? (
        <p
          role="alert"
          className="rounded-control border border-destructive/40 bg-card p-3 text-meta text-destructive"
        >
          {followError}
        </p>
      ) : null}

      {loading ? <PageState kind="loading" /> : null}
      {!loading && failed ? (
        <>
          <PageState kind="error" title="作者列表加载失败" description="请稍后重试。" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : null}

      {!loading && !failed && !hasAnyTopic ? (
        <PageState kind="empty" title="暂无专题" description="社区还没有可用于探索创作者的专题。" />
      ) : null}

      {!loading && !failed && hasAnyTopic ? (
        <>
          {/*
            发现带：专题 chip 在左、关键词搜索在右，共用一条发丝线（B §7 R1 的分区边界）。
            两者都是**纯客户端**的（见文件顶部 honesty points）。原来这段说明文字的
            位置在卡格之上、筛选之下；它说的是「这个筛选管到哪儿」，属于筛选条的一部分，
            所以搬进了右轨的「收录范围」块（同一句文案、同一个 `creators-scope-note`）。
          */}
          <nav
            aria-label="按专题筛选作者"
            className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-4"
          >
            <Button
              type="button"
              size="sm"
              variant={activeTopic === "ALL" ? "default" : "outline"}
              onClick={() => setActiveTopic("ALL")}
            >
              全部
            </Button>
            {topics.map((topic) => (
              <Button
                key={topic.id}
                type="button"
                size="sm"
                variant={activeTopic === topic.name ? "default" : "outline"}
                onClick={() => setActiveTopic(topic.name)}
              >
                {topic.name}
              </Button>
            ))}
            <label className="ml-auto min-w-48">
              <span className="sr-only">搜索作者</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="在本页收录的作者中搜索"
              />
            </label>
          </nav>

          {visible.length === 0 ? (
            /*
             * Two very different empty states, deliberately not merged:
             *
             *  - `creators.length === 0` means NO topic produced any creator.
             *    `listCreators` reads from `article_topic` joined to published
             *    articles, so this is not a filter problem — the published topics
             *    simply have no published articles yet.
             *    Saying 「调整专题或关键词后再试」 here would be a lie.
             *  - otherwise the user's own filter/search excluded everything.
             */
            creators.length === 0 ? (
              <PageState
                kind="empty"
                title="暂无可推荐的作者"
                description="已收录的专题下暂时还没有已发布的内容，因此无法据此探索作者。"
              />
            ) : (
              <PageState kind="empty" title="暂无匹配作者" description="调整专题或关键词后再试。" />
            )
          ) : (
            <ul
              aria-label="创作者列表"
              className="grid list-none grid-cols-1 gap-[var(--density-grid-gap)] p-0 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((creator) => (
                <li key={creator.username} className="max-w-[360px]">
                  <CreatorCardItem
                    creator={creator}
                    onToggleFollow={(target) => void toggleFollow(target)}
                    followPending={pendingUsername === creator.username}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </ArchetypeFrame>
  );
}

/*
 * 右轨（R=错）。两块信息全部由本页**已经取回**的 `topics` / `creators` 派生，
 * 没有任何新请求 —— 本页本来就没有 `/creators` 这种聚合端点（见文件顶部注释）。
 *
 * 为什么不放更多：创作者卡里已经有头像、专题、篇数、最新作品；右轨再复述一遍
 * 只会是同一份数据的第二个入口。这里只放卡片**放不下**的两件事：
 *   1. 收录范围 —— 「本页收录的是哪些专题下的作者、筛选不是全站搜索」这句限定，
 *      它必须一直可见（每加一个 chip 都在缩小范围）；
 *   2. 计数与分布 —— 当前筛选读作什么、收录了几位作者、各专题各收录几位。
 * 计数用的 `creator.topics` 已按 username 去重（`mergeCreatorRows`），所以同一位作者
 * 出现在两个专题下时，两个专题各 +1，但「收录作者」只算 1 —— 与卡格一致。
 */
function CreatorsRail({
  topics,
  creators,
  visibleCount,
  activeTopic,
  query,
}: {
  topics: TopicSummary[];
  creators: CreatorCard[];
  visibleCount: number;
  activeTopic: string;
  query: string;
}) {
  const topicRows = countCreatorsByTopic(creators);
  const keyword = query.trim();

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="creators-rail-scope"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="creators-rail-scope" className="text-h3 text-primary">
          收录范围
        </h2>
        <p data-testid="creators-scope-note" className="mt-3 text-meta text-muted-foreground">
          本页收录来自 {topics.length} 个专题的作者；筛选与搜索仅作用于已收录的作者，
          不是全站搜索。
        </p>
      </section>

      <section
        aria-labelledby="creators-rail-filter"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="creators-rail-filter" className="text-h3 text-primary">
          当前筛选
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">专题</dt>
            <dd className="min-w-0 truncate text-meta text-foreground-soft">
              {activeTopic === "ALL" ? "全部" : activeTopic}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">关键词</dt>
            <dd className="min-w-0 truncate text-meta text-foreground-soft">
              {keyword || "未使用"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">收录作者</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">
              {creators.length}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption text-muted-foreground">当前显示</dt>
            <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">{visibleCount}</dd>
          </div>
        </dl>
      </section>

      {topicRows.length > 0 ? (
        <section
          aria-labelledby="creators-rail-topics"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="creators-rail-topics" className="text-h3 text-primary">
            各专题收录
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {topicRows.map(([name, count]) => (
              <li key={name} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-meta text-foreground-soft">{name}</span>
                <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** 每个专题各收录了几位作者（多位在前，同数按名称定序，保证渲染顺序稳定）。 */
function countCreatorsByTopic(creators: CreatorCard[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const creator of creators) {
    for (const topic of creator.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"),
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { topicsApi } from "@/api/topics/topics.api";
import type { TopicSummary } from "@/api/topics/topics.types";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatorCardItem } from "../components/CreatorCardItem";
import {
  CREATOR_CARD_LIMIT,
  CREATOR_PER_TOPIC_LIMIT,
  CREATOR_TOPIC_LIMIT,
  filterCreators,
  mergeCreatorRows,
  type CreatorCard,
} from "../creator-card";

/*
 * /creators — 推荐作者 (Phase 2K-1)
 *
 * This is a PURE FRONT-END AGGREGATION page: there is no `/creators` backend
 * endpoint. Legacy built the same thing, and V2 reuses the already-migrated
 * topics/users APIs — so this phase adds zero backend surface.
 *
 * Fan-out shape (matching Legacy, with the failure rules made explicit):
 *   1. GET /topics                       → take the first CREATOR_TOPIC_LIMIT
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);

    topicsApi
      .getTopics()
      .then(async (allTopics) => {
        if (!active) return;
        const selected = allTopics.slice(0, CREATOR_TOPIC_LIMIT);

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
  }, []);

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

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">推荐作者</h1>
        <p className="text-sm text-muted-foreground">从社区专题中发现值得关注的创作者。</p>
      </header>

      {followError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {followError}
        </p>
      ) : null}

      {loading ? <PageState kind="loading" /> : null}
      {!loading && failed ? (
        <PageState kind="error" title="作者列表加载失败" description="请稍后重试。" />
      ) : null}

      {!loading && !failed && !hasAnyTopic ? (
        <PageState kind="empty" title="暂无专题" description="社区还没有可用于推荐作者的专题。" />
      ) : null}

      {!loading && !failed && hasAnyTopic ? (
        <>
          <nav aria-label="按专题筛选作者" className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeTopic === "ALL" ? "primary" : "outline"}
              onClick={() => setActiveTopic("ALL")}
            >
              全部
            </Button>
            {topics.map((topic) => (
              <Button
                key={topic.id}
                type="button"
                size="sm"
                variant={activeTopic === topic.name ? "primary" : "outline"}
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

          <p className="text-xs text-muted-foreground" data-testid="creators-scope-note">
            本页收录来自前 {topics.length} 个专题的作者；筛选与搜索仅作用于已收录的作者，
            不是全站搜索。
          </p>

          {visible.length === 0 ? (
            /*
             * Two very different empty states, deliberately not merged:
             *
             *  - `creators.length === 0` means NO topic produced any creator.
             *    `listCreators` reads from `article_topic` joined to published
             *    articles, so this is not a filter problem — the sampled topics
             *    simply have no published articles yet. Verified against the
             *    live backend 2026-09-27: all 8 sampled topics returned [].
             *    Saying 「调整专题或关键词后再试」 here would be a lie.
             *  - otherwise the user's own filter/search excluded everything.
             */
            creators.length === 0 ? (
              <PageState
                kind="empty"
                title="暂无可推荐的作者"
                description="已收录的专题下暂时还没有已发布的内容，因此无法据此推荐作者。"
              />
            ) : (
              <PageState kind="empty" title="暂无匹配作者" description="调整专题或关键词后再试。" />
            )
          ) : (
            <ul
              aria-label="推荐作者列表"
              className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visible.map((creator) => (
                <li key={creator.username}>
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
    </div>
  );
}

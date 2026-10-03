import { useCallback, useEffect, useState } from "react";
import { topicsApi } from "@/api/topics/topics.api";
import { usersApi } from "@/api/users/users.api";
import type { SectionStatus } from "@/components/shared/SectionState";
import { mergeCreatorRows } from "@/features/creators/creator-card";

/*
 * 推荐创作者 for the home rail.
 *
 * There is NO "recommended creators" endpoint — this is the same client-side
 * fan-out /creators performs, trimmed for a rail:
 *
 *   GET /topics                  → the first TOPIC_LIMIT topics
 *   GET /topics/{slug}/creators  → per topic; a failing topic yields []
 *   GET /users/{username}        → ONLY when signed in, for avatar + follow state
 *
 * The profile call is SKIPPED for guests on purpose. A guest cannot follow, so
 * the only thing those requests would add is an avatar, and that is not worth
 * N extra requests on the page they land on.
 *
 * Follow state flips ONLY after the request succeeds — the same rule /creators
 * follows. Flipping the button first and leaving it flipped on failure is a
 * Legacy bug this codebase already fixed once, and it must not come back here.
 *
 * Degradation matches the other rails: a failed topic fan-out is "error", a
 * fan-out that found nobody is "empty", and both are the panel's business to
 * hide rather than the page's to blank out.
 */

/** Topics to fan out to. The cost is 1 + N requests (plus N profiles when signed in). */
const TOPIC_LIMIT = 3;

/** Creators requested per topic. */
const PER_TOPIC_LIMIT = 4;

/** Creators shown in the rail. */
export const RECOMMENDED_CREATOR_LIMIT = 3;

export type RecommendedCreator = {
  username: string;
  displayName: string;
  contentCount: number;
  avatar?: string;
  /** False for guests, who cannot follow. */
  following: boolean;
};

export type RecommendedCreatorsState = {
  status: SectionStatus;
  creators: RecommendedCreator[];
  followError: string | null;
  pendingUsername: string | null;
  toggleFollow: (creator: RecommendedCreator) => void;
};

export function useRecommendedCreators(
  ready: boolean,
  signedIn: boolean,
): RecommendedCreatorsState {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [creators, setCreators] = useState<RecommendedCreator[]>([]);
  const [followError, setFollowError] = useState<string | null>(null);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setStatus("loading");
    setCreators([]);

    topicsApi
      .getTopics()
      .then(async (allTopics) => {
        if (!active) return;
        const selected = allTopics.slice(0, TOPIC_LIMIT);

        // A failing topic degrades to "no creators from that topic", not to a
        // failed rail — the same rule the /creators page uses.
        const perTopic = await Promise.all(
          selected.map(async (topic) => ({
            topic,
            creators: await topicsApi
              .getTopicCreators(topic.slug, PER_TOPIC_LIMIT)
              .catch(() => []),
          })),
        );
        if (!active) return;

        const merged = mergeCreatorRows(perTopic)
          .sort((left, right) => right.contentCount - left.contentCount)
          .slice(0, RECOMMENDED_CREATOR_LIMIT);
        if (merged.length === 0) {
          setStatus("empty");
          return;
        }

        const withProfile = await Promise.all(
          merged.map(async (creator): Promise<RecommendedCreator> => {
            const profile = signedIn
              ? await usersApi.getProfile(creator.username).catch(() => null)
              : null;
            return {
              username: creator.username,
              displayName: creator.displayName || profile?.displayName || creator.username,
              contentCount: creator.contentCount,
              avatar: profile?.avatar ?? undefined,
              following: profile?.following === true,
            };
          }),
        );
        if (!active) return;

        setCreators(withProfile);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [ready, signedIn]);

  const toggleFollow = useCallback(async (creator: RecommendedCreator) => {
    setFollowError(null);
    setPendingUsername(creator.username);
    try {
      if (creator.following) {
        await usersApi.unfollowUser(creator.username);
      } else {
        await usersApi.followUser(creator.username);
      }
      // Only now flip the state — the request is what makes it true.
      setCreators((rows) =>
        rows.map((row) =>
          row.username === creator.username ? { ...row, following: !creator.following } : row,
        ),
      );
    } catch {
      setFollowError("关注操作未完成，请确认登录状态后重试。");
    } finally {
      setPendingUsername(null);
    }
  }, []);

  return { status, creators, followError, pendingUsername, toggleFollow };
}

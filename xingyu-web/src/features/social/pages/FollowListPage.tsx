import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { socialApi } from "@/api/social/social.api";
import type { FollowUser } from "@/api/social/social.types";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { FollowUserRow } from "../FollowUserRow";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; users: FollowUser[] };

/*
 * The signed-in user's follow lists (Phase 2I-1).
 *
 * `/me/following` and `/me/followers` are the same page with one difference:
 * a follower can be followed back, so only that direction gets an action
 * button. Everything else (fetch, states, row) is shared.
 *
 * Route-level `RequireAuth` guarantees a session, so a 401 here means the
 * session expired mid-session rather than "you are not allowed" — that is
 * surfaced as an error, not silently as an empty list.
 *
 * `limit` is the only paging knob (no cursor): 50 is the backend's own default
 * ceiling for a single page, so the window is fetched once.
 */

const LIMIT = 50;

type Direction = "following" | "followers";

const COPY: Record<Direction, { title: string; empty: string; emptyHint: string }> = {
  following: {
    title: "我的关注",
    empty: "还没有关注任何人",
    emptyHint: "在发现页找到感兴趣的创作者，关注后会出现在这里。",
  },
  followers: {
    title: "我的粉丝",
    empty: "还没有粉丝",
    emptyHint: "发布内容并参与讨论，会有人关注你的。",
  },
};

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED");
}

export function FollowListPage({ direction }: { direction: Direction }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<string | null>(null);
  const copy = COPY[direction];

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setRowError(null);

    const request =
      direction === "following"
        ? socialApi.listMyFollowing(LIMIT)
        : socialApi.listMyFollowers(LIMIT);

    request
      .then((users) => {
        if (active) setState({ kind: "ready", users });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err) });
      });

    return () => {
      active = false;
    };
  }, [direction]);

  /**
   * Follow back, from the followers list. The button is only rendered for
   * followers, so there is no unfollow path here — managing who you follow is
   * done from the following list (which links to the profile).
   */
  async function onFollowBack(user: FollowUser) {
    if (pending[user.userId]) return;
    setRowError(null);
    setPending((map) => ({ ...map, [user.userId]: true }));
    try {
      await usersApi.followUser(user.username);
      // Reflect it in place: the row stays (they still follow you), the button goes.
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              users: current.users.map((item) =>
                item.userId === user.userId ? { ...item, followedAt: new Date().toISOString() } : item,
              ),
            }
          : current,
      );
    } catch (err: unknown) {
      setRowError(err instanceof ApiError ? err.problem.detail : "操作失败，请稍后重试。");
    } finally {
      setPending((map) => {
        const next = { ...map };
        delete next[user.userId];
        return next;
      });
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        {/* RequireAuth already guaranteed a session, so a 401 means it expired
            mid-visit — say so, rather than a generic "try again later". */}
        <PageState
          kind="error"
          title="加载失败"
          description={state.expired ? "登录状态已过期，请重新登录。" : "无法读取这份列表，请稍后重试。"}
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { users } = state;

  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{`共 ${users.length} 位`}</p>
      </header>

      <nav aria-label="关注导航" className="flex gap-2">
        <Link
          to="/me/following"
          aria-current={direction === "following" ? "page" : undefined}
          className={
            direction === "following"
              ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
              : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          关注
        </Link>
        <Link
          to="/me/followers"
          aria-current={direction === "followers" ? "page" : undefined}
          className={
            direction === "followers"
              ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
              : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          粉丝
        </Link>
      </nav>

      {rowError ? (
        <p role="alert" className="text-sm text-destructive">
          {rowError}
        </p>
      ) : null}

      {users.length === 0 ? (
        <PageState kind="empty" title={copy.empty} description={copy.emptyHint} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {users.map((user) => (
            <FollowUserRow
              key={user.userId}
              user={user}
              action={
                direction === "followers" && !user.followedAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(pending[user.userId])}
                    onClick={() => void onFollowBack(user)}
                  >
                    {pending[user.userId] ? "关注中…" : "关注"}
                  </Button>
                ) : null
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Route hosts — `/me/following` and `/me/followers`. */
export function MyFollowingPage() {
  return <FollowListPage direction="following" />;
}

export function MyFollowersPage() {
  return <FollowListPage direction="followers" />;
}


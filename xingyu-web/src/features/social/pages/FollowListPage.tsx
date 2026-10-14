import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { socialApi } from "@/api/social/social.api";
import type { FollowUser } from "@/api/social/social.types";
import { usersApi } from "@/api/users/users.api";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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

/*
 * One recipe for both tabs. The active/inactive pair used to be copy-pasted per
 * link; hoisting it keeps the two from drifting, and gives the hand-rolled tabs
 * the shared focus ring that a bare `Link` does not carry.
 */
function tabClass(active: boolean): string {
  return cn(
    "focus-ring rounded-md border px-3 py-1.5 text-sm",
    active
      ? "border-accent bg-accent/10 font-medium text-accent-strong"
      : "border-border text-muted-foreground hover:bg-muted",
  );
}

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function FollowListPage({ direction }: { direction: Direction }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [direction, reloadKey]);

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
                item.userId === user.userId
                  ? { ...item, followedAt: new Date().toISOString() }
                  : item,
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
          description={
            state.expired ? "登录状态已过期，请重新登录。" : "无法读取这份列表，请稍后重试。"
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { users } = state;

  return (
    <div className="section-gap">
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{copy.title}</h1>
        <p className="lede mt-2 max-w-2xl">{`共 ${users.length} 位`}</p>
      </header>

      <nav aria-label="关注导航" className="flex gap-2">
        <Link
          to="/me/following"
          aria-current={direction === "following" ? "page" : undefined}
          className={tabClass(direction === "following")}
        >
          关注
        </Link>
        <Link
          to="/me/followers"
          aria-current={direction === "followers" ? "page" : undefined}
          className={tabClass(direction === "followers")}
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

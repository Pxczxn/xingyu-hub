import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { socialApi } from "@/api/social/social.api";
import type { FollowUser } from "@/api/social/social.types";
import { usersApi } from "@/api/users/users.api";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FollowUserRow, followUserLabel } from "../FollowUserRow";

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
 *
 * 骨架（A §3 `/me/*` 表）
 * ----------------------
 * MyFollowing  = SK6 · 线/紧/错 ：`PageMasthead` + `FeedRow` 行式 + **右栏**
 * MyFollowers  = SK6 · 线/紧/齐 ：同样的页头与行制，**没有右栏**
 * 一个文件两页，所以「错 / 齐」这一档差异只能落在 `rail` 的有无上 —— 这也正是
 * R 轴的定义（错 = 主列+侧轨，齐 = 全块与内容列同宽同边），而不是页面自己写
 * 一套偏移网格。页头两种方向都保持 `线`（无面 masthead）：同一屏两页的标题是
 * 「我的关注 / 我的粉丝」，用横幅把区别放在「有无一层面色」上会读成两种页面形态。
 *
 * 页签（关注 / 粉丝）从标题下方的一行挪进 `PageMasthead` 的 `actions` 槽：
 * 页签属于页头的身份行，放在这里首屏就少一块，行流能更早开始。`<nav aria-label>`
 * 与 `aria-current="page"` 原样保留（路由测试与 follow-pages.test.tsx 都按它查）。
 * 选中态按 B §4 收敛：`--surface-sunken` 面 + `--primary` 字，不再用蓝底蓝字
 * （功能蓝只留给链接、焦点与选中竖条）。
 */

const LIMIT = 50;

type Direction = "following" | "followers";

const COPY: Record<Direction, { title: string; empty: string; emptyHint: string }> = {
  following: {
    title: "我的关注",
    empty: "还没有关注任何人",
    emptyHint: "在探索页找到感兴趣的创作者，关注后会出现在这里。",
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
    "focus-ring rounded-chip border px-3 py-1.5 text-sm transition-colors",
    active
      ? "border-border bg-surface-sunken font-medium text-primary"
      : "border-transparent text-muted-foreground hover:bg-muted",
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
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead
          title={copy.title}
          description={`共 ${users.length} 位`}
          actions={
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
          }
        />
      }
      /*
       * R=错 只在「我的关注」上成立：粉丝列表按映射表是「齐」，所以那一页不传 rail，
       * frame 自动退回 `SOLO.SK6` 的单列。右栏两块都从本页已取回的 users 派生。
       */
      rail={direction === "following" && users.length > 0 ? <FollowingRail users={users} /> : null}
      railLabel="关注侧栏"
    >
      {rowError ? (
        <p role="alert" className="text-sm text-destructive">
          {rowError}
        </p>
      ) : null}

      {users.length === 0 ? (
        <PageState kind="empty" title={copy.empty} description={copy.emptyHint} />
      ) : (
        /* 行式流：单列、发丝线分隔（`FollowUserRow` 内部用 `FeedRow`），
           所以这里不再给 `sm:grid-cols-2` —— D=紧 的「行」与 D=松 的「格」
           是两种读法，两列会把行读成格子。 */
        <ul aria-label={`${copy.title}列表`} className="flex flex-col">
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
    </ArchetypeFrame>
  );
}

/**
 * 右栏：只挂在「我的关注」上（R=错）。两块都由本页已取回的 `FollowUser[]` 派生。
 *
 * 刻意不自造「互关率 / 活跃度」类指标：`FollowUser` 只有 userId/username/
 * displayName/followedAt 四个字段。这里的人数与时间都能逐条复核。
 *
 * 名单用 `<span>` 而不是 `<Link>`：行流里那条才是唯一可点的目标，右栏只是索引副本。
 */
function FollowingRail({ users }: { users: FollowUser[] }) {
  const mutual = users.filter((user) => Boolean(user.followedAt)).length;
  const latest = [...users]
    .filter((user) => Boolean(user.followedAt))
    .sort((a, b) => followedAtMs(b.followedAt) - followedAtMs(a.followedAt))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="following-rail-overview"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="following-rail-overview" className="text-h3 text-primary">
          关注概览
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-caption text-muted-foreground">关注人数</dt>
            <dd className="mt-1 text-metric leading-none tabular-nums text-primary">
              {users.length}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">已回关</dt>
            <dd className="mt-1 text-metric leading-none tabular-nums text-primary">{mutual}</dd>
          </div>
        </dl>
      </section>

      {latest.length > 0 ? (
        <section
          aria-labelledby="following-rail-latest"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="following-rail-latest" className="text-h3 text-primary">
            最近关注
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {latest.map((user) => (
              <li key={user.userId} className="truncate text-meta text-foreground-soft">
                {followUserLabel(user)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** 排序用的时间戳；缺失或不可解析一律当 0，让它们排到最后。 */
function followedAtMs(value?: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Route hosts — `/me/following` and `/me/followers`. */
export function MyFollowingPage() {
  return <FollowListPage direction="following" />;
}

export function MyFollowersPage() {
  return <FollowListPage direction="followers" />;
}

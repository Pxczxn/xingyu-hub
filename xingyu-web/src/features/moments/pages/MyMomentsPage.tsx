import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Heart, MessageCircle, PenLine, Sparkles, UsersRound } from "lucide-react";
import { ApiError } from "@/api/client";
import { meInsightsApi, momentsApi } from "@/api/moments/moments.api";
import { MY_MOMENTS_LIMIT, type InsightsView, type MomentView } from "@/api/moments/moments.types";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * My moments (Phase 2I-5) — the owner's own moment history.
 *
 * THIS IS NOT THE FEED. `/moments` is the public, guest-readable feed; this page
 * is the session user's own list, which is why the route is `/me/moments` and
 * why it is behind RequireAuth. The two read from different endpoints
 * (`/moments` vs `/me/moments`) even though both return `MomentView[]`.
 *
 * Three reads are combined, with deliberately different failure policies:
 *   /me/moments   REQUIRED — it is the page. Its failure is the page's failure.
 *   /me/profile   decoration (the header). Its failure degrades the header only.
 *   /me/insights  decoration (the counters). Its failure shows 「—」, not 0.
 *
 * The insights distinction matters: `InsightsView` counters are non-null longs,
 * so a genuine 0 and "we could not read it" are different things. Rendering 0
 * for a failed read would claim the user has written nothing — the same class of
 * lie this codebase avoids elsewhere. So the panel renders 「—」 when unread.
 *
 * `/me/moments` returns PUBLISHED only, and `listMine` has no draft concept to
 * surface: a moment is published the instant it is created (POST /moments sets
 * status=PUBLISHED). There is therefore no draft/published split to show, and
 * this page does not invent one.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; moments: MomentView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function formatMomentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MyMomentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  // Decoration state is separate so its failure cannot sink the page.
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [insights, setInsights] = useState<InsightsView | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setProfile(null);
    setInsights(null);

    momentsApi
      .listMine(MY_MOMENTS_LIMIT)
      .then((moments) => {
        if (active) setState({ kind: "ready", moments });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    // Both are decoration: swallow their failures rather than coupling them.
    usersApi
      .getMyProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        /* header falls back to a neutral title */
      });
    meInsightsApi
      .get()
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch(() => {
        /* counters render as 「—」 rather than 0 */
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const moments = state.kind === "ready" ? state.moments : [];

  // The newest moment is called out, mirroring the Legacy timeline's treatment.
  const latestId = useMemo(() => moments[0]?.id ?? null, [moments]);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired
              ? "登录状态已过期，请重新登录。"
              : (state.detail ?? "无法读取你的动态，请稍后重试。")
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

  const heading = profile?.displayName?.trim() || profile?.username || "我的动态";

  return (
    <div className="section-gap">
      {/*
        Page head (S7 light) — NOT a profile card.

        The layout design names this page and /me/events on one line —
        「页头 + 列表（S7 轻量）；状态与操作优先」— and states the rule for the whole
        /me/* group: 「优先状态、记录和操作，不放个人资料大卡（与个人主页区分）」.

        This block WAS that card: `rounded-lg border bg-card p-5` around a display
        name, an ID line and a bio, with an action button beside them — the same
        shape as the identity header on /u/:username, on the one page the design
        sets apart from it. MyEventsPage, the other page named on that line,
        carries no surface at all: a bare `<header>` holding a title, a status
        line and one action. This now matches it, so the two pages read as one
        family instead of two.

        `sm:items-end`, not `sm:items-center`: centring the button against a
        three-line text block makes it read as a card's trailing control.
        Bottom-aligning puts the action on the text's last baseline, which is what
        a header LINE looks like. `sm:justify-between` then does the pushing the
        old `flex-1` spacer did, without a spacer to keep in sync.

        The ID line and the bio stay. The CARD was the profile-card problem, not
        the sentence — and both carry the reader's own data, already on this page.
        Dropping either would be a content regression wearing a layout change's
        clothes. `ID: {username}` keeps its exact form; the header test pins it.
      */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{heading}</h1>
          {profile?.username ? (
            <p className="mt-1 text-meta text-muted-foreground">ID: {profile.username}</p>
          ) : null}
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {profile?.bio?.trim() || "记录灵感、阅读与社区交流的每一刻。"}
          </p>
        </div>
        <Link to="/moments" className={cn(buttonVariants({ variant: "accent" }), "shrink-0")}>
          <PenLine className="h-4 w-4" aria-hidden />
          发布动态
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/*
          The list is one surface holding rows, not a grid of cards — the shape
          /me/likes and /me/comments already use, and the right one here: these
          rows are records of the same kind, so a per-row card would add fifty
          borders to say what one column edge already says.

          Surface language follows the rest of batch 07 (`rounded-xl` over
          `border-border/70`), so this page and the two beside it in the same
          feature read as one set. The inner rules are deliberately left alone:
          an outer frame at 70% with full-strength dividers is how a list is
          meant to look — the rows are the structure, the frame is only a
          boundary.
        */}
        <section className="rounded-xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="section-heading">全部动态</h2>
            <span className="text-meta text-muted-foreground">按时间倒序</span>
          </div>

          {moments.length === 0 ? (
            <div className="p-5">
              <PageState
                kind="empty"
                title="还没有动态"
                description="发布第一条动态后，它会出现在这里。"
              />
            </div>
          ) : (
            /*
              Rows rise in on mount with the same stagger the feed uses, so
              arriving from /moments keeps one motion language.

              Fifty rows is more than the feed ever renders, and that is fine:
              the delay caps at index 8 (see staggerDelay) and this is a MOUNT
              animation, not a scroll trigger — everything past the first screen
              has already settled before anyone scrolls to it, which is free.

              The delay is an inline style on purpose. `animate-rise-in` is the
              `animation` shorthand and resets `animation-delay` to 0, so a class
              cannot win the cascade here.
            */
            <ul aria-label="我的动态列表" className="divide-y divide-border">
              {moments.map((moment, index) => (
                <li
                  key={moment.id}
                  className="animate-rise-in grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)]"
                  style={{ animationDelay: staggerDelay(index) }}
                >
                  <time
                    dateTime={moment.createdAt}
                    className="text-meta tabular-nums text-muted-foreground"
                  >
                    {formatMomentTime(moment.createdAt)}
                  </time>
                  <div className="min-w-0">
                    <p className="text-meta font-medium text-muted-foreground">
                      {moment.id === latestId ? "最近发布" : "发布动态"}
                    </p>
                    <Link
                      to={`/moments/${encodeURIComponent(moment.id)}`}
                      className="mt-2 block whitespace-pre-wrap text-sm leading-6 text-foreground hover:text-accent-strong"
                    >
                      {moment.body?.trim() || "（无内容）"}
                    </Link>
                    <Link
                      to={`/moments/${encodeURIComponent(moment.id)}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-meta text-muted-foreground hover:text-accent-strong"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      查看互动
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-border/70 bg-card p-4">
            <h2 className="section-heading flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" aria-hidden />
              动态概览
            </h2>
            <dl className="mt-3 flex flex-col gap-3 text-meta">
              <Row icon={CalendarDays} label="已发布动态" value={`${moments.length} 条`} />
              {/* 「—」 rather than 0 when the read failed: the counters are
                  non-null longs server-side, so 0 is a real value and must not
                  be faked. */}
              <Row
                icon={Heart}
                label="获得喜欢"
                value={insights ? String(insights.likeCount) : "—"}
              />
              <Row
                icon={UsersRound}
                label="粉丝"
                value={
                  insights
                    ? String(insights.followerCount)
                    : profile?.followerCount != null
                      ? String(profile.followerCount)
                      : "—"
                }
              />
              <Row
                icon={PenLine}
                label="已发布文章"
                value={insights ? `${insights.articleCount} 篇` : "—"}
              />
            </dl>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-4">
            <h2 className="section-heading">创作足迹</h2>
            <p className="mt-2 text-meta leading-6 text-muted-foreground">
              每一条公开动态都会沉淀为你在星语社区的交流轨迹。动态发布后即可公开阅读，删除后会从动态页消失。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}

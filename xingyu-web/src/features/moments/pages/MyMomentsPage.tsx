import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Heart, MessageCircle, PenLine, Sparkles, UsersRound } from "lucide-react";
import { ApiError } from "@/api/client";
import { meInsightsApi, momentsApi } from "@/api/moments/moments.api";
import { MY_MOMENTS_LIMIT, type InsightsView, type MomentView } from "@/api/moments/moments.types";
import { usersApi } from "@/api/users/users.api";
import type { ProfileDetail } from "@/api/users/users.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
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

/*
 * 骨架（A §3 `/me/*` 表 · MyMoments = SK6 · 线/松/齐）
 * -------------------------------------------------
 * 本页与 MyEvents（同为 SK6·线）在同一批里收尾，两者的 SK 与 H 完全一样，
 * 所以必须靠 D 与 R 分开，否则就是 A §2 要消除的「同一套栅格换 padding」：
 *
 *   H=线：`PageMasthead` —— 无面页头，标题贴内容列左缘、两个动作落在基线尾。
 *         原来那圈 `rounded-lg border bg-card p-5` 的个人资料卡在 2026-10 就
 *         已经拆掉了（它是 /u/:username 的形状，不是 /me 列表页的形状），这次
 *         只是把它彻底换成统一页头，手写 `text-2xl` h1 一并收敛。
 *   D=松：**每一条动态是独立卡面**（`rounded-card` + 发丝边 + 内 padding），
 *         不是 MyEvents 那种发丝线行。理由是可读性：动态正文是要逐条读的多行
 *         文本，行式会把三行正文压成一条细缝；两张卡之间由
 *         `--density-list-gap` 拉开，首屏因此至多三块。
 *   R=齐：**不给 rail**，`ArchetypeFrame` 退回单列（`SOLO.SK6`），页头、列表、
 *         概览、页尾说明共用一条左缘同一宽度。原来那个 280px 的 `<aside>` 里
 *         两块面板随之下沉到流尾 —— 这正是 A §1 给 SK6 定的响应式行为
 *         「768 以下右栏面板移到流尾」，只不过在这里是**恒久**形态，因为本页
 *         的 R 就是 齐。
 *
 * 于是同域三页一眼可分：MyLikes = 行式+右轨、MyComments = 卡面+单列、
 * MyEvents = 行式+右轨（条目内部三层）、本页 = 卡面+单列。
 *
 * 「动态概览」的四个计数仍然区分「真 0」与「读不到」：insights 读失败时渲染
 * 「—」，粉丝数退回 profile 的 followerCount，两者都没有才是「—」。
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
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="loose"
      headerSlot={
        /*
          The page head is a masthead LINE, not a profile card: the /me/* rule is
          「优先状态、记录和操作，不放个人资料大卡（与个人主页区分）」. Identity and
          the one action share the baseline row; the ID line sits in the action
          cluster the way ConversationAssetsPage puts its item count there, so the
          masthead keeps exactly one text column (title + bio) like every other
          线 header in the app.

          Both the ID line and the bio stay: they carry the reader's own data and
          are already on this page, and `ID: {username}` keeps its exact form —
          the header test pins that string.
        */
        <PageMasthead
          title={heading}
          description={profile?.bio?.trim() || "记录灵感、阅读与社区交流的每一刻。"}
          actions={
            <>
              {profile?.username ? (
                <span className="text-meta text-muted-foreground">ID: {profile.username}</span>
              ) : null}
              <Link to="/moments" className={cn(buttonVariants({ variant: "accent" }), "shrink-0")}>
                <PenLine className="h-4 w-4" aria-hidden />
                发布动态
              </Link>
            </>
          }
        />
      }
    >
      <section aria-labelledby="moments-record-heading" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2">
          <h2 id="moments-record-heading" className="section-heading">
            全部动态
          </h2>
          <span className="text-caption text-muted-foreground">按时间倒序</span>
        </div>

        {moments.length === 0 ? (
          <div className="pt-6">
            <PageState
              kind="empty"
              title="还没有动态"
              description="发布第一条动态后，它会出现在这里。"
            />
          </div>
        ) : (
          /*
            D=松：每条动态独立成面，间距与卡内 padding 都读 `.density-loose`
            提供的变量，所以「松」只有一处定义（`ArchetypeFrame` 的 `density`）。

            Rows rise in on mount with the same stagger the feed uses, so
            arriving from /moments keeps one motion language. The delay caps at
            index 8 (see staggerDelay) and this is a MOUNT animation, not a
            scroll trigger — everything past the first screen has already settled
            before anyone scrolls to it. The delay is inline on purpose:
            `animate-rise-in` is the `animation` shorthand and resets
            `animation-delay` to 0, so a class cannot win the cascade here.
          */
          <ul
            aria-label="我的动态列表"
            className="flex flex-col gap-[var(--density-list-gap)] pt-4"
          >
            {moments.map((moment, index) => (
              <li
                key={moment.id}
                className="animate-rise-in rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
                style={{ animationDelay: staggerDelay(index) }}
              >
                {/* 时间与「最近发布」同在一行：卡面里再开一条 92px 的时间栏，
                    等于在卡内画第二根竖线，而这里只有一条记录。 */}
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-caption text-muted-foreground">
                  <span>{moment.id === latestId ? "最近发布" : "发布动态"}</span>
                  <time dateTime={moment.createdAt} className="tabular-nums">
                    {formatMomentTime(moment.createdAt)}
                  </time>
                </p>
                <Link
                  to={`/moments/${encodeURIComponent(moment.id)}`}
                  className="focus-ring mt-2 block whitespace-pre-wrap text-body leading-7 text-foreground hover:text-accent-strong"
                >
                  {moment.body?.trim() || "（无内容）"}
                </Link>
                <Link
                  to={`/moments/${encodeURIComponent(moment.id)}`}
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 text-meta text-muted-foreground hover:text-accent-strong"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  查看互动
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        R=齐 没有右轨，所以原来 `<aside>` 里的两块面板下沉到流尾 —— 页头 → 列表
        → 概览 → 说明，全部与内容列同宽同边。这既是 A §1 对 SK6 定的响应式行为
        （右栏面板移到流尾）在本页的**恒久**形态，也让「我的动态」首屏由第一条
        开始，符合 SK6「允许无页头起首屏」的读法。
      */}
      <section
        aria-labelledby="moments-overview-heading"
        className="rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
      >
        <h2
          id="moments-overview-heading"
          className="flex items-center gap-1.5 text-h3 text-primary"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          动态概览
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Row icon={CalendarDays} label="已发布动态" value={`${moments.length} 条`} />
          {/* 「—」 rather than 0 when the read failed: the counters are
              non-null longs server-side, so 0 is a real value and must not
              be faked. */}
          <Row icon={Heart} label="获得喜欢" value={insights ? String(insights.likeCount) : "—"} />
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

      <section
        aria-labelledby="moments-trail-heading"
        className="rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
      >
        <h2 id="moments-trail-heading" className="text-h3 text-primary">
          创作足迹
        </h2>
        <p className="mt-2 max-w-2xl text-meta leading-6 text-muted-foreground">
          每一条公开动态都会沉淀为你在星语社区的交流轨迹。动态发布后即可公开阅读，删除后会从动态页消失。
        </p>
      </section>
    </ArchetypeFrame>
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
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-2 text-meta text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-meta font-semibold text-foreground">{value}</dd>
    </div>
  );
}

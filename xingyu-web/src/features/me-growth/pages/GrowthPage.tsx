import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, MessageSquare, TrendingUp } from "lucide-react";
import { ApiError } from "@/api/client";
import { badgesApi } from "@/api/badges/badges.api";
import type { BadgeView } from "@/api/badges/badges.types";
import { homeApi } from "@/api/home/home.api";
import type { PendingAction } from "@/api/home/home.types";
import { myCommentsApi } from "@/api/me-activity/me-activity.api";
import type { MyCommentView } from "@/api/me-activity/me-activity.types";
import { meInsightsApi } from "@/api/moments/moments.api";
import type { InsightsView } from "@/api/moments/moments.types";
import {
  readingHistoryApi,
  type ReadingHistoryItem,
} from "@/api/reading-history/reading-history.api";
import { contentHref } from "@/components/shared/ContentCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { badgeTitle, countEarned, sortForDisplay } from "../achievement-badges";
import {
  dedupePendingActions,
  pendingCountLabel,
  pendingTitle,
  resolvePendingHref,
  retainedPendingKey,
} from "../growth-aggregate";

/*
 * /me/growth — 成长记录 (Phase 3B)
 *
 * ⚠️ THE POINT OF THIS PAGE IS PER-SECTION HONESTY.
 *
 * It performs FIVE independent reads. Legacy fired them all with `useAsyncData`
 * and then guarded the render with `insights && (...)`, `badges && (...)` etc. —
 * so any failed read made its whole section DISAPPEAR. A vanished section is
 * indistinguishable from "you have none", which is exactly the failure mode
 * §三·补9 condemned in the analytics page (`—` for both error and 0). Each
 * section here therefore carries its own loading/error state and SAYS so.
 *
 * ⚠️ NO READING HISTORY IS NOT "OFF" vs "EMPTY". The backend short-circuits
 * `reading-history` to an empty list when the user disabled the setting, and
 * returns the same empty list when they simply have not read anything. We cannot
 * tell them apart from this response, so the copy states both possibilities
 * instead of picking one.
 *
 * ⚠️ PENDING-ACTION HREFS ARE SERVER DATA THAT MAY NOT EXIST HERE. The backend's
 * only producer hardcodes `/studio/reviewing`, which V2 does not route. Those are
 * rendered as plain text (still visible, not a dead link) — see `resolvePendingHref`.
 *
 * Notes on the sources reused rather than duplicated:
 *   - insights  -> `meInsightsApi` (already owned by the /me/moments surface)
 *   - comments  -> `myCommentsApi` (already owned by 我的互动)
 *   - badges    -> `badgesApi` (Phase 3A)
 *   - pending   -> `homeApi.getMyHome()` (already owned by the home surface)
 *   - reading   -> new in this phase: there was no client for it at all
 */

type Section<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: T };

const INITIAL: Section<never> = { kind: "loading" };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function formatTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function GrowthPage() {
  const [history, setHistory] = useState<Section<ReadingHistoryItem[]>>(INITIAL);
  const [comments, setComments] = useState<Section<MyCommentView[]>>(INITIAL);
  const [badges, setBadges] = useState<Section<BadgeView[]>>(INITIAL);
  const [insights, setInsights] = useState<Section<InsightsView>>(INITIAL);
  const [pending, setPending] = useState<Section<PendingAction[]>>(INITIAL);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;
    const fail = (err: unknown, setter: (s: { kind: "error" }) => void) => {
      if (!active) return;
      if (isAuthError(err)) setSessionExpired(true);
      setter({ kind: "error" });
    };

    // Five reads, five independent states. Deliberately NOT Promise.all: one
    // rejection must not blank the other four.
    readingHistoryApi
      .list()
      .then((page) => active && setHistory({ kind: "ready", data: page.items ?? [] }))
      .catch((err: unknown) => fail(err, setHistory));

    myCommentsApi
      .list(10)
      .then((data) => active && setComments({ kind: "ready", data }))
      .catch((err: unknown) => fail(err, setComments));

    badgesApi
      .list()
      .then((data) => active && setBadges({ kind: "ready", data }))
      .catch((err: unknown) => fail(err, setBadges));

    meInsightsApi
      .get()
      .then((data) => active && setInsights({ kind: "ready", data }))
      .catch((err: unknown) => fail(err, setInsights));

    homeApi
      .getMyHome()
      .then((data) => active && setPending({ kind: "ready", data: data.pendingActions ?? [] }))
      .catch((err: unknown) => fail(err, setPending));

    return () => {
      active = false;
    };
  }, []);

  const { actions: dedupedPending, counts: pendingCounts } = dedupePendingActions(
    pending.kind === "ready" ? pending.data : [],
  );

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <TrendingUp className="h-5 w-5" aria-hidden />
          成长记录
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你的创作数据、徽章、阅读轨迹与最近互动。每个区块各自加载，读不到时会单独说明。
        </p>
      </header>

      {sessionExpired ? (
        <p className="text-center text-sm text-muted-foreground">
          部分数据因登录状态过期无法读取。
          <Link to="/login" className="ml-1 text-accent hover:underline">
            去登录
          </Link>
        </p>
      ) : null}

      {/* ---- 创作数据 ---- */}
      <section className="rounded-lg border border-border bg-card p-5" aria-label="创作数据">
        <h2 className="section-heading">创作数据</h2>
        {insights.kind === "loading" ? (
          <p className="mt-2 text-sm text-muted-foreground">正在读取…</p>
        ) : insights.kind === "error" ? (
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            暂时无法读取创作数据，因此这里不显示任何数字。
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="已发布文章" value={insights.data.articleCount} />
            <Stat label="草稿" value={insights.data.draftCount} />
            <Stat label="粉丝" value={insights.data.followerCount} />
            <Stat label="关注" value={insights.data.followingCount} />
            <Stat label="评论" value={insights.data.commentCount} />
            <Stat label="获得喜欢" value={insights.data.likeCount} />
          </dl>
        )}
      </section>

      {/* ---- 待处理 ---- */}
      {pending.kind === "ready" && dedupedPending.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-5" aria-label="待处理">
          <h2 className="section-heading">待处理</h2>
          <ul className="mt-3 space-y-2">
            {dedupedPending.map((action, index) => {
              const href = resolvePendingHref(action);
              const label = pendingTitle(action);
              const count = pendingCounts.get(retainedPendingKey(action));
              return (
                <li key={`${action.type}-${action.title}-${index}`}>
                  {href ? (
                    <Link
                      to={href}
                      className="block rounded-md border border-border px-4 py-3 text-sm text-foreground hover:border-accent/50 hover:text-accent"
                    >
                      {label}
                      {count && count > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {pendingCountLabel(count)}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    // Real prompt, no route we ship — shown, but not as a dead link.
                    <span className="block rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
                      {label}
                      {count && count > 1 ? (
                        <span className="ml-2 text-xs">{pendingCountLabel(count)}</span>
                      ) : null}
                      <span className="mt-1 block text-xs">
                        该入口在本站尚未开放，可到创作中心查看。
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- 徽章 ---- */}
      <section className="rounded-lg border border-border bg-card p-5" aria-label="徽章">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Award className="h-4 w-4" aria-hidden />
            徽章
          </h2>
          <Link to="/me/badges" className="text-xs text-accent hover:underline">
            查看全部
          </Link>
        </div>
        {badges.kind === "loading" ? (
          <p className="mt-2 text-sm text-muted-foreground">正在读取…</p>
        ) : badges.kind === "error" ? (
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            暂时无法读取徽章状态，因此这里不显示任何徽章。
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              当前已点亮 {countEarned(badges.data)} / {badges.data.length} 枚
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sortForDisplay(badges.data).map((badge) => (
                <li
                  key={badge.id}
                  title={badge.description}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    badge.earned
                      ? "border-accent/50 text-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {badgeTitle(badge)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---- 最近阅读 ---- */}
      <section className="rounded-lg border border-border bg-card p-5" aria-label="最近阅读">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4" aria-hidden />
          最近阅读
        </h2>
        {history.kind === "loading" ? (
          <p className="mt-2 text-sm text-muted-foreground">正在读取…</p>
        ) : history.kind === "error" ? (
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            暂时无法读取阅读记录，因此这里不显示任何条目。
          </p>
        ) : history.data.length === 0 ? (
          // The setting being off and "nothing read yet" produce the SAME empty
          // response, so we state both rather than asserting one.
          <p className="mt-2 text-sm text-muted-foreground">
            没有阅读记录。可能是还没有读过内容，也可能是在设置里关闭了阅读历史记录。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {history.data.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <Link
                  to={contentHref({ id: item.id, objectType: item.objectType })}
                  className="min-w-0 truncate text-sm text-foreground hover:text-accent"
                >
                  {item.title || item.id}
                </Link>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatTime(item.updatedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- 最近评论 ---- */}
      <section className="rounded-lg border border-border bg-card p-5" aria-label="最近评论">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquare className="h-4 w-4" aria-hidden />
          最近评论
        </h2>
        {comments.kind === "loading" ? (
          <p className="mt-2 text-sm text-muted-foreground">正在读取…</p>
        ) : comments.kind === "error" ? (
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            暂时无法读取评论记录，因此这里不显示任何条目。
          </p>
        ) : comments.data.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">还没有发表过评论。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {comments.data.map((comment) => (
              <li key={comment.id} className="rounded-md border border-border px-4 py-3">
                <p className="text-sm text-foreground">{comment.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTime(comment.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex flex-wrap justify-center gap-3">
        <Link
          to="/studio/analytics"
          className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
        >
          查看创作数据
        </Link>
        <Link to="/me/likes" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          我的喜欢
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <dd className="text-xl font-semibold text-primary">{value}</dd>
      <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

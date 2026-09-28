import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Lock, Sparkles } from "lucide-react";
import { ApiError } from "@/api/client";
import { badgesApi } from "@/api/badges/badges.api";
import type { BadgeView } from "@/api/badges/badges.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  badgeDescription,
  badgeTitle,
  badgeTone,
  countEarned,
  hasUnknownBadges,
  sortForDisplay,
} from "../achievement-badges";

/*
 * /me/badges — 徽章成就 (Phase 3A)
 *
 * ⚠️ TWO LEGACY CLAIMS THIS PAGE MUST NOT REPEAT:
 *
 *   1. "更多隐藏徽章等待你去发现" (Legacy footer). The server's `badges()`
 *      unconditionally returns exactly five. There is nothing hidden. That
 *      footer promises content that does not exist.
 *   2. A "星语探索者" level card with a decorative badge count. Legacy rendered
 *      a fixed title plus `earned.length` — the title was invented (no backend
 *      concept of a level) and the "level" never changes with progress. An
 *      invented rank above a real count reads as real.
 *
 * ⚠️ `earned` IS NOT A PERSISTED AWARD. `MeEngagementService.badges` derives it
 * per request from live counts (articles, followers, onboarding, bio). So:
 *   - the summary says "当前已点亮", not "已获得 N 枚" (which implies a keepable
 *     trophy the user could lose without understanding why);
 *   - the empty state is unreachable for a logged-in user, so we handle a truly
 *     empty response as an anomaly to explain, not as a normal "you have none".
 *
 * Locked badges keep the server's criterion text as the description — it says
 * what to do. We never replace it with friendlier prose that drops the bar.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; badges: BadgeView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function AchievementBadgesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    badgesApi
      .list()
      .then((badges) => {
        if (active) setState({ kind: "ready", badges });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, []);

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
              : (state.detail ?? "无法读取你的徽章，请稍后重试。")
          }
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

  const { badges } = state;

  if (badges.length === 0) {
    // Unreachable for a session user (the server always sends five). If it
    // happens, say so plainly rather than implying "you have earned nothing" —
    // the difference matters, and the user cannot tell them apart otherwise.
    return (
      <div className="section-gap">
        <header className="rounded-lg border border-border bg-card p-5">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
            <Award className="h-5 w-5" aria-hidden />
            徽章成就
          </h1>
        </header>
        <PageState
          kind="empty"
          title="没有读到徽章"
          description="徽章列表由系统统一提供，这里没有读到任何条目。这通常意味着数据异常，而不是你尚未点亮任何徽章。"
        />
      </div>
    );
  }

  const displayed = sortForDisplay(badges);
  const earnedCount = countEarned(badges);

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Award className="h-5 w-5" aria-hidden />
          徽章成就
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          徽章由你的社区行为实时判定：创作、关注、完善资料都会改变它们的状态。
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">当前进度</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          当前已点亮 <strong className="text-primary">{earnedCount}</strong> 枚，共{" "}
          <strong className="text-foreground">{badges.length}</strong> 枚徽章。
        </p>
        {/* No progress bar as a "level": there is no backend level concept and
            the total is a fixed five, so a bar would be decoration with a
            science-fiction denominator. */}
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">全部徽章</h2>
          <span className="text-xs text-muted-foreground">
            已点亮 {earnedCount} / {badges.length}
          </span>
        </div>

        <ul aria-label="徽章列表" className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((badge) => {
            const tone = badgeTone(badge);
            const earned = tone === "earned";
            return (
              <li
                key={badge.id}
                data-testid={`badge-${badge.id}`}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-4",
                  earned ? "border-accent/50 bg-accent/5" : "border-border bg-card opacity-80",
                )}
              >
                <div className="flex items-center justify-between">
                  {earned ? (
                    <Sparkles aria-label="已点亮" className="h-4 w-4 text-accent" />
                  ) : (
                    <Lock aria-label="未点亮" className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    data-testid={`badge-state-${badge.id}`}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      earned
                        ? "border-accent/50 text-accent"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {tone === "unknown" ? "状态未知" : earned ? "已点亮" : "未点亮"}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{badgeTitle(badge)}</h3>
                <p className="text-xs text-muted-foreground">{badgeDescription(badge)}</p>
              </li>
            );
          })}
        </ul>

        {hasUnknownBadges(badges) ? (
          <p className="px-5 pb-5 text-xs text-muted-foreground" data-testid="badge-unknown-note">
            列表里有本页还不认识的徽章，已原样展示。页面更新后可显示完整说明。
          </p>
        ) : null}
      </section>

      <p className="text-center">
        <Link to="/studio" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          去创作中心
        </Link>
      </p>
    </div>
  );
}

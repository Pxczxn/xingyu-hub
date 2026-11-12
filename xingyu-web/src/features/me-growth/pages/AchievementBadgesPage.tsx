import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { ApiError } from "@/api/client";
import { badgesApi } from "@/api/badges/badges.api";
import type { BadgeView } from "@/api/badges/badges.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
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
 *
 * 骨架（A §3 `/me/*` 表 · AchievementBadges = SK2 · 幅/松/齐）
 * ---------------------------------------------------------
 * H=幅：`PageHero` 横幅（有面、带边框，标题 600）。空态分支也用同一个横幅 ——
 *       H 是页面身份而不是「有数据时才出现的装饰」，读不到数据时页头不该消失。
 * D=松：每个徽章是一块独立小卡面（状态 chip + 名称 + 判定条件），首屏至多三块。
 * R=齐：没有 rail —— 本页与收藏夹列表（同为 幅/松/齐）的区分不在页头而在条目
 *       内部：这里是「方形徽章块，无缩略图、无第二链接」，收藏夹是「双链接卡」。
 * 母题只用 0 处：这一页的视觉锚点是徽章本身的点亮/未点亮态，再叠一层背景纹理会
 * 抢走「已点亮」这个唯一的状态信号（B §7 R8 的锚点由 Sparkles/Lock 图标承担）。
 *
 * 行为与文案未变：`badgesApi.list()`、`reloadKey` 重试、三态、`徽章列表` landmark、
 * `data-testid`（badge-* / badge-state-* / badge-unknown-note）逐条保留。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

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

  const { badges } = state;

  if (badges.length === 0) {
    // Unreachable for a session user (the server always sends five). If it
    // happens, say so plainly rather than implying "you have earned nothing" —
    // the difference matters, and the user cannot tell them apart otherwise.
    return (
      <ArchetypeFrame
        skeleton="SK2"
        header="banner"
        density="loose"
        headerSlot={<PageHero title="徽章成就" />}
      >
        <PageState
          kind="empty"
          title="没有读到徽章"
          description="徽章列表由系统统一提供，这里没有读到任何条目。这通常意味着数据异常，而不是你尚未点亮任何徽章。"
        />
      </ArchetypeFrame>
    );
  }

  const displayed = sortForDisplay(badges);
  const earnedCount = countEarned(badges);

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <PageHero
          title="徽章成就"
          description="徽章由你的社区行为实时判定：创作、关注、完善资料都会改变它们的状态。"
        />
      }
    >
      <section aria-labelledby="badges-progress-heading" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
          <h2 id="badges-progress-heading" className="section-heading">
            当前进度
          </h2>
          <span className="text-caption tabular-nums text-muted-foreground">
            已点亮 {earnedCount} / {badges.length}
          </span>
        </div>
        <p className="mt-3 text-body text-muted-foreground">
          当前已点亮 <strong className="tabular-nums text-primary">{earnedCount}</strong> 枚，共{" "}
          <strong className="tabular-nums text-foreground">{badges.length}</strong> 枚徽章。
        </p>
        {/* No progress bar as a "level": there is no backend level concept and
            the total is a fixed five, so a bar would be decoration with a
            science-fiction denominator. */}
      </section>

      <section aria-label="全部徽章" className="min-w-0">
        <h2 className="section-heading">全部徽章</h2>
        {/* D=松：等权卡格。两列在中屏、三列在宽屏；卡面与间距全部走密度变量。 */}
        <ul
          aria-label="徽章列表"
          className="mt-3 grid gap-[var(--density-grid-gap)] sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayed.map((badge) => {
            const tone = badgeTone(badge);
            const earned = tone === "earned";
            return (
              <li
                key={badge.id}
                data-testid={`badge-${badge.id}`}
                className={cn(
                  "flex flex-col gap-2 rounded-card border p-[var(--density-card-pad)]",
                  earned ? "border-border-strong bg-card" : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  {earned ? (
                    <Sparkles aria-label="已点亮" className="h-4 w-4 text-accent-strong" />
                  ) : (
                    <Lock aria-label="未点亮" className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    data-testid={`badge-state-${badge.id}`}
                    className={cn(
                      "rounded-pill border px-2 py-0.5 text-caption",
                      earned
                        ? "border-border-strong text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {tone === "unknown" ? "状态未知" : earned ? "已点亮" : "未点亮"}
                  </span>
                </div>
                <h3 className="text-h3 text-primary">{badgeTitle(badge)}</h3>
                <p className="text-caption text-muted-foreground">{badgeDescription(badge)}</p>
              </li>
            );
          })}
        </ul>

        {hasUnknownBadges(badges) ? (
          <p className="mt-3 text-caption text-muted-foreground" data-testid="badge-unknown-note">
            列表里有本页还不认识的徽章，已原样展示。页面更新后可显示完整说明。
          </p>
        ) : null}
      </section>

      <p className="text-center">
        <Link to="/studio" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          去创作中心
        </Link>
      </p>
    </ArchetypeFrame>
  );
}

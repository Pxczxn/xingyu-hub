import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, MessageSquare } from "lucide-react";
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
import { ArchetypeFrame } from "@/components/layout";
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
 *
 * 骨架（A §3 `/me/*` 表 · Growth = SK3 · 壳/表/错）
 * -------------------------------------------------
 * H=壳：本页没有壳层（`/me/*` 是平铺路由，不是 `SettingsLayout`/`WorkbenchShell`
 *   那样的分区壳），按 A §7.2 的 **B 类**处理 —— 页内必须恰有 1 个 h1，且首块仍是
 *   内容、不许为此造横幅。所以 h1 走 `sr-only`（先例 `StudioAnalyticsPage.tsx:164`），
 *   视觉第一块直接是「创作数据」这条量化带。这正是 `ArchetypeFrame` 的
 *   `header="shell"` 语义：忽略 `headerSlot`、首块即 children。
 * D=表：主区是列对齐的量化带 + 对齐行（标签/数值/时间各占一列），没有逐项卡面。
 * R=错：`rail` 存在（SK3 的 `lg:[1fr|280px]`），右栏只放由本页已取回数据派生的
 *   概览，不新增请求。
 *
 * 五个区块各自的 loading / error 分支、`aria-label`（创作数据 / 待处理 / 徽章 /
 * 最近阅读 / 最近评论）与全部文案都原样保留：这一页的测试就是按 aria-label 取容器、
 * 按文案判断「区块没有消失」的。
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
    <ArchetypeFrame
      skeleton="SK3"
      header="shell"
      density="dense"
      rail={
        <GrowthRail
          badges={badges}
          history={history}
          comments={comments}
          pendingCount={pending.kind === "ready" ? dedupedPending.length : null}
        />
      }
      railLabel="成长侧栏"
    >
      {/* B 类壳：页内恰 1 个 h1，无视觉标题位（首块是量化带）时用 sr-only。 */}
      <h1 className="sr-only">成长记录</h1>

      {sessionExpired ? (
        <p className="text-meta text-muted-foreground">
          部分数据因登录状态过期无法读取。
          <Link to="/login" className="focus-ring ml-1 text-accent-strong hover:underline">
            去登录
          </Link>
        </p>
      ) : null}

      {/* ---- 创作数据（量化带：D=表，列对齐、无装饰、无逐项卡面） ---- */}
      <section aria-label="创作数据" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
          <h2 className="section-heading">创作数据</h2>
          <span className="text-caption text-muted-foreground">实时统计</span>
        </div>
        {insights.kind === "loading" ? (
          <p className="mt-3 text-body text-muted-foreground">正在读取…</p>
        ) : insights.kind === "error" ? (
          <p className="mt-3 text-body text-muted-foreground" role="alert">
            暂时无法读取创作数据，因此这里不显示任何数字。
          </p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 border-t border-border/70 sm:grid-cols-3">
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
        <section aria-label="待处理" className="min-w-0">
          <h2 className="section-heading">待处理</h2>
          <ul className="mt-3 border-t border-border/70">
            {dedupedPending.map((action, index) => {
              const href = resolvePendingHref(action);
              const label = pendingTitle(action);
              const count = pendingCounts.get(retainedPendingKey(action));
              return (
                <li
                  key={`${action.type}-${action.title}-${index}`}
                  className="border-b border-border/60 py-2.5 last:border-b-0"
                >
                  {href ? (
                    <Link
                      to={href}
                      className="focus-ring flex flex-wrap items-baseline justify-between gap-x-3 text-body text-foreground hover:text-accent-strong"
                    >
                      <span>{label}</span>
                      {count && count > 1 ? (
                        <span className="text-caption text-muted-foreground">
                          {pendingCountLabel(count)}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    // Real prompt, no route we ship — shown, but not as a dead link.
                    <div className="text-body text-muted-foreground">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span>{label}</span>
                        {count && count > 1 ? (
                          <span className="text-caption">{pendingCountLabel(count)}</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-caption">
                        该入口在本站尚未开放，可到创作中心查看。
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ---- 徽章 ---- */}
      <section aria-label="徽章" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-2">
          <h2 className="flex items-center gap-2 text-h3 text-primary">
            <Award className="h-4 w-4 text-muted-foreground" aria-hidden />
            徽章
          </h2>
          <Link to="/me/badges" className="focus-ring text-caption text-accent-strong hover:underline">
            查看全部
          </Link>
        </div>
        {badges.kind === "loading" ? (
          <p className="mt-3 text-body text-muted-foreground">正在读取…</p>
        ) : badges.kind === "error" ? (
          <p className="mt-3 text-body text-muted-foreground" role="alert">
            暂时无法读取徽章状态，因此这里不显示任何徽章。
          </p>
        ) : (
          <>
            <p className="mt-3 text-body text-muted-foreground">
              当前已点亮 {countEarned(badges.data)} / {badges.data.length} 枚
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sortForDisplay(badges.data).map((badge) => (
                <li
                  key={badge.id}
                  title={badge.description}
                  className={cn(
                    "rounded-pill border px-3 py-1 text-caption",
                    badge.earned
                      ? "border-border-strong text-primary"
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

      {/* ---- 最近阅读（D=表：标题 / 类型 / 时间 三列对齐） ---- */}
      <section aria-label="最近阅读" className="min-w-0">
        <h2 className="flex items-center gap-2 border-b border-border/70 pb-2 text-h3 text-primary">
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
          最近阅读
        </h2>
        {history.kind === "loading" ? (
          <p className="mt-3 text-body text-muted-foreground">正在读取…</p>
        ) : history.kind === "error" ? (
          <p className="mt-3 text-body text-muted-foreground" role="alert">
            暂时无法读取阅读记录，因此这里不显示任何条目。
          </p>
        ) : history.data.length === 0 ? (
          // The setting being off and "nothing read yet" produce the SAME empty
          // response, so we state both rather than asserting one.
          <p className="mt-3 text-body text-muted-foreground">
            没有阅读记录。可能是还没有读过内容，也可能是在设置里关闭了阅读历史记录。
          </p>
        ) : (
          <ul className="mt-3 border-t border-border/70">
            {history.data.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-border/60 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_96px_160px]"
              >
                <Link
                  to={contentHref({ id: item.id, objectType: item.objectType })}
                  className="focus-ring min-w-0 truncate text-body text-foreground hover:text-accent-strong"
                >
                  {item.title || item.id}
                </Link>
                <span className="hidden truncate text-caption text-muted-foreground sm:block">
                  {item.objectType}
                </span>
                <time className="shrink-0 text-caption tabular-nums text-muted-foreground">
                  {formatTime(item.updatedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- 最近评论 ---- */}
      <section aria-label="最近评论" className="min-w-0">
        <h2 className="flex items-center gap-2 border-b border-border/70 pb-2 text-h3 text-primary">
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          最近评论
        </h2>
        {comments.kind === "loading" ? (
          <p className="mt-3 text-body text-muted-foreground">正在读取…</p>
        ) : comments.kind === "error" ? (
          <p className="mt-3 text-body text-muted-foreground" role="alert">
            暂时无法读取评论记录，因此这里不显示任何条目。
          </p>
        ) : comments.data.length === 0 ? (
          <p className="mt-3 text-body text-muted-foreground">还没有发表过评论。</p>
        ) : (
          <ul className="mt-3 border-t border-border/70">
            {comments.data.map((comment) => (
              <li
                key={comment.id}
                className="border-b border-border/60 py-2.5 last:border-b-0"
              >
                <p className="text-body text-foreground">{comment.body}</p>
                <p className="mt-1 text-caption tabular-nums text-muted-foreground">
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
        {/*
          `/me/interests` was routed but unreachable: a page with no entry point
          is a page nobody opens (audit 2026-11-10). It belongs here because
          探索兴趣 is the same "know thyself" surface as badges / history, and it
          sits in the existing exits row rather than inventing a second pattern.
        */}
        <Link to="/me/interests" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          探索兴趣
        </Link>
      </p>
    </ArchetypeFrame>
  );
}

/**
 * 量化带单元格（D=表）。
 *
 * 与旧版 `rounded-md border p-3 text-center` 的差别就是「表」与「装饰网格」的差别：
 * 单元格自己不带独立卡面，只靠发丝线分隔、标签在上数值在下、数字 `tabular-nums`
 * 对齐 —— 这样六个数才能横向比大小。
 */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-r border-border/60 px-2 py-3 last:border-r-0">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-metric leading-none tabular-nums text-primary">{value}</dd>
    </div>
  );
}

/**
 * 右栏（R=错）：两块，全部由本页已经取回的四个 read 派生，不新增请求。
 *
 * `null` ≈ 「这一项没有读成功」，`undefined` ≈ 「还在读」—— 两者分开显示，因为
 * 这一页的全部意义就是「读失败不许伪装成 0」（见文件顶部 ⚠️）。因此这里不用
 * `—` 兜底：一个破折号恰好是那个被 §三·补9 点名的、错误与 0 共用的符号。
 */
function GrowthRail({
  badges,
  history,
  comments,
  pendingCount,
}: {
  badges: Section<BadgeView[]>;
  history: Section<ReadingHistoryItem[]>;
  comments: Section<MyCommentView[]>;
  pendingCount: number | null;
}) {
  const earned = badges.kind === "ready" ? countEarned(badges.data) : null;
  const earnedTitles = badges.kind === "ready" ? sortForDisplay(badges.data).filter((b) => b.earned) : [];

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="growth-rail-overview"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="growth-rail-overview" className="text-h3 text-primary">
          成长概览
        </h2>
        <dl className="mt-3 flex flex-col gap-2">
          <RailRow
            label="徽章点亮"
            value={earned === null ? (badges.kind === "error" ? "读取失败" : "读取中") : `${earned} 枚`}
          />
          <RailRow
            label="阅读记录"
            value={
              history.kind === "ready"
                ? `${history.data.length} 条`
                : history.kind === "error"
                  ? "读取失败"
                  : "读取中"
            }
          />
          <RailRow
            label="最近评论"
            value={
              comments.kind === "ready"
                ? `${comments.data.length} 条`
                : comments.kind === "error"
                  ? "读取失败"
                  : "读取中"
            }
          />
          <RailRow
            label="待处理"
            value={pendingCount === null ? "未读到" : `${pendingCount} 项`}
          />
        </dl>
      </section>

      {earnedTitles.length > 0 ? (
        <section
          aria-labelledby="growth-rail-badges"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="growth-rail-badges" className="text-h3 text-primary">
            已点亮徽章
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {earnedTitles.map((badge) => (
              /* 平文本，不是标题：徽章名在「徽章」区块里已经是条目文本，
                 这里只是索引副本，重复成标题会让同一句话在无障碍树里出现两次。 */
              <li key={badge.id} className="rounded-pill border border-border px-2 py-0.5 text-caption text-foreground-soft">
                {badgeTitle(badge)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-meta tabular-nums text-foreground-soft">{value}</dd>
    </div>
  );
}

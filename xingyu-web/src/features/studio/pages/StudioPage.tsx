import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenLine } from "lucide-react";
import type { ContentSummary } from "@/api/common.types";
import { homeApi } from "@/api/home/home.api";
import { meInsightsApi } from "@/api/moments/moments.api";
import type { InsightsView } from "@/api/moments/moments.types";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import {
  isSubmissionPending,
  submissionStatusLabel,
  submissionTitle,
} from "@/api/submissions/submissions.types";
import { ArchetypeFrame } from "@/components/layout";
import { useAuth } from "@/features/auth/auth.store";
import { formatArticleTime } from "@/features/studio/content-list";
import { staggerDelay } from "@/lib/stagger";

/*
 * Creation studio — entry hub.
 * Access is protected by the RequireAuth guard in the router (raised to the
 * pathless parent in 批次 06), so this page only renders for signed-in users.
 *
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 松 / R 齐
 * ------------------------------------------------
 *   SK3  `ArchetypeFrame skeleton="SK3"` 给出控制台栅格。这一页不传 `rail`，
 *        于是 frame 走 `SOLO.SK3`（单列、与内容列同宽同边）—— 那就是 R=齐。
 *   H=壳  `WorkbenchShell.tsx:15-29` 明写它只渲染 `[StudioNav | Outlet]`、
 *        **不输出任何 heading**（并被 `studio-2n-routes.test.tsx` 的反向断言钉住）。
 *        因此本页不能靠壳层拿标题，必须自己给恰好 1 个 `h1`；而 B 类壳的意义
 *        是「首块即内容」，视觉上不设大标题位，所以这个 h1 是 `sr-only`
 *        （A §7.2 / A §7.4 判定 5′，样板见 `StudioAnalyticsPage.tsx:164`）。
 *   D=松  每个可独立理解的东西是一张独立卡面，首屏不超过 3 块；卡内 padding 与
 *        卡间距走 `--density-card-pad` / `--density-list-gap`，由 frame 的
 *        `density="loose"` 重新指向 24 / 16 —— 也就是说 D 轴是这套变量在生效，
 *        不是各页各写一套数字（B §2 三档表是唯一来源）。
 *
 * 页面结构（P0 → P3）保持不变，这一批只改呈现层：
 *
 *   P0  继续创作 (most recent draft) + 写新文章  — same band, side by side
 *   P1  待处理事项 — compact rows, only when there is something waiting
 *   P2  数据概览 — one line of numbers, not six stat cards
 *   P3  (功能入口) — deliberately ABSENT, see the note at the foot of the file
 *
 * ⚠️ THREE INDEPENDENT READS, THREE INDEPENDENT DEGRADATIONS.
 * `getMyHome` / `listMine` / `meInsights` are fired in parallel and each keeps
 * its own state. A failed submissions list must not blank the draft card, and a
 * failed insights call must not blank either. This is the discipline
 * StudioAnalyticsPage documents for its secondary source, applied to all three.
 *
 * ⚠️ A FAILED READ SAYS SO. "loading" renders nothing (transient — announcing
 * it makes the page flicker), "error" renders a sentence naming what could not
 * be read. Folding the two together would make "you have nothing" and "we could
 * not find out" look identical, which is the exact Legacy failure the analytics
 * page was rewritten to fix.
 *
 * 2026-10-13 (批次 06, 设计方案 §3.6) — TASK-DRIVEN, not a card matrix. The page
 * used to be a welcome banner followed by SIX identical cards, one per
 * destination; a studio hub is opened to DO something, so it is ordered by what
 * the reader came to do and the six destinations stay in `StudioNav`.
 */

/** A remote read in one of exactly three states. See the degradation note above. */
type Remote<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: T };

/** 数据概览的四格。放在量化带上而不是六张卡：同一把尺子才可比（SK3 的量化带）。 */
const OVERVIEW: ReadonlyArray<{ key: keyof InsightsView; label: string; unit?: string }> = [
  // 口径：articleCount 只算 PUBLISHED（draftCount 才是 DRAFT，且含回收站），
  // 所以这里不摆草稿数 —— 同一页里出现两个不同口径的「文章数」比少一个数字更糟。
  // 完整六个数字在 /studio/analytics。
  { key: "articleCount", label: "已发布文章", unit: "篇" },
  { key: "likeCount", label: "获得喜欢" },
  { key: "commentCount", label: "收到评论" },
  { key: "followerCount", label: "粉丝" },
];

/**
 * Empty-string titles are real: `HomeService` falls back to 「未命名草稿」 only
 * when the draft ROW is missing, and `draft.getTitle()` itself can still be
 * blank. Never render an empty heading.
 */
function draftTitle(draft: ContentSummary): string {
  return draft.title?.trim() || "未命名草稿";
}

/** 松档卡面：白底 + 1px 发丝线，E0 无阴影（B §3 判据 2/3 —— 文档流内的卡永远不带 E1）。 */
const SURFACE = "rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]";

export function StudioPage() {
  const { user } = useAuth();

  const [draft, setDraft] = useState<Remote<ContentSummary | null>>({ kind: "loading" });
  const [pending, setPending] = useState<Remote<ReviewSubmissionDetailView[]>>({ kind: "loading" });
  const [insights, setInsights] = useState<Remote<InsightsView>>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    // P0 source. `draftArticles` is filtered to active-lifecycle DRAFT rows and
    // ordered `updated_at DESC` server-side (ArticleMapper.listByOwnerId), so
    // index 0 IS the most recently edited draft — no client-side sorting.
    homeApi
      .getMyHome()
      .then((home) => {
        if (active) setDraft({ kind: "ready", data: home.draftArticles[0] ?? null });
      })
      .catch(() => {
        if (active) setDraft({ kind: "error" });
      });

    // P1 source. NOT `getMyHome().pendingActions`: that array holds one entry
    // per IN_REVIEW article with a hardcoded title 「文章审核中」, no id, and
    // `href="/studio/reviewing"` — a route this app does not have. See
    // home.types.ts. Submissions carry the real title, a real id and a live
    // destination.
    submissionsApi
      .listMine()
      .then((rows) => {
        if (active) setPending({ kind: "ready", data: rows });
      })
      .catch(() => {
        if (active) setPending({ kind: "error" });
      });

    // P2 source. Secondary by definition: its failure degrades to one sentence.
    meInsightsApi
      .get()
      .then((data) => {
        if (active) setInsights({ kind: "ready", data });
      })
      .catch(() => {
        if (active) setInsights({ kind: "error" });
      });

    return () => {
      active = false;
    };
  }, []);

  const recentDraft = draft.kind === "ready" ? draft.data : null;
  const draftUpdatedAt = recentDraft?.updatedAt?.trim();
  // PENDING only — a decided submission is not "待处理". Empty ⇒ the whole
  // band is not rendered (see below).
  const waiting =
    pending.kind === "ready" ? pending.data.filter((item) => isSubmissionPending(item.status)) : [];

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="loose">
      {/* B 类壳：壳层没有 heading，页内必须恰好 1 个。视觉首块仍然是内容。 */}
      <h1 id="studio-title" className="sr-only">
        创作中心
      </h1>

      {/* ── P0 · 继续创作 + 新建 ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-[var(--density-list-gap)]" aria-labelledby="studio-title">
        <p className="max-w-prose text-meta leading-6 text-muted-foreground">
          {user?.username ? `${user.username}，欢迎回来。` : "欢迎回来。"}
          在这里管理你的文章、系列与投稿。
        </p>

        <div className="grid gap-[var(--density-grid-gap)] lg:grid-cols-[minmax(0,1fr)_minmax(0,272px)]">
          {draft.kind === "loading" ? (
            <div className={`flex flex-col justify-center ${SURFACE}`}>
              <p className="text-meta text-muted-foreground" role="status">
                正在读取草稿…
              </p>
            </div>
          ) : draft.kind === "error" ? (
            <div
              className={`flex flex-col justify-center gap-1.5 ${SURFACE}`}
              data-testid="draft-unavailable"
            >
              <p className="eyebrow">继续创作</p>
              <p className="text-meta leading-6 text-muted-foreground">
                暂时无法读取你的草稿，因此这里不显示最近编辑的一篇。你仍然可以直接写新文章。
              </p>
            </div>
          ) : recentDraft ? (
            // Whole card is the target. The action inside is a <span> styled as a
            // button — an <a> cannot nest inside an <a>.
            //
            // 这一张卡是整屏唯一「可点/继续」的独立卡面，所以给它唯一的强调面
            // （`bg-muted` 底 + 更实的边），而不是给页头调色。B §4：强调只做
            // 功能性的指示，不做整块彩色。
            <Link
              to={`/studio/content/${encodeURIComponent(recentDraft.id)}`}
              className="group card-lift focus-ring flex flex-col justify-between gap-4 rounded-card border border-border-strong/40 bg-muted/60 p-[var(--density-card-pad)] transition-colors hover:border-border-strong/70"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="eyebrow">继续创作</p>
                <p className="text-h3 break-words text-primary">{draftTitle(recentDraft)}</p>
                {draftUpdatedAt ? (
                  <p className="text-meta text-muted-foreground">
                    最近更新于 {formatArticleTime(draftUpdatedAt)}
                  </p>
                ) : null}
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-chip border border-border-strong/50 bg-card px-3 py-1.5 text-meta font-medium text-primary">
                继续编辑
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ) : (
            <div className={`flex flex-col justify-center gap-1.5 border-dashed ${SURFACE}`}>
              <p className="eyebrow">继续创作</p>
              <p className="text-meta leading-6 text-muted-foreground">
                还没有草稿。写下第一篇文章，它会出现在这里。
              </p>
            </div>
          )}

          <div className={`flex flex-col justify-center gap-4 ${SURFACE}`}>
            <p className="text-meta leading-6 text-muted-foreground">
              从一张空白页开始，写好后再决定什么时候提交。
            </p>
            <Link
              to="/studio/content/new"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-meta font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              写新文章
            </Link>
          </div>
        </div>
      </section>

      {/* ── P1 · 待处理事项 ─────────────────────────────────────────────── */}
      {pending.kind === "error" ? (
        <p className="text-meta text-muted-foreground" data-testid="pending-unavailable">
          暂时无法读取审核进度，因此这里不显示待处理事项。
        </p>
      ) : waiting.length > 0 ? (
        <section
          className="flex flex-col gap-[var(--density-heading-gap)]"
          aria-labelledby="studio-pending-title"
        >
          <h2 id="studio-pending-title" className="section-heading">
            待处理事项
          </h2>
          <ul
            aria-label="待处理事项"
            className="flex list-none flex-col gap-[var(--density-list-gap)] p-0"
          >
            {waiting.map((item, index) => (
              <li
                key={item.id}
                className="animate-rise-in flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-control border border-border/70 bg-card px-4 py-3"
                /* Inline, not a class: `animate-rise-in` resets `animation-delay`
                   whenever both land on the same element (lib/stagger.ts). */
                style={{ animationDelay: staggerDelay(index) }}
              >
                <span className="min-w-0 truncate text-meta text-primary">
                  {submissionTitle(item)}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-caption text-muted-foreground">
                  <span className="rounded-pill border border-border px-2 py-0.5">
                    {submissionStatusLabel(item.status)}
                  </span>
                  <Link
                    to={`/studio/submissions/${encodeURIComponent(item.id)}`}
                    className="focus-ring rounded-sm text-accent-strong hover:underline"
                  >
                    查看详情
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── P2 · 数据概览 ───────────────────────────────────────────────── */}
      <section
        className="flex flex-col gap-[var(--density-heading-gap)]"
        aria-labelledby="studio-insights-title"
      >
        <h2 id="studio-insights-title" className="section-heading">
          数据概览
        </h2>
        {insights.kind === "ready" ? (
          /* SK3 的量化带：一个面、被发丝线切开的格子（`gap-px` 压在边框色的底上，
             列数怎么变都不用逐格补边），而不是四张各自悬浮的卡。 */
          <div className="overflow-hidden rounded-card border border-border/70 bg-border/60">
            <ul aria-label="数据概览" className="grid grid-cols-2 gap-px sm:grid-cols-4">
              {OVERVIEW.map((metric) => (
                <li
                  key={metric.key}
                  className="bg-card px-4 py-3"
                >
                  <p className="text-meta text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-h2 tabular-nums text-primary">
                      {insights.data[metric.key]}
                    </span>
                    {metric.unit ? (
                      <span className="text-caption text-muted-foreground">{metric.unit}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : insights.kind === "error" ? (
          <p className="text-meta text-muted-foreground" data-testid="insights-unavailable">
            暂时无法读取数据概览。
          </p>
        ) : (
          <p className="text-meta text-muted-foreground" role="status">
            正在读取数据…
          </p>
        )}
      </section>

      {/*
        P3 · 功能入口 — NOT RENDERED, deliberately.

        设计方案 §3.6 asked for the six destinations to survive as "列表行或小按钮组，
        不再卡片矩阵". They do survive — in `StudioNav`, which the WorkbenchShell
        renders on this page and every other /studio route, in frequency order.

        Listing them again here would be the same information a second time, and
        would give the two copies identical accessible names ("我的系列" twice),
        which is both a duplicate-link annoyance for screen readers and an
        ambiguity for any role-based query.
      */}
      <Link
        to="/"
        className="focus-ring w-fit rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
      >
        返回首页
      </Link>
    </ArchetypeFrame>
  );
}

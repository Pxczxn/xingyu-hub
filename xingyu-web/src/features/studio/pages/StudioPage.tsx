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
import { useAuth } from "@/features/auth/auth.store";
import { formatArticleTime } from "@/features/studio/content-list";
import { staggerDelay } from "@/lib/stagger";

/*
 * Creation studio — entry hub.
 * Access is protected by the RequireAuth guard in the router (raised to the
 * pathless parent in 批次 06), so this page only renders for signed-in users.
 *
 * Phase 3G removed the last placeholder here. The article editor was shipped in
 * Phase 1C, but nothing linked to it — this hub pointed at a dead "已发布占位"
 * string because `/studio/content` (the list route) did not exist. That route
 * now exists, so the hub offers real entries: 新建文章 / 我的内容 / 我的系列.
 *
 * 2026-10-03 structure pass — ORDERED BY FREQUENCY, not by equal weight.
 *
 * 2026-10-13 (批次 06, 设计方案 §3.6) — TASK-DRIVEN, not a card matrix.
 *
 * The page used to be a welcome banner followed by SIX identical cards, one per
 * destination. Two problems, both recorded in the design doc:
 *
 *   1. A studio hub is opened to DO something. The most common intent is
 *      "write something" and the second is "go back to what I was writing" —
 *      both were competing with cards about analytics and invite links that a
 *      creator needs a few times a year.
 *   2. Six equal cards is a menu, not an answer. It moved the decision ("which
 *      of these six do I want?") onto the reader, on every single visit.
 *
 * Now the page is ordered by what the reader came to do:
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
 */

/** A remote read in one of exactly three states. See the degradation note above. */
type Remote<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: T };

/**
 * Empty-string titles are real: `HomeService` falls back to 「未命名草稿」 only
 * when the draft ROW is missing, and `draft.getTitle()` itself can still be
 * blank. Never render an empty heading.
 */
function draftTitle(draft: ContentSummary): string {
  return draft.title?.trim() || "未命名草稿";
}

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
    <div className="section-gap">
      {/* ── P0 · 继续创作 + 新建 ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-5" aria-labelledby="studio-title">
        <header className="flex flex-col gap-1.5">
          <p className="eyebrow">STUDIO</p>
          <h1 id="studio-title" className="text-2xl font-semibold tracking-tight text-primary">
            创作中心
          </h1>
          <p className="max-w-prose text-meta leading-6 text-muted-foreground">
            {user?.username ? `${user.username}，欢迎回来。` : "欢迎回来。"}
            在这里管理你的文章、系列与投稿。
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,272px)]">
          {draft.kind === "loading" ? (
            <div className="flex flex-col justify-center rounded-xl border border-border/70 bg-card p-5">
              <p className="text-meta text-muted-foreground" role="status">
                正在读取草稿…
              </p>
            </div>
          ) : draft.kind === "error" ? (
            <div
              className="flex flex-col justify-center gap-1.5 rounded-xl border border-border/70 bg-card p-5"
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
            // `card-lift` is honest here, but its own `:hover{border-color: --border}`
            // must not win: this card is gold at rest (`accent-soft` fill,
            // `accent-line/50` edge), so its hover has to sharpen the gold, not
            // neutralise it. `hover:border-accent-line` is emitted in the utilities
            // layer, which comes after the component layer `.card-lift` lives in, so
            // it does win. Deleting it would turn the card grey on hover.
            <Link
              to={`/studio/content/${encodeURIComponent(recentDraft.id)}`}
              className="group card-lift focus-ring flex flex-col justify-between gap-4 rounded-xl border border-accent-line/50 bg-accent-soft/40 p-5 hover:border-accent-line"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="eyebrow">继续创作</p>
                <p className="text-lg font-semibold leading-7 text-primary">
                  {draftTitle(recentDraft)}
                </p>
                {draftUpdatedAt ? (
                  <p className="text-meta text-muted-foreground">
                    最近更新于 {formatArticleTime(draftUpdatedAt)}
                  </p>
                ) : null}
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-accent-line bg-card px-3 py-1.5 text-meta font-medium text-accent-strong">
                继续编辑
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ) : (
            <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card/50 p-5">
              <p className="eyebrow">继续创作</p>
              <p className="text-meta leading-6 text-muted-foreground">
                还没有草稿。写下第一篇文章，它会出现在这里。
              </p>
            </div>
          )}

          <div className="flex flex-col justify-center gap-4 rounded-xl border border-border/70 bg-card p-5">
            <p className="text-meta leading-6 text-muted-foreground">
              从一张空白页开始，写好后再决定什么时候提交。
            </p>
            <Link
              to="/studio/content/new"
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-meta font-medium text-accent-foreground transition-opacity hover:opacity-90"
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
        <section className="flex flex-col gap-3" aria-labelledby="studio-pending-title">
          <h2 id="studio-pending-title" className="section-heading">
            待处理事项
          </h2>
          <ul aria-label="待处理事项" className="flex list-none flex-col gap-2 p-0">
            {waiting.map((item, index) => (
              <li
                key={item.id}
                className="animate-rise-in flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card px-4 py-3"
                /* Inline, not a class: `animate-rise-in` resets `animation-delay`
                   whenever both land on the same element (lib/stagger.ts). */
                style={{ animationDelay: staggerDelay(index) }}
              >
                <span className="min-w-0 truncate text-meta text-primary">
                  {submissionTitle(item)}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">
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
      <section className="flex flex-col gap-3" aria-labelledby="studio-insights-title">
        <h2 id="studio-insights-title" className="section-heading">
          数据概览
        </h2>
        {insights.kind === "ready" ? (
          <ul
            aria-label="数据概览"
            className="flex list-none flex-wrap items-center gap-x-6 gap-y-2 p-0 text-meta text-muted-foreground"
          >
            {/* 口径：articleCount 只算 PUBLISHED（draftCount 才是 DRAFT，且含回收站），
                所以这里不摆草稿数 —— 同一页里出现两个不同口径的「文章数」比少一个数字更糟。
                完整六个数字在 /studio/analytics。 */}
            <li>
              已发布文章{" "}
              <span className="text-base font-semibold text-primary">
                {insights.data.articleCount}
              </span>{" "}
              篇
            </li>
            <li>
              获得喜欢{" "}
              <span className="text-base font-semibold text-primary">
                {insights.data.likeCount}
              </span>
            </li>
            <li>
              收到评论{" "}
              <span className="text-base font-semibold text-primary">
                {insights.data.commentCount}
              </span>
            </li>
            <li>
              粉丝{" "}
              <span className="text-base font-semibold text-primary">
                {insights.data.followerCount}
              </span>
            </li>
          </ul>
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
        ambiguity for any role-based query. The rule that produced this decision
        is the one the design doc states for the shell: navigation lives in the
        shell, the page answers one question.
      */}
      <Link
        to="/"
        className="focus-ring w-fit rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
      >
        返回首页
      </Link>
    </div>
  );
}

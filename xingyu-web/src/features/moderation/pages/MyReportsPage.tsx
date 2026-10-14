import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import {
  objectTypeLabel,
  reportReasonLabel,
  reportStatusLabel,
  targetDescription,
  type UserReportView,
} from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * My reports — the moderation reports the session user filed.
 *
 * THIS IS A PERSONAL TRANSACTION RECORD, NOT A DASHBOARD.
 *
 * One row needs to answer four things and nothing else:
 *   举报了什么 · 当前状态 · 举报原因 · 时间
 * So there is deliberately NO total-count card, NO success-rate, NO
 * "已处理 X 条" summary strip. Those turn the user's record of an event they
 * personally submitted into a stats console they never asked for.
 *
 * The row never renders `targetId`: users do not read UUIDs, and a UUID standing
 * in for "what I reported" is not information — it is a system id wearing a
 * content's clothes. The subject is a server-resolved description instead
 * (`targetDescription`), and the type reads as 文章/动态/评论 via `objectTypeLabel`.
 *
 * TWO CONTRACT FACTS THAT SHAPE THIS PAGE:
 *
 * 1. `GET /me/reports` takes NO limit. One bounded read, no cursor, no pager.
 *
 * 2. The report status vocabulary is only SUBMITTED → CLOSED (TRIAGED also
 *    accepted). Unknown statuses are echoed verbatim, never mapped to a guess.
 *
 * The row is keyed by `report.id`. `updatedAt` is the CASE's timestamp when a
 * case exists, else the report's own createdAt — so it is labelled 「最近更新」,
 * which is the truthful claim.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; reports: UserReportView[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MyReportsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    reportsApi
      .listMine()
      .then((reports) => {
        if (active) setState({ kind: "ready", reports });
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
              : (state.detail ?? "无法读取你的举报记录，请稍后重试。")
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

  const { reports } = state;

  return (
    <div className="section-gap">
      {/*
        页头（2026-10-13，批次 08c）—— 去卡片，改成分隔线式。

        这里原本是一张 `rounded-lg border border-border bg-card p-5` 的卡片，装着
        标题和一句说明。方案 §4.6 给治理页组的原则是逐字的：「用户来举报和申诉
        不是来欣赏视觉设计的——状态与操作必须比装饰优先」。S9 的骨架定义是
        「状态卡 + 时间线/进度」，要的是**状态卡**；一张只装标题的卡不是状态卡，
        是装饰。页头卡 + 紧邻的列表卡还会在首屏叠成两张白面，正是 `PageMasthead`
        选型时记下的那个问题。

        全库另有 15 处卡片式页头，逐一查过：**零处**带「刻意保留」注释 —— 它们是
        存量，不是设计。批次 07 已为 /me/moments、/me/events 建好无表面页头，本批
        把同一条线走到治理页组。

        形态取 `border-b border-border/70 pb-5`：与 07 的 NotificationsPage、08a 的
        SettingsLayout 逐字相同，全库 8 处（含本批 08d 的 announcements / guide /
        rules 四页）都用它 —— 而不是 BookshelfPage 那种完全无装饰的裸 `<header>`，
        后者的 4 处都停在更早的形态上。

        h1 里的 lucide 图标一并去掉。全库 15 处带图标的 h1 **全部**落在卡片页头
        里，零反例；无卡片页头的 h1（含 NotificationsPage、SettingsLayout）全部
        无图标。图标是「卡片页头」这一形态的伴生物，不是标题的内容。「我的举报 /
        我的申诉」两页的区别由下面那个切换器承担，不靠图标。

        说明行进 `.lede`（`lede mt-2 max-w-2xl`）：与 PageMasthead / PageHeader /
        PageSection 三个共享页头组件、以及 settings 域八页逐字一致。

        卡片表面升到 `rounded-xl border border-border/70 bg-card` —— 批次 07 起的
        表面语言（见 MyMomentsPage 的注释）。列表标题行那条 `border-b border-border`
        保持全量不动：同一处注释讲过，外框 70% 配内部分隔全量，列表就该长这样，
        行才是结构，框只是边界。列表行也照批次 07 的语言错峰入场。
      */}
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">我的举报</h1>
        <p className="lede mt-2 max-w-2xl">你提交过的举报记录与处理进展。</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="举报与申诉">
        <span className={cn(buttonVariants({ variant: "accent" }), "text-sm")}>我的举报</span>
        <Link to="/appeals" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          我的申诉
        </Link>
      </nav>

      <section className="rounded-xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="section-heading">举报记录</h2>
          <span className="text-meta text-muted-foreground">按最近更新</span>
        </div>

        {reports.length === 0 ? (
          <div className="p-5">
            <PageState
              kind="empty"
              title="暂无举报记录"
              description="发现不当内容时，可以通过举报帮助维护社区。"
            />
          </div>
        ) : (
          <ul aria-label="我的举报列表" className="divide-y divide-border">
            {reports.map((report, index) => (
              <li
                key={report.id}
                className="animate-rise-in px-5 py-4"
                style={{ animationDelay: staggerDelay(index) }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {objectTypeLabel(report.targetType)}
                  </span>
                  {/* Echoes unknown statuses verbatim rather than guessing. */}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {reportStatusLabel(report.status)}
                  </span>
                </div>
                {/* The subject, as the server describes it — never a UUID. */}
                <Link
                  to={`/reports/${encodeURIComponent(report.id)}`}
                  className="mt-1 block text-sm font-medium text-foreground hover:text-accent-strong"
                >
                  {targetDescription(report)}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  举报原因：{reportReasonLabel(report.reason)}
                </p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  最近更新 {formatTime(report.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center">
        <Link to="/guide" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          查看社区规则
        </Link>
      </p>
    </div>
  );
}

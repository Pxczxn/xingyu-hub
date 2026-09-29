import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import { reportStatusLabel, type UserReportView } from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * My reports (Phase 2J-2) — the moderation reports the session user filed.
 *
 * TWO CONTRACT FACTS THAT SHAPE THIS PAGE:
 *
 * 1. `GET /me/reports` takes NO limit. `listMyReports` has no `@RequestParam`,
 *    so there is nothing to paginate and no cursor to follow. One bounded read.
 *
 * 2. THE STATUS MAP IS NOT LEGACY'S. Legacy maps PENDING / UNDER_REVIEW /
 *    RESOLVED / CLOSED, but the backend writes only SUBMITTED, TRIAGED and
 *    CLOSED (full-backend grep of `setStatus` on report/case/appeal). Legacy's
 *    map would therefore render 4 of its own labels as raw enums. V2 labels
 *    only what can occur and echoes anything unknown verbatim — see
 *    `reportStatusLabel`.
 *
 * The row is keyed by `report.id` (the report list has a real id, unlike likes).
 * `updatedAt` is the CASE's timestamp when a case exists, falling back to the
 * report's own createdAt — so it is labelled 「最近更新」 rather than 「提交时间」,
 * which would be a different (and wrong) claim.
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
              : (state.detail ?? "无法读取你的举报记录，请稍后重试。")
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

  const { reports } = state;

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          我的举报
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你提交过的举报记录与处理进展。举报与申诉入口同在，可切换到「我的申诉」查看申诉。
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="举报与申诉">
        <span className={cn(buttonVariants({ variant: "accent" }), "text-sm")}>我的举报</span>
        <Link to="/appeals" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          我的申诉
        </Link>
      </nav>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">举报记录</h2>
          <span className="text-xs text-muted-foreground">按最近更新</span>
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
            {reports.map((report) => (
              <li key={report.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)]">
                <time
                  dateTime={report.updatedAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(report.updatedAt)}
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {report.targetType}
                    </p>
                    {/* Echoes unknown statuses verbatim rather than guessing. */}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {reportStatusLabel(report.status)}
                    </span>
                  </div>
                  <Link
                    to={`/reports/${encodeURIComponent(report.id)}`}
                    className="mt-1 block truncate text-sm font-medium text-foreground hover:text-accent"
                  >
                    {report.targetId}
                  </Link>
                  <p className="mt-2 text-xs text-muted-foreground">
                    最近更新 {formatTime(report.updatedAt)}
                  </p>
                </div>
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


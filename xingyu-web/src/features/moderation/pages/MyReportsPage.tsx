import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          我的举报
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你提交过的举报记录与处理进展。
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
          <h2 className="section-heading">举报记录</h2>
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
              <li key={report.id} className="px-5 py-4">
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
                  className="mt-1 block text-sm font-medium text-foreground hover:text-accent"
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gavel } from "lucide-react";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import {
  APPEAL_LIST_LIMIT,
  appealStatusLabel,
  type AppealDetailView,
} from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * My appeals (Phase 2J-2) — appeals the session user filed against a measure.
 *
 * `GET /me/appeals` returns a BARE array (no cursor), so this is one bounded
 * read with no pagination control.
 *
 * `AppealDetailView` carries the appeal's own `caseId` but NOT the case's status
 * — there is no appeal→case-status field on this DTO. So the page shows the
 * appeal's own status and links to the case by id, and does not claim to know
 * how the case is progressing. (`/me/reports/{id}` is where a case status is
 * actually exposed, via `caseStatus`.)
 *
 * Only two appeal statuses can occur — SUBMITTED on create and DECIDED on
 * decision (ModerationService:176 / :347-349). Anything else is echoed as-is.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; appeals: AppealDetailView[] };

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

export function MyAppealsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    appealsApi
      .listMine(APPEAL_LIST_LIMIT)
      .then((appeals) => {
        if (active) setState({ kind: "ready", appeals });
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
              : (state.detail ?? "无法读取你的申诉记录，请稍后重试。")
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

  const { appeals } = state;

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Gavel className="h-5 w-5" aria-hidden />
          我的申诉
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          你对社区治理措施提交的申诉及裁定结果。
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="举报与申诉">
        <Link to="/reports" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          我的举报
        </Link>
        <span className={cn(buttonVariants({ variant: "accent" }), "text-sm")}>我的申诉</span>
      </nav>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">申诉记录</h2>
          {/* No "load more": the endpoint returns a bare array with no cursor. */}
          <span className="text-xs text-muted-foreground">最多 {APPEAL_LIST_LIMIT} 条</span>
        </div>

        {appeals.length === 0 ? (
          <div className="p-5">
            <PageState
              kind="empty"
              title="暂无申诉记录"
              description="如果你对某项治理措施有异议，可以提交申诉。"
            />
          </div>
        ) : (
          <ul aria-label="我的申诉列表" className="divide-y divide-border">
            {appeals.map((appeal) => (
              <li key={appeal.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)]">
                <time
                  dateTime={appeal.createdAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(appeal.createdAt)}
                </time>
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {appealStatusLabel(appeal.status)}
                  </span>
                  <Link
                    to={`/appeals/${encodeURIComponent(appeal.id)}`}
                    className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-foreground hover:text-accent"
                  >
                    {appeal.body?.trim() || "（无内容）"}
                  </Link>
                  {/* The appeal DTO has no case status — link by id, claim nothing. */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    关联案件 <span className="font-mono">{appeal.caseId}</span>
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

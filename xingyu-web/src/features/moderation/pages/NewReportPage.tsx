import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import type { ReportTargetView } from "@/api/moderation/moderation.types";
import { reportReasonLabel } from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * New report — context-driven since the Governance Contract Recovery pass.
 *
 * WHAT CHANGED AND WHY
 *
 * The old form let a user pick an object type from a dropdown and type a raw
 * object UUID into a text box. That is not a product — nobody knows a content
 * UUID by heart, and it let the user "report" arbitrary strings. Reporting must
 * start from the content itself: the article / moment / comment page opens this
 * route with `?objectType=...&objectId=...`, and everything the form shows about
 * the target comes from the SERVER (`GET /reports/target`), never from the URL.
 *
 * Visiting `/reports/new` without a target is a dead end, and says so: there is
 * no UUID field to fall back on, just a pointer back to where a report can
 * actually be started.
 *
 * The server re-verifies on submit (supported type, exists, not your own) — the
 * preview below is not a grant, only a description.
 */

const REASON_OPTIONS = [
  { value: "SPAM", label: reportReasonLabel("SPAM") },
  { value: "HARASSMENT", label: reportReasonLabel("HARASSMENT") },
  { value: "HATE_SPEECH", label: reportReasonLabel("HATE_SPEECH") },
  { value: "ILLEGAL", label: reportReasonLabel("ILLEGAL") },
  { value: "PLAGIARISM", label: reportReasonLabel("PLAGIARISM") },
  { value: "OTHER", label: reportReasonLabel("OTHER") },
] as const;

const OBJECT_TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  MOMENT: "动态",
  COMMENT: "评论",
};

function objectTypeLabel(type: string): string {
  return OBJECT_TYPE_LABELS[type] ?? type;
}

type TargetState =
  | { kind: "missing" }
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; notFound: boolean; conflict: boolean; detail: string | null }
  | { kind: "ready"; target: ReportTargetView };

export function NewReportPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const objectType = params.get("objectType") ?? "";
  const objectId = params.get("objectId") ?? "";

  const [target, setTarget] = useState<TargetState>(() =>
    objectType && objectId ? { kind: "loading" } : { kind: "missing" },
  );
  const [reason, setReason] = useState<string>("SPAM");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!objectType || !objectId) {
      setTarget({ kind: "missing" });
      return;
    }
    let active = true;
    setTarget({ kind: "loading" });

    reportsApi
      .previewTarget(objectType, objectId)
      .then((view) => {
        if (active) setTarget({ kind: "ready", target: view });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const problem = err instanceof ApiError ? err.problem : null;
        setTarget({
          kind: "error",
          expired: problem?.status === 401 || problem?.code === "AUTH_REQUIRED",
          notFound: problem?.status === 404,
          conflict: problem?.status === 409,
          detail: problem?.detail || null,
        });
      });

    return () => {
      active = false;
    };
  }, [objectType, objectId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || target.kind !== "ready") return;

    setSubmitting(true);
    setError(null);
    try {
      // Only the identity of the target is sent. The server resolves everything
      // else itself — no title/author is trusted from here.
      const created = await reportsApi.submit({
        objectType: target.target.objectType,
        objectId: target.target.objectId,
        reason,
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      });
      navigate(`/reports/${encodeURIComponent(created.reportId)}`);
    } catch (err: unknown) {
      const problem = err instanceof ApiError ? err.problem : null;
      setError(problem?.detail || "提交失败，请稍后重试。");
      setSubmitting(false);
    }
  }

  if (target.kind === "missing") {
    return (
      <div className="section-gap">
        <PageState
          kind="empty"
          title="请从需要举报的内容页面发起举报"
          description="举报必须针对具体内容。请打开要举报的文章、动态或评论，从那里的操作菜单发起。"
        />
        <p className="text-center">
          <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
            返回首页
          </Link>
        </p>
      </div>
    );
  }

  if (target.kind === "loading") return <PageState kind="loading" />;

  if (target.kind === "error") {
    const title = target.notFound
      ? "找不到要举报的内容"
      : target.conflict
        ? "无法举报这条内容"
        : "加载失败";
    const description = target.notFound
      ? "这条内容可能已被删除，或链接不完整。"
      : target.conflict
        ? (target.detail ?? "不能举报自己的内容。")
        : target.expired
          ? "登录状态已过期，请重新登录。"
          : (target.detail ?? "无法读取举报对象，请稍后重试。");
    return (
      <div className="section-gap">
        <PageState kind="error" title={title} description={description} />
        <p className="text-center">
          <Link to="/reports" className="text-sm text-accent hover:underline">
            返回我的举报
          </Link>
        </p>
      </div>
    );
  }

  const view = target.target;
  const authorName = view.authorDisplayName?.trim() || view.authorUsername || "未知作者";
  const authorHref = view.authorUsername ? `/u/${encodeURIComponent(view.authorUsername)}` : null;

  return (
    <div className="section-gap">
      <p>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回我的举报
        </Link>
      </p>

      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          提交举报
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          请基于事实填写。举报提交后，可在「我的举报」中查看处理进度。
        </p>
      </header>

      {/* The target, as the SERVER sees it. No UUID is shown or editable. */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="section-heading">举报对象</h2>
        <dl className="mt-3 flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">内容类型</dt>
            <dd className="mt-1 text-foreground">{objectTypeLabel(view.objectType)}</dd>
          </div>
          {view.title?.trim() ? (
            <div>
              <dt className="text-muted-foreground">标题</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">{view.title}</dd>
            </div>
          ) : null}
          {view.summary?.trim() ? (
            <div>
              <dt className="text-muted-foreground">内容摘要</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">{view.summary}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">作者</dt>
            <dd className="mt-1 text-foreground">
              {authorHref ? (
                <Link to={authorHref} className="text-accent hover:underline">
                  {authorName}
                </Link>
              ) : (
                authorName
              )}
            </dd>
          </div>
        </dl>
        {view.alreadyReported ? (
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            你已经举报过这条内容，再次提交不会重复创建记录。
          </p>
        ) : null}
      </section>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="report-reason" className="text-sm font-medium text-foreground">
              举报原因
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-detail" className="text-sm font-medium text-foreground">
              补充说明（可选）
            </label>
            <textarea
              id="report-detail"
              aria-label="补充说明"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className={cn(buttonVariants({ variant: "accent" }), "text-sm")}
            >
              {submitting ? "提交中…" : "提交举报"}
            </button>
            <Link to="/reports" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
              取消
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

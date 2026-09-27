import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Gavel } from "lucide-react";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * New appeal (Phase 2J-2) — `POST /api/v1/appeals`.
 *
 * AN APPEAL IS NOT FREE-STANDING. The server resolves an appealable measure
 * from `measureId` (direct) or `caseId` (that case's latest measure) and throws
 * a FIELD error 「未找到可申诉的治理措施」 when neither resolves. So this page
 * requires an existing case/measure, which it reads from the query string —
 * exactly the shape the report detail links with:
 *
 *   /appeals/new?caseId=<id>&measureId=<id>
 *
 * If neither parameter is present, the form is NOT rendered: there is nothing
 * the user could type that would succeed. Instead the page explains where to
 * start (open a report, and appeal only once a measure has been issued). That is
 * deliberately not a disabled-but-visible form — a form that can only ever fail
 * is the same偽-completion this codebase refuses elsewhere.
 *
 * `detail` is the only body field the server validates for content; it accepts
 * `body` as an alias, but this client sends `detail` only.
 */

export function NewAppealPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const caseId = params.get("caseId") ?? "";
  const measureId = params.get("measureId") ?? "";
  const hasTarget = caseId !== "" || measureId !== "";

  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Handler-level re-check: `disabled` only lands after a re-render, so an
    // implicit submit could otherwise get through and earn a server field error.
    if (!hasTarget) return;
    if (!detail.trim()) {
      setError("请填写申诉说明。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await appealsApi.submit({
        // Send only what we actually have; the server picks measureId first.
        ...(measureId ? { measureId } : {}),
        ...(caseId ? { caseId } : {}),
        detail: detail.trim(),
      });
      navigate(`/appeals/${encodeURIComponent(created.id)}`);
    } catch (err: unknown) {
      const problem = err instanceof ApiError ? err.problem : null;
      setError(problem?.detail || "提交失败，请稍后重试。");
      setSubmitting(false);
    }
  }

  return (
    <div className="section-gap">
      <p>
        <Link
          to="/appeals"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回申诉列表
        </Link>
      </p>

      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Gavel className="h-5 w-5" aria-hidden />
          提交申诉
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          如果你对某项治理措施有异议，可以在这里提交申诉并说明理由。
        </p>
      </header>

      {!hasTarget ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <PageState
            kind="empty"
            title="没有可申诉的处置"
            description="申诉只能针对已经作出的治理措施提交。请先打开一条举报，若其中显示了可申诉的处置，再从那里发起申诉。"
          />
          <p className="mt-4 text-center">
            <Link to="/reports" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
              查看我的举报
            </Link>
          </p>
        </section>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                关联案件 <span className="font-mono text-foreground">{caseId || "（未提供）"}</span>
              </p>
              {measureId ? (
                <p className="mt-1">
                  处置措施 <span className="font-mono text-foreground">{measureId}</span>
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="appeal-detail" className="text-sm font-medium text-foreground">
                申诉说明
              </label>
              <textarea
                id="appeal-detail"
                aria-label="申诉说明"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground"
                placeholder="请说明你认为该处置不当的理由"
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
                {submitting ? "提交中…" : "提交申诉"}
              </button>
              <Link to="/appeals" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
                取消
              </Link>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

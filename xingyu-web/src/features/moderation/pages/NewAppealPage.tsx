import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回申诉列表
        </Link>
      </p>

      {/*
        页头（2026-10-13，批次 08c）—— 与 /reports/new 同形：去卡片、去图标、改成
        分隔线式。完整判据见 MyReportsPage 的注释，这里不重复。

        本页与 /reports/new 是同一形态的两个实例（一个提交举报、一个提交申诉），
        所以两页的可用性修复也一致：申诉说明的 textarea 补 `.focus-ring`（原本
        Tab 进去看不出焦点），提交失败从裸 `<p className="text-sm text-destructive">`
        换成 `AuthFormError focusOnMount`（表单级失败，错误在表单底部，不聚焦用户
        看不到）。两条理由与 /reports/new 逐字相同。
      */}
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">提交申诉</h1>
        <p className="lede mt-2 max-w-2xl">
          如果你对某项治理措施有异议，可以在这里提交申诉并说明理由。
        </p>
      </header>

      {!hasTarget ? (
        <section className="rounded-xl border border-border/70 bg-card p-5">
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
        <form onSubmit={submit} className="rounded-xl border border-border/70 bg-card p-5">
          <div className="flex flex-col gap-4">
            {/*
             * 这里刻意不显示 caseId / measureId 的原始值。
             * 用户不认识 UUID，把它们打在屏幕上既不能帮助理解，又暴露了内部标识。
             * 真正有用的是「你在对哪一次处置提出异议」这句话本身；具体是哪条内容，
             * 提交后的申诉详情页会用服务端现查的「原处理对象」如实说明。
             */}
            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              你将针对一条已经作出的治理处置提交申诉。请在下面说明你的理由，提交后可以在申诉详情里看到处理进展与结果。
            </p>

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
                className="focus-ring mt-2 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground"
                placeholder="请说明你认为该处置不当的理由"
              />
            </div>

            {error ? <AuthFormError focusOnMount>{error}</AuthFormError> : null}

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

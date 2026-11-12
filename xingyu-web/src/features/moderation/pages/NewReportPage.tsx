import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import type { ReportTargetView } from "@/api/moderation/moderation.types";
import { reportReasonLabel } from "@/api/moderation/moderation.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
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
  /* Bumping the key replays the target-preview effect — the retry mechanism
     for the error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [objectType, objectId, reloadKey]);

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
        {/* Retry only when the read itself failed: a missing target has
            nothing to re-read, an expired session needs a fresh login, and a
            409 refusal is the server's verdict, not a transient fault. */}
        {!target.notFound && !target.expired && !target.conflict ? (
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        ) : null}
        <p className="text-center">
          <Link to="/reports" className="text-sm text-accent-strong hover:underline">
            返回我的举报
          </Link>
        </p>
      </div>
    );
  }

  const view = target.target;
  const authorName = view.authorDisplayName?.trim() || view.authorUsername || "未知作者";
  const authorHref = view.authorUsername ? `/u/${encodeURIComponent(view.authorUsername)}` : null;

  /*
    SK5 流程 · H=线 / D=松 / R=齐（`.team/design/A-archetypes.md` §3 的 NewReport 行）。

    这一页只有**一个终点动作**（提交举报），所以它是 SK5 而不是 SK3：

      H=线：`PageMasthead` 无面页头，替掉手写的 `<header>` + `text-2xl`（A §4 点名的 30 处之一）。
      D=松：两块（「举报对象」预览 + 表单）各是一张独立卡面，块间由 `density-loose` 给间距。
      R=齐：窄栏之内所有块同宽同边，没有侧轨、没有出血带。
      单步流程取 640 而不是 SK5 的默认 720（`className` 覆写 `SOLO.SK5` 的上限）—— 一个
        下拉 + 一个 textarea 撑到 720 只会让字段拉得过长。

    粘底操作条：`StepFlow` 把子内容硬编码成 `density-compact`（`StepFlow.tsx:111`），会抹掉本页
    声明的 D=松，所以这里只沿用它那条配方（`sticky bottom-0 z-rail` + 上发丝线 + 半透明 +
    `backdrop-blur`，同 SettingsReauthenticatePage 与 SeriesNewPage）。提交/取消两个控件仍在
    `<form>` 之内、仍是原来的 `<button type="submit">` 与 `<Link>`，校验与提交逻辑一行未动。
  */
  return (
    <ArchetypeFrame
      skeleton="SK5"
      header="line"
      density="loose"
      className="max-w-[640px]"
      headerSlot={
        <div className="flex flex-col gap-4">
          <p>
            <Link
              to="/reports"
              className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-meta text-muted-foreground hover:text-accent-strong"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              返回我的举报
            </Link>
          </p>
          <PageMasthead
            title="提交举报"
            description="请基于事实填写。举报提交后，可在「我的举报」中查看处理进度。"
          />
        </div>
      }
    >
      {/* The target, as the SERVER sees it. No UUID is shown or editable. */}
      <section className="rounded-card border border-border/70 bg-card p-5">
        <h2 className="section-heading">举报对象</h2>
        <dl className="mt-3 flex flex-col gap-4 text-body">
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
                <Link to={authorHref} className="text-accent-strong hover:underline">
                  {authorName}
                </Link>
              ) : (
                authorName
              )}
            </dd>
          </div>
        </dl>
        {view.alreadyReported ? (
          <p role="status" className="mt-4 text-meta text-muted-foreground">
            你已经举报过这条内容，再次提交不会重复创建记录。
          </p>
        ) : null}
      </section>

      <form onSubmit={submit} className="rounded-card border border-border/70 bg-card p-5">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="report-reason" className="text-body font-medium text-foreground">
              举报原因
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="focus-ring mt-2 w-full rounded-control border border-input bg-background p-2 text-body text-foreground"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-detail" className="text-body font-medium text-foreground">
              补充说明（可选）
            </label>
            <textarea
              id="report-detail"
              aria-label="补充说明"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              className="focus-ring mt-2 w-full rounded-control border border-input bg-background p-3 text-body text-foreground"
            />
          </div>

          {error ? <AuthFormError focusOnMount>{error}</AuthFormError> : null}

          {/* SK5 的粘底操作条：终端动作永远在视口底部，不随字段长度跑走。 */}
          <div className="sticky bottom-0 z-rail -mx-5 -mb-5 flex flex-wrap items-center gap-3 rounded-b-card border-t border-border/70 bg-card/95 px-5 py-3 backdrop-blur">
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
    </ArchetypeFrame>
  );
}

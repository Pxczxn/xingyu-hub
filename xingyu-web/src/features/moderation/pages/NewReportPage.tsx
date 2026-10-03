import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * New report (Phase 2J-2) — `POST /api/v1/reports`.
 *
 * NOTE the path: the write endpoint is the resource ROOT `/reports`, while the
 * read endpoints are `/me/reports`. That split is real (CommunityModerationController
 * vs CommunityMeController) and is the easiest thing to get wrong here.
 *
 * SERVER REQUIREMENTS (ModerationService.submitReport):
 *   objectType  required, non-blank, uppercased server-side
 *   objectId    required, non-blank
 *   reason      required, non-blank
 *   detail      optional, trimToNull-ed
 * The server accepts `targetType`/`targetId` as aliases, but this client sends
 * the canonical `objectType`/`objectId` names only — sending both would be noise.
 *
 * Creating a report ALSO opens a moderation case (status OPEN) transactionally,
 * so the success path can send the user straight to the detail page, where the
 * case id will already be visible.
 *
 * Validation is re-checked in the handler, not only via `disabled`: `disabled`
 * only lands after a re-render, so an implicit form submit (Enter) could
 * otherwise slip past it and produce a server field error.
 */

const OBJECT_TYPES = ["ARTICLE", "COMMENT", "MOMENT", "USER", "SERIES"] as const;

type ReasonOption = { value: string; label: string };

const REASONS: ReasonOption[] = [
  { value: "SPAM", label: "垃圾广告或刷屏" },
  { value: "HARASSMENT", label: "骚扰或人身攻击" },
  { value: "HATE_SPEECH", label: "仇恨或歧视言论" },
  { value: "ILLEGAL", label: "违法违规内容" },
  { value: "PLAGIARISM", label: "抄袭或侵权" },
  { value: "OTHER", label: "其他" },
];

export function NewReportPage() {
  const navigate = useNavigate();

  const [objectType, setObjectType] = useState<string>("ARTICLE");
  const [objectId, setObjectId] = useState("");
  const [reason, setReason] = useState("SPAM");
  const [detail, setDetail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Handler-level re-check (see the note at the top of the file).
    if (!objectType.trim() || !objectId.trim() || !reason.trim()) {
      setError("请填写对象类型、对象 ID 与举报原因。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await reportsApi.submit({
        objectType: objectType.trim(),
        objectId: objectId.trim(),
        reason: reason.trim(),
        // Omit rather than send "" — the server trimToNull-s it anyway, and an
        // absent key keeps the payload honest about what the user typed.
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      });
      navigate(`/reports/${encodeURIComponent(created.reportId)}`);
    } catch (err: unknown) {
      // Never report success on failure; keep what the user typed.
      const problem = err instanceof ApiError ? err.problem : null;
      setError(problem?.detail || "提交失败，请确认已登录并填写完整信息。");
      setSubmitting(false);
    }
  }

  return (
    <div className="section-gap">
      <p>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回举报列表
        </Link>
      </p>

      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          提交举报
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          举报是线索，处理结果会独立通知。请基于事实填写，避免恶意举报。
        </p>
      </header>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="report-object-type" className="text-sm font-medium text-foreground">
              对象类型
            </label>
            <select
              id="report-object-type"
              value={objectType}
              onChange={(e) => setObjectType(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
            >
              {OBJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-object-id" className="text-sm font-medium text-foreground">
              对象 ID
            </label>
            <input
              id="report-object-id"
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
              placeholder="被举报内容的 ID"
            />
          </div>

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
              {REASONS.map((option) => (
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

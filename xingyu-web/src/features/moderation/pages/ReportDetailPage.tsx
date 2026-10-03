import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import {
  hasCase,
  isReportOpen,
  reportStatusLabel,
  type ReportSupplementView,
  type UserReportDetailView,
} from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/*
 * Report detail (Phase 2J-2).
 *
 * The fields this page deliberately does NOT fake:
 *
 *  - `caseId` / `caseStatus` / `measureId` are nullable on the server. A report
 *    with no case yet has all three null, so 「关联案件」 is rendered ONLY when a
 *    case exists. An empty box or a "—" pretending to be a case id would be
 *    inventing structure the server did not send.
 *  - `measureId` is what makes an appeal possible. The 申诉 link is therefore
 *    shown only when `measureId` exists — and it carries both `caseId` and
 *    `measureId`, because `submitAppeal` resolves the measure from either.
 *    When there is no measure, no appeal link is rendered at all: an appeal
 *    without a measure cannot be submitted (the server throws
 *    「未找到可申诉的治理措施」), so offering the control would be a button that
 *    always fails.
 *  - 补充说明 is offered only while the report is open (`SUBMITTED`/`TRIAGED`) —
 *    the same guard the server enforces.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; notFound: boolean; detail: string | null }
  | { kind: "ready"; report: UserReportDetailView };

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function ReportDetailPage() {
  const { reportId = "" } = useParams<{ reportId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const [supplements, setSupplements] = useState<ReportSupplementView[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [supplementError, setSupplementError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    reportsApi
      .getById(reportId)
      .then((report) => {
        if (active) setState({ kind: "ready", report });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const problem = err instanceof ApiError ? err.problem : null;
        setState({
          kind: "error",
          expired: problem?.status === 401 || problem?.code === "AUTH_REQUIRED",
          // The server returns 404 both for "no such report" and "not yours".
          notFound: problem?.status === 404,
          detail: problem?.detail || null,
        });
      });

    return () => {
      active = false;
    };
  }, [reportId]);

  async function submitSupplement() {
    // Guard in the handler, not only on the button: `disabled` only lands after
    // a re-render, so Enter/rapid clicks could otherwise double-post.
    if (submitting) return;
    const body = draft.trim();
    if (!body) return;

    setSubmitting(true);
    setSupplementError(null);
    try {
      const created = await reportsApi.addSupplement(reportId, body);
      setSupplements((prev) => [...prev, created]);
      setDraft("");
    } catch (err: unknown) {
      // Failures keep the textarea content so nothing the user typed is lost.
      const detail = err instanceof ApiError ? err.problem.detail : null;
      setSupplementError(detail || "补充说明提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={state.notFound ? "找不到该举报" : "加载失败"}
          description={
            state.notFound
              ? "这条举报不存在，或者不属于当前账号。"
              : state.expired
                ? "登录状态已过期，请重新登录。"
                : (state.detail ?? "无法读取举报详情，请稍后重试。")
          }
        />
        <p className="text-center">
          <Link to="/reports" className="text-sm text-accent hover:underline">
            返回举报列表
          </Link>
        </p>
      </div>
    );
  }

  const { report } = state;
  const open = isReportOpen(report.status);
  const canAppeal = report.measureId != null && report.measureId !== "";

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
          举报详情
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {report.targetType} · <span className="font-mono">{report.targetId}</span>
        </p>
        {/* Unknown statuses echo verbatim rather than being guessed at. */}
        <p className="mt-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {reportStatusLabel(report.status)}
          </span>
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="section-heading">举报内容</h2>
        <dl className="mt-3 flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">举报原因</dt>
            <dd className="mt-1 whitespace-pre-wrap text-foreground">{report.reason}</dd>
          </div>
          {report.detail?.trim() ? (
            <div>
              <dt className="text-muted-foreground">补充说明</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">{report.detail}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">提交时间</dt>
            <dd className="mt-1 text-foreground">{formatTime(report.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">最近更新</dt>
            <dd className="mt-1 text-foreground">{formatTime(report.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Rendered only when a case exists — these fields are nullable server-side
          and must not be presented as an empty case. */}
      {hasCase(report) ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="section-heading">关联案件</h2>
          <dl className="mt-3 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">案件编号</dt>
              <dd className="mt-1 font-mono text-foreground">{report.caseId}</dd>
            </div>
            {report.caseStatus ? (
              <div>
                <dt className="text-muted-foreground">案件状态</dt>
                <dd className="mt-1 text-foreground">{report.caseStatus}</dd>
              </div>
            ) : null}
          </dl>

          {/* An appeal needs an appealable measure; without one the server
              refuses, so the link is withheld rather than dead. */}
          {canAppeal ? (
            <p className="mt-4">
              <Link
                to={`/appeals/new?caseId=${encodeURIComponent(report.caseId ?? "")}&measureId=${encodeURIComponent(
                  report.measureId ?? "",
                )}`}
                className="text-sm text-accent hover:underline"
              >
                对此处置提出申诉
              </Link>
            </p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              尚未对该案件作出处置，暂无可申诉的措施。
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="section-heading">补充说明</h2>

        {supplements.length > 0 ? (
          <ul aria-label="补充说明列表" className="mt-3 flex flex-col gap-3">
            {supplements.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3">
                <time
                  dateTime={item.createdAt}
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(item.createdAt)}
                </time>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {open ? (
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="report-supplement" className="text-xs text-muted-foreground">
              补充信息
            </label>
            <textarea
              id="report-supplement"
              aria-label="补充信息"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground"
            />
            {supplementError ? (
              <p role="alert" className="text-xs text-destructive">
                {supplementError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void submitSupplement()}
              disabled={submitting || draft.trim().length === 0}
              className={cn(
                "self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50",
              )}
            >
              {submitting ? "提交中…" : "提交补充说明"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">举报已关闭，无法再补充说明。</p>
        )}
      </section>
    </div>
  );
}

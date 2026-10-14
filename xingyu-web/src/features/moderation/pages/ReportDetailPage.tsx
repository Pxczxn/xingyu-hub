import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { reportsApi } from "@/api/moderation/moderation.api";
import {
  hasCase,
  isReportOpen,
  objectTypeLabel,
  reportReasonLabel,
  reportStatusLabel,
  targetDescription,
  type ReportSupplementView,
  type UserReportDetailView,
} from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthFormError } from "@/features/auth/components/AuthFormError";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * Report detail.
 *
 * LOCKED SECTION ORDER: 对象 → 当前状态 → 举报原因与举报说明 → 补充内容 →
 * 处理结果 → 时间. Sections appear in exactly that order; empty sections are
 * omitted rather than shown as empty boxes.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT DO:
 *
 *  - It never renders `targetId` / `caseId`. A UUID is not a description; the
 *    subject is shown as the server-resolved title/summary, the type as 文章/
 *    dynamic/comment. If the object is gone, the description says so.
 *  - `caseId` / `caseStatus` / `measureId` are nullable server-side. A report with
 *    no case yet renders NO 处理结果 case block — an empty box would invent
 *    structure the server did not send.
 *  - This page NEVER offers an appeal control. The reader of /reports/:id is, by
 *    definition, the reporter — never the affected party. Appeals are open only to
 *    the owner of the measure, and the server answers 404 to anyone else
 *    (verified: reporter POST /api/v1/appeals → 404 NOT_FOUND). So a measure here
 *    only means "a result exists"; the 处理结果 block states that and stops.
 *  - 补充说明 is offered only while the report is open (SUBMITTED / TRIAGED) —
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!active) return;
        setState({ kind: "ready", report });
        // Seed the supplement list from the persisted record. Without this the
        // list started empty and only ever grew from in-session POSTs, so every
        // previously written supplement vanished on reload — the write path had
        // no read path. The server returns them oldest-first.
        setSupplements(report.supplements);
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
  }, [reportId, reloadKey]);

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
        {/* Retry only when the read itself failed: a missing report has
            nothing to re-read, and an expired session needs a fresh login,
            not another request. */}
        {!state.notFound && !state.expired ? (
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        ) : null}
        <p className="text-center">
          <Link to="/reports" className="text-sm text-accent-strong hover:underline">
            返回举报列表
          </Link>
        </p>
      </div>
    );
  }

  const { report } = state;
  const open = isReportOpen(report.status);
  /**
   * Whether a measure was actually issued.
   *
   * NOTE: this is deliberately NOT called "canAppeal". This page is the
   * *reporter's* view of their own report, so the reader is never the affected
   * party and can never appeal — a measure here only means "a result exists".
   */
  const hasMeasure = report.measureId != null && report.measureId !== "";
  const caseExists = hasCase(report);

  return (
    <div className="section-gap">
      <p>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent-strong"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回举报列表
        </Link>
      </p>

      {/*
        页头（2026-10-13，批次 08c）—— 去卡片、去图标、改分隔线式。完整判据见
        MyReportsPage 的注释（方案 §4.6 逐字的「状态与操作必须比装饰优先」+ 全库 15
        处卡片式页头零处刻意保留 + 带图标的 h1 15/15 全落在卡片页头里），不重复。

        与列表页不同的是，这里的页头**兼作 §一「对象」**。LOCKED SECTION ORDER 把
        「对象」排在第一位，而这一页的身份恰恰就是「关于这条对象的举报」—— 把对象
        单独发一张卡，等于在首屏把同一件事说两遍，还叠出第二张白面。对象类型 + 服务
        端解析出的描述留在 h1 正下方，顺序不变，节数从六个减到五个。

        注意 h1 里那个 ShieldAlert 一并去掉（图标是卡片页头的伴生物，见上）。

        动效：本页的区块栈**刻意不做错峰**。EventDetailPage 的注释逐字写过这条判据
        ——「The four cards around it deliberately do NOT stagger: AppLayout already
        plays `animate-page-enter` on every route change, and a second entrance
        stacked on four fixed blocks would only make the page slower to read.」
        固定区块由 AppLayout 的 `animate-page-enter` 负责入场；本页只有「补充内容」
        那个列表长度未知，错峰留给了它的行。

        两处可用性修复（与 /reports/new、/appeals/new 同源）：
        1) 补充说明的 textarea 补 `.focus-ring` —— 原本 Tab 进去看不出焦点。
        2) 提交失败从裸 `<p role="alert" className="text-xs text-destructive">` 换成
           `AuthFormError`（AuthFormError 头部注释点名要消灭的三种漂移形态之一）。
           这里**不取 focusOnMount**：错误就出现在刚点的按钮正上方，读者视线还在原
           地，把焦点抢走反而把人从输入框上挪开 —— 与 focusOnMount 的适用条件
           （表单级失败、错误落在长表单底部）不符。
        3) 提交按钮原本是手写 class，**没有焦点环**（`buttonVariants` 自带
           `focus-visible:ring-2`）。换成 `buttonVariants({ variant: "accent" })`，
           与 /reports/new、/appeals/new 的提交按钮同形。
      */}
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">举报详情</h1>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {objectTypeLabel(report.targetType)}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{targetDescription(report)}</p>
      </header>

      {/* ② 当前状态 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">当前状态</h2>
        <p className="mt-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {reportStatusLabel(report.status)}
          </span>
        </p>
      </section>

      {/* ③ 举报原因与举报说明 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">举报原因与说明</h2>
        <dl className="mt-3 flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">举报原因</dt>
            <dd className="mt-1 whitespace-pre-wrap text-foreground">
              {reportReasonLabel(report.reason)}
            </dd>
          </div>
          {report.detail?.trim() ? (
            <div>
              <dt className="text-muted-foreground">举报说明</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">{report.detail}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* ④ 补充内容 —— 只是一份补充清单，不是时间线组件 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">补充内容</h2>

        {supplements.length > 0 ? (
          /* 全页唯一错峰的块：长度由服务端决定，见页头注释里的 EventDetailPage 判据。 */
          <ul aria-label="补充说明列表" className="mt-3 flex flex-col gap-3">
            {supplements.map((item, index) => (
              <li
                key={item.id}
                className="animate-rise-in rounded-md border border-border p-3"
                style={{ animationDelay: staggerDelay(index) }}
              >
                <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
                <time
                  dateTime={item.createdAt}
                  className="mt-1 block text-xs tabular-nums text-muted-foreground"
                >
                  {formatTime(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">暂无补充内容。</p>
        )}

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
              className="focus-ring w-full rounded-md border border-border bg-background p-3 text-sm text-foreground"
            />
            {supplementError ? <AuthFormError>{supplementError}</AuthFormError> : null}
            <button
              type="button"
              onClick={() => void submitSupplement()}
              disabled={submitting || draft.trim().length === 0}
              className={cn(buttonVariants({ variant: "accent" }), "self-start")}
            >
              {submitting ? "提交中…" : "提交补充说明"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">举报已关闭，无法再补充说明。</p>
        )}
      </section>

      {/* ⑤ 处理结果 —— 只在实际存在案件/措施时出现；只表达系统真正做过的。
          注意：本页是「我提交的举报」详情，读者按定义就是举报人，不是被处理方。
          所以这里绝不能给读者一个「提出申诉」入口 —— 申诉只对被措施的 owner 开放，
          服务端对其他人一律 404（已实测）。给举报人一个必然失败的按钮，就是把系统
          不存在的能力画到界面上。 */}
      {caseExists ? (
        <section className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="section-heading">处理结果</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {hasMeasure
              ? "该举报对应的案件已作出处置。被处理方可以对该处置提出申诉。"
              : "相关案件正在处理中，作出处置后这里会显示结果。"}
          </p>
        </section>
      ) : null}

      {/* ⑥ 时间 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">时间</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
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
    </div>
  );
}

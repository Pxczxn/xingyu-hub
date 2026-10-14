import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import {
  appealStatusLabel,
  measureTypeLabel,
  objectTypeLabel,
  targetDescription,
  type AppealDetailView,
} from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";

/*
 * Appeal detail (reworked by the Governance Static Design收敛 pass).
 *
 * LOCKED SECTION ORDER:
 *   原处理对象 / 原决定 → 我的申诉理由 → 最终结果 → 处理说明 → 时间
 *
 * The DTO now carries the whole chain: the original object (type + server-
 * resolved description) and the original measure kind, plus the decision
 * (status / outcome / decidedAt / decisionNote).
 *
 * WHAT THE RESULT SAYS — AND ONLY WHAT WAS TRULY EXECUTED:
 *
 *  - APPROVED means the reviewer approved the appeal, and `decideAppealQueue`
 *    then calls `measureExecutor.revoke(latestMeasure)`. So the original measure
 *    was actually undone — the page may say 「原处理措施已撤销」. It does NOT
 *    promise visibility beyond what the system did: reverting the measure is the
 *    executed fact, so that is what is stated.
 *  - REJECTED means no measure was touched — 「原处理继续有效」 is the executed
 *    fact.
 *  - PENDING means no decision exists yet; nothing about a result is claimed.
 *
 * It never renders `caseId` / `targetId`: reviewers' case ids and object UUIDs
 * are not the appellant's business, and a UUID is not a description of what was
 * moderated.
 *
 * What it deliberately still does NOT show: who decided. `decidedBy` exists on
 * the admin DTO but is not exposed to users.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; notFound: boolean; detail: string | null }
  | { kind: "ready"; appeal: AppealDetailView };

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function AppealDetailPage() {
  const { appealId = "" } = useParams<{ appealId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    appealsApi
      .getById(appealId)
      .then((appeal) => {
        if (active) setState({ kind: "ready", appeal });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const problem = err instanceof ApiError ? err.problem : null;
        setState({
          kind: "error",
          expired: problem?.status === 401 || problem?.code === "AUTH_REQUIRED",
          notFound: problem?.status === 404,
          detail: problem?.detail || null,
        });
      });

    return () => {
      active = false;
    };
  }, [appealId, reloadKey]);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={state.notFound ? "找不到该申诉" : "加载失败"}
          description={
            state.notFound
              ? "这条申诉不存在，或者不属于当前账号。"
              : state.expired
                ? "登录状态已过期，请重新登录。"
                : (state.detail ?? "无法读取申诉详情，请稍后重试。")
          }
        />
        {/* Retry only when the read itself failed: a missing appeal has
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
          <Link to="/appeals" className="text-sm text-accent-strong hover:underline">
            返回申诉列表
          </Link>
        </p>
      </div>
    );
  }

  const { appeal } = state;
  const decided = appeal.decidedAt != null;
  const approved = appeal.outcome === "APPROVED";
  const rejected = appeal.outcome === "REJECTED";
  const originalMeasure = measureTypeLabel(appeal.measureType);

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
        页头（2026-10-13，批次 08c）—— 与 /reports/:id 同形：去卡片、去图标、改分隔
        线式。完整判据见 MyReportsPage 的注释，这里不重复。两页详情必须逐字同形，
        理由与 /reports 和 /appeals 列表页相同：读者在同一套流程里来回走。

        页头兼作 §一「原处理对象 / 原决定」，与 /reports/:id 把「对象」并入页头是同
        一条理由 —— LOCKED SECTION ORDER 的第一节就是这一页的身份，单独发卡等于把
        同一件事在首屏说两遍。状态徽章留在 h1 正下方：测试逐字记着「已批准」在这里
        和「最终结果」各出现一次是刻意的，同一个词说同一件事。

        h1 里的 Gavel 一并去掉（图标是卡片页头的伴生物）。

        动效：本页**整页不错峰**。EventDetailPage 的注释逐字写过判据 —— AppLayout
        的 `animate-page-enter` 已经负责每次路由切换的入场，在一个长度固定的区块栈
        上再叠一层入场只会让页面更慢读完。本页五个区块全是固定的，也没有列表，所以
        一处 staggerDelay 都不加；/reports/:id 的补充说明列表是全库唯一例外，因为它
        的长度由服务端决定。
      */}
      <header className="border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">申诉详情</h1>
        <p className="mt-3">
          {/* The appeal's current status is always visible, decided or not. */}
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {appealStatusLabel(appeal.status)}
          </span>
        </p>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">原处理对象</dt>
            <dd className="mt-1 text-foreground">
              <span className="text-xs font-medium text-muted-foreground">
                {objectTypeLabel(appeal.targetType)}
              </span>
              <span className="ml-2">{targetDescription(appeal)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">原决定</dt>
            <dd className="mt-1 text-foreground">{originalMeasure ?? "无对应治理措施"}</dd>
          </div>
        </dl>
      </header>

      {/* ② 我的申诉理由 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">我的申诉理由</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{appeal.body}</p>
      </section>

      {/* ③ 最终结果 —— 只表达系统真正执行过的 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">最终结果</h2>
        {decided ? (
          <>
            <p className="mt-3">
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {appealStatusLabel(appeal.outcome)}
              </span>
            </p>
            <p className="mt-3 text-sm text-foreground">
              {approved
                ? "申诉已批准，原处理措施已撤销。"
                : rejected
                  ? "申诉已驳回，原处理继续有效。"
                  : "申诉已有结论。"}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            申诉正在处理中，处理完成后可在此查看结果。
          </p>
        )}
      </section>

      {/* ④ 处理说明 */}
      {decided ? (
        <section className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="section-heading">处理说明</h2>
          {appeal.decisionNote?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {appeal.decisionNote}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">未附处理说明。</p>
          )}
        </section>
      ) : null}

      {/* ⑤ 时间 */}
      <section className="rounded-xl border border-border/70 bg-card p-5">
        <h2 className="section-heading">时间</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">提交时间</dt>
            <dd className="mt-1 text-foreground">{formatTime(appeal.createdAt)}</dd>
          </div>
          {decided && appeal.decidedAt ? (
            <div>
              <dt className="text-muted-foreground">处理时间</dt>
              <dd className="mt-1 text-foreground">{formatTime(appeal.decidedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <p className="text-center">
        <Link to="/reports" className="text-sm text-accent-strong hover:underline">
          查看我的举报
        </Link>
      </p>
    </div>
  );
}

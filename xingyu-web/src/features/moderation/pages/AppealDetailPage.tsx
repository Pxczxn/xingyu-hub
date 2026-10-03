import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Gavel } from "lucide-react";
import { ApiError } from "@/api/client";
import { appealsApi } from "@/api/moderation/moderation.api";
import { appealStatusLabel, type AppealDetailView } from "@/api/moderation/moderation.types";
import { PageState } from "@/components/shared/PageState";

/*
 * Appeal detail (Phase 2J-2).
 *
 * `AppealDetailView` is five fields and nothing more: id, caseId, body, status,
 * createdAt. There is NO case status, NO decision text and NO measure on this
 * DTO — so this page shows the appeal's own record and links to the case by id,
 * and claims nothing about how the case is progressing. (The case status is
 * exposed on the REPORT detail, as `caseStatus`; that is the only place V2 can
 * read it.)
 *
 * Like the report detail, a 404 means either "gone" or "not yours" — the server
 * does not distinguish, so neither does the copy.
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
  }, [appealId]);

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
        <p className="text-center">
          <Link to="/appeals" className="text-sm text-accent hover:underline">
            返回申诉列表
          </Link>
        </p>
      </div>
    );
  }

  const { appeal } = state;

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
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <Gavel className="h-5 w-5" aria-hidden />
          申诉详情
        </h1>
        <p className="mt-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {appealStatusLabel(appeal.status)}
          </span>
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="section-heading">申诉内容</h2>
        <dl className="mt-3 flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">申诉说明</dt>
            <dd className="mt-1 whitespace-pre-wrap text-foreground">{appeal.body}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">提交时间</dt>
            <dd className="mt-1 text-foreground">{formatTime(appeal.createdAt)}</dd>
          </div>
          <div>
            {/* The DTO carries the case id but no case status — so only the id is
                shown. The case's own progress is not knowable from here. */}
            <dt className="text-muted-foreground">关联案件</dt>
            <dd className="mt-1 font-mono text-foreground">{appeal.caseId}</dd>
          </div>
        </dl>
      </section>

      <p className="text-center">
        <Link to="/reports" className="text-sm text-accent hover:underline">
          查看我的举报
        </Link>
      </p>
    </div>
  );
}

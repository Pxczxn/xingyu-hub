import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import type { MyGroupJoinRequest } from "@/api/messages/messages.types";
import { GROUP_JOIN_REQUEST_LIMIT } from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  groupIsGone,
  joinModeNote,
  joinRequestStatusLabel,
  requestConversationHref,
  requestKey,
  requestMessage,
  requestTitle,
  splitByPending,
} from "../group-join-requests";

/*
 * /me/requests — 关系请求 (Phase 3C)
 *
 * SCOPE, STATED HONESTLY: this page shows the group join requests the CALLER
 * SUBMITTED. Legacy's page title says "关系请求" but its own subtitle admits the
 * scope — "关注为开放模式；此处展示你发起的群聊入群申请". Following is open (no
 * approval), so there is nothing to approve there and no follow "request" exists
 * anywhere in the backend. The page is therefore about JOIN REQUESTS only, and
 * the copy says so rather than implying a general relationship inbox.
 *
 * WHAT THIS PAGE IS NOT: the group OWNER's approve/reject queue. That is
 * `/messages/group/{id}/join-requests` plus approve/reject writes, which this
 * phase does not ship (see `messagesApi` surface test). Showing a "去处理" affordance
 * here would be a control that cannot work.
 *
 * ⚠️ A MISSING GROUP TITLE IS REPORTED, NOT DECORATED. `conversationTitle` is null
 * only when the conversation row is gone (`ConversationService:177`), so those
 * rows say the group no longer exists and are NOT linked. Filing them under a
 * fabricated "群聊" name would hide a real state (§三·补9's rule).
 *
 * Note the DTO distinction this page depends on: `/me/group-join-requests` returns
 * `MyGroupJoinRequestView` (with title + resolvedAt), NOT the owner-side
 * `GroupJoinRequestView`. See the type's doc comment.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; requests: MyGroupJoinRequest[] };

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED");
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function GroupJoinRequestsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    messagesApi
      .listMyGroupJoinRequests()
      .then((requests) => {
        if (active) setState({ kind: "ready", requests });
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
              : (state.detail ?? "无法读取你的入群申请，请稍后重试。")
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

  const { pending, resolved } = splitByPending(state.requests);

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <UserPlus className="h-5 w-5" aria-hidden />
          关系请求
        </h1>
        {/* Scope stated up front — following is open, so only join requests exist. */}
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          这里显示你发起的群聊入群申请。关注是开放模式，不需要申请，所以不会出现在这里。
        </p>
      </header>

      {state.requests.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无入群申请"
          description="当你申请加入需要群主审批的群聊时，申请会显示在这里。"
        />
      ) : (
        <>
          {pending.length > 0 ? (
            <section aria-label="待处理" className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">待处理</h2>
                <span className="text-xs text-muted-foreground">{pending.length} 条</span>
              </div>
              <ul className="divide-y divide-border">
                {pending.map((request) => (
                  <RequestRow key={requestKey(request)} request={request} />
                ))}
              </ul>
            </section>
          ) : null}

          {resolved.length > 0 ? (
            <section aria-label="历史记录" className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">历史记录</h2>
                <span className="text-xs text-muted-foreground">{resolved.length} 条</span>
              </div>
              <ul className="divide-y divide-border">
                {resolved.map((request) => (
                  <RequestRow key={requestKey(request)} request={request} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {state.requests.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          最多显示 {GROUP_JOIN_REQUEST_LIMIT} 条最近记录。
        </p>
      ) : null}

      <p className="text-center">
        <Link to="/messages" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
          去消息中心
        </Link>
      </p>
    </div>
  );
}

function RequestRow({ request }: { request: MyGroupJoinRequest }) {
  const gone = groupIsGone(request);
  const href = requestConversationHref(request);
  const note = requestMessage(request);
  const modeNote = joinModeNote(request.joinMode);

  return (
    <li className="grid gap-2 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {gone ? (
            // The conversation row is gone — say so instead of inventing a name.
            <p className="text-sm text-muted-foreground" data-testid={`request-gone-${request.id}`}>
              该群聊已不存在
            </p>
          ) : (
            <p className="truncate text-sm font-medium text-foreground">{requestTitle(request)}</p>
          )}
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            申请于 {formatTime(request.createdAt)}
            {request.resolvedAt ? ` · 处理于 ${formatTime(request.resolvedAt)}` : ""}
          </p>
        </div>
        <span
          data-testid={`request-status-${request.id}`}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-xs",
            request.status === "PENDING"
              ? "border-accent/50 text-accent"
              : "border-border text-muted-foreground",
          )}
        >
          {joinRequestStatusLabel(request.status)}
        </span>
      </div>

      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

      {modeNote ? <p className="text-xs text-muted-foreground">{modeNote}</p> : null}

      {href ? (
        // V2 routes /messages/:conversationId for groups too (tries DIRECT, then
        // falls back to GROUP on 404) — unlike Legacy's unrouted /messages/group/{id}.
        <Link to={href} className="text-sm text-accent hover:underline">
          查看群聊
        </Link>
      ) : null}
    </li>
  );
}

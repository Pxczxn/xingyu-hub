import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type {
  CollaborationAcceptResult,
  CollaborationInviteResolve,
} from "@/api/collaboration/collaboration.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCEPTANCE_BOUNDARY_NOTE,
  acceptedHeadline,
  formatExpiry,
  inviterDisplayName,
  inviterSpaceHref,
  inviteProblem,
} from "../collaboration-invite";

/*
 * /studio/collaboration/accept?token=... — 确认协作邀请 (Phase 2M)
 *
 * ⚠️ THE WHOLE POINT OF THIS PAGE IS THE DISCLOSURE, NOT THE BUTTON.
 *
 * `POST /collaboration/invites/accept` writes nothing (see collaboration.types.ts
 * for the source-level audit: the service's only insert is the invite row itself,
 * the table has no accepted_by column, no collaborator table exists, and nothing
 * in the backend reads "who accepted"). So confirming the invite changes nothing
 * for either party.
 *
 * Legacy printed 「已接受协作邀请」 with a "查看协作空间" button that linked to
 * `/u/{username}/works` — a route that does not exist in V2, so the flow ended in
 * a 404 right after telling the user they had joined a collaboration. Both halves
 * of that are lies this page does not tell:
 *
 *   1. the copy says 「已确认邀请」 and repeats ACCEPTANCE_BOUNDARY_NOTE;
 *   2. the follow-up link goes to `/u/:username`, which DOES exist and already
 *      renders that user's public works.
 *
 * Two-phase load: resolve the token first (public, no session needed), and only
 * offer the accept button once the token is known good. Resolving does not
 * consume the token, so this is safe to do on mount.
 */

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  /** Resolved, but the token is unknown/expired — a normal 200 with valid:false. */
  | { kind: "invalid"; message: string }
  /** No token in the query string at all. */
  | { kind: "missing" }
  | { kind: "ready"; invite: CollaborationInviteResolve };

type AcceptState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "done"; result: CollaborationAcceptResult }
  | { kind: "failed"; message: string };

export function CollaborationAcceptPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";

  const [state, setState] = useState<State>({ kind: "loading" });
  const [accept, setAccept] = useState<AcceptState>({ kind: "idle" });
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      setState({ kind: "missing" });
      return;
    }

    setState({ kind: "loading" });
    collaborationApi
      .resolveInvite(token)
      .then((invite) => {
        if (!active) return;
        // `valid: false` rides on a 200 — branch on the field, not on a throw.
        const problem = inviteProblem(invite);
        setState(problem ? { kind: "invalid", message: problem } : { kind: "ready", invite });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error instanceof ApiError ? error.problem.status : 0;
        setState({
          kind: "error",
          message:
            status === 404
              ? "这个邀请链接已失效或不存在。请向邀请你的人索取新的链接。"
              : "暂时无法读取这条邀请，请稍后重试。",
        });
      });

    return () => {
      active = false;
    };
  }, [token]);

  const onAccept = useCallback(async () => {
    if (!token || pendingRef.current) return;
    pendingRef.current = true;
    setAccept({ kind: "pending" });
    try {
      const result = await collaborationApi.acceptInvite(token);
      setAccept({ kind: "done", result });
    } catch (error) {
      const status = error instanceof ApiError ? error.problem.status : 0;
      if (status === 401) {
        setAccept({ kind: "failed", message: "请先登录，再确认这条邀请。" });
      } else if (status === 409) {
        // 不能接受自己的邀请
        setAccept({ kind: "failed", message: "这是一条你自己发出的邀请。" });
      } else if (status === 404) {
        setAccept({ kind: "failed", message: "这个邀请链接已失效或不存在。" });
      } else {
        setAccept({
          kind: "failed",
          message:
            error instanceof ApiError && error.problem.detail?.trim()
              ? error.problem.detail
              : "确认邀请失败，请稍后重试。",
        });
      }
    } finally {
      pendingRef.current = false;
    }
  }, [token]);

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "missing") {
    return (
      <PageState
        kind="empty"
        title="缺少邀请链接"
        description="这个地址没有带上邀请凭证。请使用邀请人给你的完整链接打开。"
      />
    );
  }

  if (state.kind === "error" || state.kind === "invalid") {
    return (
      <PageState
        kind={state.kind === "invalid" ? "empty" : "error"}
        title={state.kind === "invalid" ? "邀请无效" : "邀请加载失败"}
        description={state.message}
      />
    );
  }

  const { invite } = state;
  const inviter = inviterDisplayName(invite);
  const expiry = formatExpiry(invite.expiresAt);

  if (accept.kind === "done") {
    const href = inviterSpaceHref(accept.result);
    return (
      <div className="section-gap">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-primary" data-testid="accept-headline">
            {acceptedHeadline(accept.result)}
          </h1>
        </header>

        {/* The disclosure is the headline's equal here, not a footnote: the user
            has just pressed a button labelled like a permission grant. */}
        <p
          role="status"
          data-testid="accept-boundary"
          className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {ACCEPTANCE_BOUNDARY_NOTE}
        </p>

        <Card>
          <CardContent className="flex flex-col gap-2 p-5">
            {invite.note?.trim() ? (
              <p className="text-sm text-muted-foreground">{inviter} 的留言：{invite.note}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{inviter} 没有留下备注。</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {/* ⚠️ `/u/:username` — NOT Legacy's `/u/:username/works`, which is not a
              route in V2. A missing username hides the button rather than
              rendering a link to /u/undefined. */}
          {href ? (
            <Link to={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              查看 {inviter} 的主页
            </Link>
          ) : null}
          <Link to="/studio" className={buttonVariants({ variant: "outline", size: "sm" })}>
            返回创作中心
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio" className="hover:text-foreground">
          创作中心
        </Link>
        <span aria-hidden="true"> / </span>
        <span>确认邀请</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">确认协作邀请</h1>
        <p className="text-sm text-muted-foreground">
          {inviter} 邀请你一起创作。确认前请先看完下面的说明。
        </p>
      </header>

      <p
        data-testid="accept-boundary"
        className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
      >
        {ACCEPTANCE_BOUNDARY_NOTE}
      </p>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">邀请人</dt>
              <dd className="font-medium text-foreground" data-testid="accept-inviter">
                {inviter}
              </dd>
            </div>
            {invite.note?.trim() ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">备注</dt>
                <dd className="whitespace-pre-wrap text-foreground">{invite.note}</dd>
              </div>
            ) : null}
            {expiry ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">有效期至</dt>
                <dd className="text-foreground">{expiry}</dd>
              </div>
            ) : null}
          </dl>

          {accept.kind === "failed" ? (
            <p
              role="alert"
              data-testid="accept-error"
              className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
            >
              {accept.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="accept-confirm"
              disabled={accept.kind === "pending"}
              onClick={() => void onAccept()}
            >
              {accept.kind === "pending" ? "确认中…" : "确认邀请"}
            </Button>
            <Link to="/studio" className={buttonVariants({ variant: "outline", size: "sm" })}>
              暂不处理
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type {
  CollaborationAcceptResult,
  CollaborationInviteResolve,
} from "@/api/collaboration/collaboration.types";
import { ArchetypeFrame, SectionRail } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
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
 * 骨架迁移（批次 D）：SK5 流程 · H 幅 / D 松 / R 错
 * --------------------------------------------------
 *   SK5  `ArchetypeFrame skeleton="SK5"` 给出居中窄栏；本页传 `className` 把上限
 *        抬到 880 —— 因为 R=错 需要在窄栏里再分出「主列 + 侧轨」，720 会让主列
 *        窄到读不动。宽度仍然只有一档（B §2：一页一档宽度）。
 *   H=幅：页头是 `PageHero`（有面横幅，自带 `h1`），页面不再手写标题，所以整页
 *        恰好 1 个 h1 —— 成功态的那句结果语因此是 `h2`，不是第二个 h1。
 *   D=松：主列是一张独立卡面，说明与操作都在卡内；块间 24 / 卡内 24。
 *   R=错：主列右侧 `SectionRail`（邀请人 / 备注 / 有效期），lg 起粘住。A §2 说的
 *        「主列+侧轨（sticky rail 或偏移网格）」就是它。`ArchetypeFrame` 对 SK5
 *        没有 `[1fr|rail]` 栅格（SK5 的窄栏不带轨），所以这里由页面自己排这一层
 *        两列，轨道本身仍然是共享的 `SectionRail`。
 *
 * Accept writes collaboration_member. The copy states the real grant: draft
 * edit, not submit/trash. The follow-up link is `/u/:username` (not Legacy's
 * missing `/u/:username/works`). Resolve is public and does not consume the
 * token, so it is safe on mount.
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
  const done = accept.kind === "done";

  return (
    <ArchetypeFrame
      skeleton="SK5"
      header="banner"
      density="loose"
      className="max-w-[880px]"
      headerSlot={
        <PageHero
          title="确认协作邀请"
          description={
            done
              ? `${inviter} 的邀请已确认。`
              : `${inviter} 邀请你一起创作。确认前请先看完下面的说明。`
          }
        />
      }
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The disclosure is the headline's equal here, not a footnote: the user
              has just pressed a button labelled like a permission grant. */}
          <p
            role={done ? "status" : undefined}
            data-testid="accept-boundary"
            className="rounded-control border border-border bg-surface-sunken/60 p-3 text-meta leading-6 text-muted-foreground"
          >
            {ACCEPTANCE_BOUNDARY_NOTE}
          </p>

          {done ? (
            <div className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]">
              <h2 data-testid="accept-headline" className="text-h2 break-words text-primary">
                {acceptedHeadline(accept.result)}
              </h2>

              {invite.note?.trim() ? (
                <p className="text-meta leading-6 text-muted-foreground">
                  {inviter} 的留言：{invite.note}
                </p>
              ) : (
                <p className="text-meta leading-6 text-muted-foreground">
                  {inviter} 没有留下备注。
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                {/* ⚠️ `/u/:username` — NOT Legacy's `/u/:username/works`, which is not a
                    route in V2. A missing username hides the button rather than
                    rendering a link to /u/undefined. */}
                {inviterSpaceHref(accept.result) ? (
                  <Link
                    to={inviterSpaceHref(accept.result) ?? "/studio"}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    查看 {inviter} 的主页
                  </Link>
                ) : null}
                <Link
                  to="/studio"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  返回创作中心
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]">
              {accept.kind === "failed" ? (
                <p
                  role="alert"
                  data-testid="accept-error"
                  className="rounded-control border border-destructive/40 bg-card p-3 text-meta text-destructive"
                >
                  {accept.message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  data-testid="accept-confirm"
                  disabled={accept.kind === "pending"}
                  onClick={() => void onAccept()}
                >
                  {accept.kind === "pending" ? "确认中…" : "确认邀请"}
                </Button>
                <Link
                  to="/studio"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  暂不处理
                </Link>
              </div>
            </div>
          )}
        </div>

        <SectionRail label="邀请信息">
          <dl className="density-loose flex flex-col gap-3 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)] text-meta">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">邀请人</dt>
              <dd className="font-medium text-foreground" data-testid="accept-inviter">
                {inviter}
              </dd>
            </div>
            {invite.note?.trim() ? (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">备注</dt>
                <dd className="whitespace-pre-wrap text-foreground">{invite.note}</dd>
              </div>
            ) : null}
            {expiry ? (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">有效期至</dt>
                <dd className="tabular-nums text-foreground">{expiry}</dd>
              </div>
            ) : null}
          </dl>
        </SectionRail>
      </div>
    </ArchetypeFrame>
  );
}

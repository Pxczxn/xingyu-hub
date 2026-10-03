import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/api/client";
import { collaborationApi } from "@/api/collaboration/collaboration.api";
import type { CollaborationInvite } from "@/api/collaboration/collaboration.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ACCEPTANCE_BOUNDARY_NOTE,
  INVITE_NOTE_MAX_LENGTH,
  absoluteInviteUrl,
  formatExpiry,
  inviteLifetimeHint,
  normalizeNote,
} from "../collaboration-invite";

/*
 * /studio/collaboration — 邀请协作 (Phase 2M)
 *
 * Creates a shareable invite link. That is ALL this page does, because that is
 * all the backend supports: `POST /me/collaboration-invites` inserts one row and
 * returns the token (see collaboration.types.ts for the full audit).
 *
 * ⚠️ THE PAGE STATES THE LIMIT OUT LOUD. The invite exists; the collaboration
 * does not. `acceptInvite` writes nothing and there is no relationship table, so
 * the user must not be led to believe that sending this link grants anyone
 * access. Legacy implied exactly that ("邀请协作者", "查看协作空间") and shipped a
 * button that 404'd. We keep the honest version.
 *
 * ⚠️ `inviteUrl` is RELATIVE (`/studio/collaboration/accept?token=...`). It is
 * made absolute here before being shown or copied — a bare path is not a link a
 * user can paste into a chat.
 */

type CreatedState =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "created"; invite: CollaborationInvite }
  | { kind: "failed"; message: string };

type CopyState = "idle" | "copied" | "failed";

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail?.trim() || fallback;
  }
  return fallback;
}

export function CollaborationInvitePage() {
  const [note, setNote] = useState("");
  const [state, setState] = useState<CreatedState>({ kind: "idle" });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const pendingRef = useRef(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pendingRef.current) return;
      pendingRef.current = true;
      setState({ kind: "creating" });
      setCopyState("idle");
      try {
        const invite = await collaborationApi.createInvite(normalizeNote(note));
        setState({ kind: "created", invite });
      } catch (error) {
        const status = error instanceof ApiError ? error.problem.status : 0;
        if (status === 401) {
          setState({ kind: "failed", message: "登录状态已过期，请重新登录后再试。" });
        } else {
          setState({ kind: "failed", message: describeError(error, "创建邀请失败，请稍后重试。") });
        }
      } finally {
        pendingRef.current = false;
      }
    },
    [note],
  );

  const shareUrl =
    state.kind === "created"
      ? absoluteInviteUrl(state.invite.inviteUrl, window.location.origin)
      : "";

  const copy = useCallback(async () => {
    try {
      // Copy the ABSOLUTE url, from state — never the relative path, and never
      // out of the DOM.
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [shareUrl]);

  const reset = useCallback(() => {
    setState({ kind: "idle" });
    setNote("");
    setCopyState("idle");
  }, []);

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio" className="hover:text-foreground">
          创作中心
        </Link>
        <span aria-hidden="true"> / </span>
        <span>邀请协作</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">邀请协作</h1>
        <p className="text-sm text-muted-foreground">生成一条邀请链接，发给你想一起创作的人。</p>
      </header>

      {/* The boundary notice sits ABOVE the form, not below it: the user should
          read what accepting does and does not do BEFORE they send the link. */}
      <p
        data-testid="collaboration-boundary"
        className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
      >
        {ACCEPTANCE_BOUNDARY_NOTE}
      </p>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="collaboration-note" className="text-sm font-medium text-foreground">
                邀请备注（可选）
              </label>
              <Input
                id="collaboration-note"
                data-testid="collaboration-note"
                value={note}
                maxLength={INVITE_NOTE_MAX_LENGTH}
                disabled={state.kind === "creating"}
                onChange={(event) => setNote(event.target.value)}
                placeholder="想先说明一下来意吗？"
              />
              <p className="text-xs text-muted-foreground">
                {note.length}/{INVITE_NOTE_MAX_LENGTH} 字，会随邀请一起展示给对方。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="default"
                size="sm"
                data-testid="collaboration-create"
                disabled={state.kind === "creating"}
              >
                {state.kind === "creating" ? "生成中…" : "生成邀请链接"}
              </Button>
              <span className="text-xs text-muted-foreground">{inviteLifetimeHint()}</span>
            </div>
          </form>
        </CardContent>
      </Card>

      {state.kind === "failed" ? (
        <p
          role="alert"
          data-testid="collaboration-error"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      ) : null}

      {state.kind === "created" ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5" data-testid="collaboration-result">
            <h2 className="section-heading">邀请链接已生成</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="collaboration-link" className="text-xs text-muted-foreground">
                邀请链接
              </label>
              <code
                id="collaboration-link"
                data-testid="collaboration-link"
                className="block break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
              >
                {shareUrl}
              </code>
            </div>

            {state.invite.note?.trim() ? (
              <p className="text-sm text-muted-foreground">备注：{state.invite.note}</p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {formatExpiry(state.invite.expiresAt)
                ? `有效期至 ${formatExpiry(state.invite.expiresAt)}`
                : "有效期由服务端决定，请尽快发送。"}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                data-testid="collaboration-copy"
                onClick={() => void copy()}
              >
                {copyState === "copied" ? "已复制" : "复制链接"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="collaboration-reset"
                onClick={reset}
              >
                再创建一条
              </Button>
            </div>

            {copyState === "copied" ? (
              <p data-testid="collaboration-copy-status" className="text-xs text-muted-foreground">
                已复制到剪贴板。
              </p>
            ) : null}
            {copyState === "failed" ? (
              <p
                role="alert"
                data-testid="collaboration-copy-status"
                className="text-xs text-destructive"
              >
                复制失败，请手动选中上面的链接复制。
              </p>
            ) : null}

            {/* Restates the limit next to the artifact the user is about to
                send, so the honest note cannot be missed by scrolling past it. */}
            <p className="text-xs text-muted-foreground">{ACCEPTANCE_BOUNDARY_NOTE}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ⚠️ There is deliberately NO "协作空间" / "协作者列表" link. The backend has
          no collaborator concept, so any such page would be empty by
          construction — and Legacy's version pointed at /u/:username/works,
          which is not a V2 route. */}

      <Link to="/studio" className="text-sm text-accent hover:underline">
        返回创作中心
      </Link>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { blockUser, unblockUser } from "@/features/blocks/blocked-users.store";
import { Button } from "@/components/ui/button";

/*
 * Block / unblock control for a public profile (Phase 2A-2a).
 *
 * Contract (verified live 2026-09-23 against UserBlockService):
 *   POST   /api/v1/me/blocks/{username}   -> 204 (idempotent)
 *   DELETE /api/v1/me/blocks/{username}   -> 204 (idempotent)
 *   blocking yourself                      -> 400 "username: 不能屏蔽自己"
 *
 * Blocking is a destructive relationship action, so it needs an explicit inline
 * confirmation (no window.confirm — that stays testable and keyboard-accessible,
 * matching the sessions page). The confirmation states exactly what the backend
 * does and nothing more: blocking removes any follow in both directions and stops
 * either side from opening a direct conversation or sending messages. It does NOT
 * hide the profile or its content, so the copy must not claim that.
 *
 * The label is owned by the caller (`blocked`): a failed request therefore leaves
 * the previous state untouched instead of showing a fake success.
 */
export function ProfileBlockControl({
  username,
  blocked,
  onRelationshipChanged,
}: {
  username: string;
  blocked: boolean;
  /** Called after a confirmed block/unblock with the new block state. */
  onRelationshipChanged: (nextBlocked: boolean) => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The duplicate-click guard lives in the handler (not only on `disabled`), so a
  // second synchronous invocation cannot slip through before React re-renders.
  const pendingRef = useRef(false);

  const run = useCallback(
    async (action: () => Promise<void>, nextBlocked: boolean) => {
      if (pendingRef.current) return; // duplicate-click guard
      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        await action();
        setConfirming(false);
        await onRelationshipChanged(nextBlocked);
      } catch (err) {
        // Keep the previous relationship state; only report the failure.
        setConfirming(false);
        setError(err instanceof ApiError ? err.problem.detail : "操作失败，请稍后重试");
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [onRelationshipChanged],
  );

  if (blocked) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          data-testid="profile-unblock"
          className="text-muted-foreground"
          onClick={() => void run(() => unblockUser(username), false)}
        >
          {pending ? "处理中" : "解除屏蔽"}
        </Button>
        {error ? (
          <span role="alert" data-testid="profile-block-error" className="text-sm text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {confirming ? (
        /*
         * 就地确认块，不是一行横幅。
         *
         * 上一版是 `flex flex-wrap items-center gap-2`：一句 24 字的事实说明 +
         * 「确认屏蔽」+「取消」摊成一整行。它作为身份区右侧操作区的一员时，这一行
         * 会把操作区从 156px 撑到 654px（1440/1920 实测同值），横向拉出一片只有
         * 文字的带子，而「关注」被留在最左端孤零零的 —— 主操作与破坏性确认挤在
         * 同一视觉层里。
         *
         * 现在收成一块：说明在上、按钮在下，整体限宽 `max-w-sm`、加淡底色与边框
         * 把它和常驻操作区分开。破坏性动作需要读者停顿，视觉上也应当是一个
         * 单独的、要处理的东西，而不是一条可以扫过去的提示。
         */
        <div
          data-testid="profile-block-confirm"
          className="flex w-full max-w-sm flex-col items-start gap-2.5 rounded-lg border border-border bg-surface-sunken px-3 py-2.5"
        >
          <span className="text-sm leading-5 text-muted-foreground">
            屏蔽后，你们之间的关注关系会被解除，双方无法互发私信。确认屏蔽？
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              data-testid="profile-block-confirm-button"
              onClick={() => void run(() => blockUser(username), true)}
            >
              {pending ? "处理中" : "确认屏蔽"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              data-testid="profile-block-cancel"
              onClick={() => setConfirming(false)}
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          data-testid="profile-block"
          onClick={() => setConfirming(true)}
        >
          屏蔽此用户
        </Button>
      )}
      {error ? (
        <span role="alert" data-testid="profile-block-error" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

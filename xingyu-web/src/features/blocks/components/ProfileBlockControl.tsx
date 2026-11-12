import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { blockUser, unblockUser } from "@/features/blocks/blocked-users.store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/*
 * Block / unblock control for a public profile (Phase 2A-2a).
 *
 * Contract (verified live 2026-09-23 against UserBlockService):
 *   POST   /api/v1/me/blocks/{username}   -> 204 (idempotent)
 *   DELETE /api/v1/me/blocks/{username}   -> 204 (idempotent)
 *   blocking yourself                      -> 400 "username: 不能屏蔽自己"
 *
 * Blocking is a destructive relationship action, so it needs an explicit
 * confirmation (no window.confirm — that stays testable and keyboard-accessible,
 * matching the sessions page). 浮层统一（第四轮）后确认框走 `components/ui/dialog`
 * （role="alertdialog"）：Esc、焦点陷阱、滚动锁与关闭后的焦点归位都由基础件提供，
 * 不再是一个挂了 aria-modal 却没有遮罩、也没有焦点管理的行内块。
 * The confirmation states exactly what the backend
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
      {/*
       * 浮层统一：确认框收敛到 `components/ui/dialog`（role="alertdialog"）。
       *
       * 上一版是就地展开的行内确认块：它作为身份区右侧操作区的一员时，会把
       * 操作区从 156px 撑到 654px（1440/1920 实测同值），横向拉出一片只有
       * 文字的带子，而「关注」被留在最左端孤零零的 —— 主操作与破坏性确认挤在
       * 同一视觉层里。但那个块挂了 aria-modal，实际却不遮罩、不锁焦点、不锁滚动，
       * 语义和行为对不上。
       *
       * 改成真正的模态后，说明/按钮各自成层，不再挤压常驻操作区；Esc 与点击遮罩
       * 等于取消（不会静默执行破坏性动作），焦点陷阱与滚动锁由 Radix 提供，
       * 关闭后焦点回到「屏蔽此用户」触发按钮。错误仍显示在触发按钮下方。
       */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="profile-block"
          >
            屏蔽此用户
          </Button>
        </DialogTrigger>
        <DialogContent
          role="alertdialog"
          data-testid="profile-block-confirm"
          className="max-w-sm rounded-xl bg-card"
        >
          <DialogTitle className="text-base font-semibold text-primary">
            确认屏蔽此用户？
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            屏蔽后，你们之间的关注关系会被解除，双方无法互发私信。
          </DialogDescription>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              data-testid="profile-block-cancel"
              onClick={() => setConfirming(false)}
            >
              取消
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error ? (
        <span role="alert" data-testid="profile-block-error" className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

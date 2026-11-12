import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * Submit-for-review confirmation (Phase 1C-3).
 *
 * Submitting is effectively irreversible from the creator side: the backend
 * flips the article to IN_REVIEW and `canEditDraft` then rejects every further
 * save with 409 "文章当前不可编辑" (verified against the live backend). A confirm
 * step is therefore required — but kept deliberately plain, per the phase brief:
 * no multi-step wizard, no extra options.
 *
 * 浮层统一（第四轮）：改用 `components/ui/dialog`（Radix）——Portal、焦点陷阱、
 * Esc、滚动锁与关闭后焦点归位都由基础件提供，替代原来的手写 fixed 覆盖层与
 * z-210。提交中（busy）时不允许通过 Esc / 关闭按钮退出，因为那时取消按钮也是
 * disabled：这与改动前的语义一致（请求在飞时唯一能等的是它自己结束）。
 * 关闭后焦点回到打开弹窗前的元素（编辑器工具栏的“提交审核”按钮），做法与
 * `SeriesLeaveGuard` 的 previousFocusRef 相同。
 */

type EditorSubmitConfirmProps = {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function EditorSubmitConfirm({
  open,
  busy = false,
  onCancel,
  onConfirm,
}: EditorSubmitConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 提交在飞时不允许关闭：取消按钮此刻也是 disabled，语义保持一致。
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        // 让可访问名沿用既有 `aria-label`，同时仍然渲染可见的 DialogTitle。
        aria-label="确认提交审核"
        aria-labelledby={undefined}
        className="max-w-sm rounded-xl bg-card"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="text-base font-semibold text-primary">确认提交审核？</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-muted-foreground">
          提交后文章进入审核流程，审核期间不可再编辑。
        </DialogDescription>
        <DialogFooter className="gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "提交中…" : "确认提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * Unsaved-changes protection (Phase 1C-2).
 *
 * Two independent layers, both official:
 *
 *  1. Browser close / reload / hard navigation -> `beforeunload`, registered
 *     only while the editor is dirty, so a clean editor never prompts.
 *
 *  2. In-app SPA navigation -> React Router's `useBlocker`. This is the official
 *     blocking capability and it REQUIRES a data router, which is why
 *     src/app/App.tsx now mounts `createBrowserRouter` + `RouterProvider`.
 *     No history monkey-patching anywhere.
 *
 * `useBlocker` only reports that a navigation is pending; the app owns the UI.
 * That is why this renders its own confirmation dialog instead of relying on a
 * native `window.confirm` — which also makes the behaviour testable in jsdom.
 *
 * 浮层统一（第四轮）：模态改用 `components/ui/dialog`（Radix）——Portal、焦点陷阱、
 * Esc 关闭、滚动锁、关闭后焦点归位都由基础件提供，不再手写 fixed 覆盖层与
 * z-200 的层级。Esc / 点击遮罩走的都是 `onOpenChange(false)` => `blocker.reset()`
 * （“留在本页”），与显式点“留在本页”等价；“放弃修改并离开”是唯一的破坏性出口，
 * 所以它用 `variant="destructive"` 且排在右侧。可访问名保持原 `aria-label`
 * （`未保存的修改`），标题文案不变 —— 现有编辑页测试按这个名字定位弹窗。
 */

export function EditorLeaveGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when);
  const stayRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!when) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Legacy browsers require returnValue to be set to trigger the prompt.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [when]);

  if (blocker.state !== "blocked") return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <DialogContent
        role="alertdialog"
        // 让可访问名沿用既有 `aria-label`，同时仍然渲染可见的 DialogTitle。
        aria-label="未保存的修改"
        aria-labelledby={undefined}
        className="max-w-sm rounded-xl bg-card"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          stayRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="text-base font-semibold text-primary">有未保存的修改</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-muted-foreground">
          离开当前页面会丢失这些修改，确定要离开吗？
        </DialogDescription>
        <DialogFooter className="gap-2">
          <Button ref={stayRef} type="button" variant="outline" onClick={() => blocker.reset?.()}>
            留在本页
          </Button>
          <Button type="button" variant="destructive" onClick={() => blocker.proceed?.()}>
            放弃修改并离开
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

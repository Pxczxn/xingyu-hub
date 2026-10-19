import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/*
 * Unsaved-changes protection for the creator workbench (Phase 5).
 *
 * Two layers, both official:
 *
 *  1. In-app navigation (links, back/forward) -> React Router's `useBlocker`.
 *     The app owns the UI; this component renders the confirmation.
 *  2. Browser refresh / tab close / hard navigation -> `beforeunload`, attached
 *     only while the page is actually dirty.
 *
 * The previous editor implementation is the precedent; this version adds the
 * a11y bits a standalone page needs (focus lands on "留在本页", Escape means
 * "stay", labelled title/description) and keeps a single dialog instance, so a
 * save retry or a failed reload cannot stack two prompts.
 */
export function SeriesLeaveGuard({
  when,
  title = "有未保存的修改",
  description = "离开当前页面会丢失这些修改，确定要离开吗？",
}: {
  when: boolean;
  title?: string;
  description?: string;
}) {
  const blocker = useBlocker(when);
  const stayRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!when && blocker.state === "blocked") blocker.proceed();
  }, [when, blocker]);

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
        <DialogTitle className="text-base font-semibold text-primary">{title}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-muted-foreground">
          {description}
        </DialogDescription>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={stayRef} type="button" variant="outline" onClick={() => blocker.reset?.()}>
            留在本页
          </Button>
          <Button type="button" variant="destructive" onClick={() => blocker.proceed?.()}>
            放弃修改并离开
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import styles from "./editor-workspace.module.css";
import { cn } from "@/lib/cn";

import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
 */

export function EditorLeaveGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when);

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
    <div
      className={cn(styles.leaveGuard)}
      role="alertdialog"
      aria-modal="true"
      aria-label="未保存的修改"
    >
      <div className={cn(styles.leaveGuardCard)}>
        <h2>有未保存的修改</h2>
        <p>离开当前页面会丢失这些修改，确定要离开吗？</p>
        <div className={cn(styles.leaveGuardActions)}>
          <Button type="button" variant="outline" onClick={() => blocker.reset?.()}>
            留在本页
          </Button>
          <Button type="button" onClick={() => blocker.proceed?.()}>
            放弃修改并离开
          </Button>
        </div>
      </div>
    </div>
  );
}

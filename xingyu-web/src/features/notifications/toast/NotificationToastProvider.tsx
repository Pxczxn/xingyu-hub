import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import {
  NotificationToastContext,
  type NotificationToastContextValue,
} from "./notification-toast.context";
import {
  NOTIFICATION_TOAST_EXIT_MS,
  NOTIFICATION_TOAST_MAX,
  type NotificationToast,
  type NotificationToastInput,
} from "./notification-toast.types";

/*
 * Notification toast provider.
 *
 * Holds the stack. Three rules it enforces so no caller has to remember them:
 *
 *   1. **Bounded stack.** At most NOTIFICATION_TOAST_MAX are on screen; a new one
 *      evicts the oldest. An unbounded stack covers the page it is reporting on.
 *   2. **Real exit animation.** Dismissal flips `open` to false and unmounts only
 *      after NOTIFICATION_TOAST_EXIT_MS. Unmounting immediately — the obvious
 *      implementation — makes every toast vanish instantly and the animation
 *      never runs, which is the difference between "polished" and "flickers".
 *   3. **Stable identity.** `push` is a ref-backed callback with no dependency on
 *      the stack, so a caller can put it in a `useEffect` dependency list or an
 *      event handler without re-subscribing on every toast.
 *
 * Auto-dismiss timing is Radix's job, not ours: it already pauses the timer while
 * the pointer is over the toast or the window is unfocused, which is the
 * behaviour a hand-rolled `setTimeout` gets wrong.
 */
export function NotificationToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const sequenceRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Every pending unmount timer is cleared on teardown, so a toast scheduled to
  // disappear cannot fire a state update after the provider is gone.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    // Flip to closed first — that is what drives the exit transition.
    setToasts((prev) => prev.map((toast) => (toast.id === id ? { ...toast, open: false } : toast)));
    if (timersRef.current.has(id)) return;
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, NOTIFICATION_TOAST_EXIT_MS);
    timersRef.current.set(id, timer);
  }, []);

  const push = useCallback((input: NotificationToastInput) => {
    sequenceRef.current += 1;
    const id = `nt-${sequenceRef.current}`;
    setToasts((prev) => {
      const next = [...prev, { ...input, id, open: true }];
      // Evict the oldest beyond the cap. They are dropped, not animated out —
      // they are already off the visible stack.
      return next.length > NOTIFICATION_TOAST_MAX
        ? next.slice(next.length - NOTIFICATION_TOAST_MAX)
        : next;
    });
    return id;
  }, []);

  const dismissAll = useCallback(() => {
    setToasts((prev) => prev.map((toast) => ({ ...toast, open: false })));
    const timer = setTimeout(() => {
      setToasts([]);
    }, NOTIFICATION_TOAST_EXIT_MS);
    // Tracked under a reserved key so it is cleared on teardown like the rest.
    timersRef.current.set("__all__", timer);
  }, []);

  /*
   * DEV-only escape hatch.
   *
   * A floating toast is otherwise very hard to trigger on demand — it needs a
   * live socket frame from another account — which makes the stack awkward to
   * design-review, screenshot or QA. This exposes `push` so a developer can do
   *   __xingyuNotify({ category: "LIKE", title: "…", body: "…" })
   * from the console. Guarded by `import.meta.env.DEV`, so the whole block is
   * dead-code-eliminated from a production build.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as Record<string, unknown>;
    target.__xingyuNotify = push;
    return () => {
      delete target.__xingyuNotify;
    };
  }, [push]);

  const value = useMemo<NotificationToastContextValue>(
    () => ({ toasts, push, dismiss, dismissAll }),
    [toasts, push, dismiss, dismissAll],
  );

  return (
    <NotificationToastContext.Provider value={value}>
      <ToastProvider swipeDirection="right" duration={5_000}>
        {children}
      </ToastProvider>
    </NotificationToastContext.Provider>
  );
}

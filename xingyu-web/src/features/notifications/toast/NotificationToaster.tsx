import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useNotificationToasts } from "./notification-toast.context";
import {
  NOTIFICATION_TOAST_DURATION,
  toastCategoryVisual,
  type NotificationToast,
} from "./notification-toast.types";

/*
 * The floating notification stack.
 *
 * Layout contract
 * ---------------
 *   >= sm   pinned top-right, 384px wide, newest on top, cards slide in from the
 *           right edge and slide back out the same way.
 *   <  sm   full-width strip at the top with page gutters, cards drop in from
 *           above and retreat the same way (the sideways slide would travel off
 *           a 390px viewport before it finished animating).
 *
 * Both come from the same DOM: only the viewport's direction and the closed-state
 * transform change at the `sm` breakpoint. No second component, no duplicated
 * markup, so a toast can never render in one layout and be missing from the other.
 *
 * Stacking
 * --------
 * The array is rendered newest-first, and each card is inset and dimmed by its
 * depth, so a stack reads as "one thing happened, and these are the ones behind
 * it" rather than as a wall of equal cards. Depth is capped at 2 steps of falloff
 * — a fifth toast is evicted by the provider, not scaled into illegibility.
 *
 * There is deliberately NO draining progress bar. Radix pauses its dismiss timer
 * on hover, and a CSS-animated bar would keep running while the card stayed —
 * a bar that lies about how long is left is worse than no bar. The gold hairline
 * at the bottom is a brand anchor, not a countdown.
 */
function depthStyle(depth: number): React.CSSProperties {
  if (depth === 0) return {};
  return {
    transform: `scale(${1 - Math.min(depth, 2) * 0.02})`,
    opacity: 1 - Math.min(depth, 2) * 0.18,
  };
}

function ToastBody({ toast }: { toast: NotificationToast }) {
  const visual = toastCategoryVisual(toast.category);
  const Icon = visual.icon;

  return (
    <>
      {/* The avatar wins over the glyph when a producer supplies one: a face is a
          faster identifier than a category icon. The category is still announced
          through the title prefix below, so nothing is lost. */}
      {toast.avatarUrl ? (
        <img
          src={toast.avatarUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", visual.disc)}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <ToastTitle>
          <span className="sr-only">{visual.label}：</span>
          {toast.title}
        </ToastTitle>
        {toast.body ? <ToastDescription>{toast.body}</ToastDescription> : null}
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-accent/70"
      />
    </>
  );
}

export function NotificationToaster() {
  const { toasts, dismiss } = useNotificationToasts();

  if (toasts.length === 0) return null;

  // Newest first: the thing that just happened is the thing at the top edge,
  // which is where the eye already is.
  const ordered = [...toasts].reverse();

  return (
    <ToastViewport
      label="通知"
      aria-live="polite"
      className="pointer-events-none max-sm:inset-x-0 max-sm:top-[calc(env(safe-area-inset-top)+var(--toast-top-offset))]"
    >
      {ordered.map((toast, index) => {
        const duration =
          toast.duration === null ? undefined : (toast.duration ?? NOTIFICATION_TOAST_DURATION);
        return (
          <Toast
            key={toast.id}
            open={toast.open}
            duration={duration}
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
            style={depthStyle(index)}
            className={cn(toast.href && "cursor-pointer", index > 0 && "max-sm:!transform-none")}
          >
            {toast.href ? (
              <Link
                to={toast.href}
                className="focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-lg"
                onClick={() => dismiss(toast.id)}
              >
                <ToastBody toast={toast} />
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <ToastBody toast={toast} />
              </span>
            )}
            <ToastClose />
          </Toast>
        );
      })}
    </ToastViewport>
  );
}

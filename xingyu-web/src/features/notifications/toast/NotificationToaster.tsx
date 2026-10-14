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
 *   >= sm   bottom-right corner, 420px wide. The stack grows UPWARD: the newest
 *           card sits at the top of the stack and rises in from one card-height
 *           below. Dismissal slides it out to the right.
 *   <  sm   edge-to-edge strip under the sticky header (see the `max-sm:` override
 *           on the viewport below). The stack grows DOWNWARD: the newest card sits
 *           at the BOTTOM of the stack and drops in from one card-height above.
 *           Dismissal still slides it out to the right.
 *
 * Both come from the same DOM: only the viewport's corner, the stack direction and
 * the entry transform change at the `sm` breakpoint. No second component, no
 * duplicated markup, so a toast can never render in one layout and be missing from
 * the other.
 *
 * Why the corner differs: on a phone the bottom of the viewport belongs to the
 * browser chrome and the thumb, so a bottom-anchored toast would sit under both. On
 * a desktop neither applies, and the bottom-right corner is the least contested area
 * of a 1200px shell. The 420px cap starts at `sm`, not `md` — a 640px window should
 * get a card in the corner, not a banner across the whole page.
 *
 * Stacking
 * --------
 * The array is rendered newest-first, and each card is inset and dimmed by its
 * depth, so a stack reads as "one thing happened, and these are the ones behind
 * it" rather than as a wall of equal cards. Depth is capped at 2 steps of falloff
 * — a fifth toast is evicted by the provider, not scaled into illegibility.
 *
 * The scale half of that falloff is suppressed below `sm` (the `max-sm:!transform-none`
 * on the depth cards): the mobile stack is edge-to-edge, and shrinking a full-width
 * card by 2% does not read as depth — it reads as a card that failed to line up with
 * the gutter. The opacity step still applies, so the stack is still ordered.
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

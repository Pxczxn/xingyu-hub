import { AtSign, Bell, Heart, Mail, Megaphone, MessageCircle, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * Model for the floating notification toast.
 *
 * This is deliberately NOT the same shape as `Notification` from
 * api/notifications. That type mirrors a database row; this one describes
 * something that is on screen for five seconds. Keeping them separate means the
 * transport contract can change without touching the presentation, and a toast
 * can be raised by a source that has no notification row at all — which is
 * exactly the case for a live chat message arriving over the socket.
 *
 * `category` stays a free-form string on purpose. The backend's
 * `NotificationView.category` is whatever the producer set, and today the ONLY
 * producer in the whole backend is `notifyUserFollowed` ("FOLLOW"). Typing this
 * as a closed union would make the next producer render as an unhandled case, so
 * unknown categories fall back to a generic bell instead of disappearing.
 */
export type NotificationToastInput = {
  category: string;
  title: string;
  body?: string;
  /** Optional actor avatar. Falls back to the category glyph. */
  avatarUrl?: string | null;
  /** Where clicking the toast navigates. Omitted = the toast is not a link. */
  href?: string;
  /**
   * Auto-dismiss delay in ms. `null` means sticky (no timer) — use it for
   * anything the reader must act on, because a toast that removes itself before
   * it is read is worse than no toast.
   */
  duration?: number | null;
};

export type NotificationToast = NotificationToastInput & {
  id: string;
  /** Radix owns the exit animation; we flip this and unmount after it runs. */
  open: boolean;
};

/** Visual treatment for one notification category. */
export type ToastCategoryVisual = {
  icon: LucideIcon;
  /** Tinted disc behind the icon. */
  disc: string;
  /** Accessible prefix so the category is announced, not only coloured. */
  label: string;
};

const VISUALS: Record<string, ToastCategoryVisual> = {
  FOLLOW: {
    icon: UserPlus,
    disc: "bg-accent-soft text-accent-strong",
    label: "关注",
  },
  LIKE: {
    icon: Heart,
    disc: "bg-rose-50 text-rose-600",
    label: "点赞",
  },
  COMMENT: {
    icon: MessageCircle,
    disc: "bg-sky-50 text-sky-700",
    label: "评论",
  },
  MENTION: {
    icon: AtSign,
    disc: "bg-violet-50 text-violet-700",
    label: "提及",
  },
  MESSAGE: {
    icon: Mail,
    disc: "bg-sky-50 text-sky-700",
    label: "私信",
  },
  SYSTEM: {
    icon: Megaphone,
    disc: "bg-surface-sunken text-foreground-soft",
    label: "系统",
  },
};

const FALLBACK: ToastCategoryVisual = {
  icon: Bell,
  disc: "bg-surface-sunken text-foreground-soft",
  label: "通知",
};

/**
 * Resolve the visual for a category.
 *
 * Case-insensitive and whitespace-tolerant: the category arrives from the
 * backend as an unconstrained string, and a producer that emits "follow" or
 * " FOLLOW " should not silently lose its icon.
 */
export function toastCategoryVisual(category: string): ToastCategoryVisual {
  return VISUALS[category.trim().toUpperCase()] ?? FALLBACK;
}

/** Default auto-dismiss delay for informational toasts. */
export const NOTIFICATION_TOAST_DURATION = 5_000;

/**
 * Exit animation length in ms. Must be >= the CSS transition duration in
 * components/ui/toast.tsx (300ms) — unmounting earlier would cut the animation.
 */
export const NOTIFICATION_TOAST_EXIT_MS = 320;

/**
 * How many toasts may be on screen at once.
 *
 * Douyin-style stacks stay readable at three or four; past that they cover the
 * page they are reporting on. The oldest is dropped when a fifth arrives.
 */
export const NOTIFICATION_TOAST_MAX = 4;

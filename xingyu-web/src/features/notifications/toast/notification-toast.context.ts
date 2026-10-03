import { createContext, useContext } from "react";
import type { NotificationToast, NotificationToastInput } from "./notification-toast.types";

/*
 * Context + hook for the floating notification stack.
 *
 * Kept in a `.ts` file with no JSX so the provider component and the consumer
 * hook can live in separate modules — a single file exporting both a component
 * and a hook breaks React Fast Refresh for the whole feature (the
 * `react-refresh/only-export-components` rule).
 */

export type NotificationToastContextValue = {
  /** Currently mounted toasts, oldest first. */
  toasts: NotificationToast[];
  /**
   * Raise a toast. Returns its generated id so a caller can dismiss it early
   * (e.g. when the thing it announced finishes).
   */
  push: (input: NotificationToastInput) => string;
  /** Start the exit animation for one toast; it unmounts when that finishes. */
  dismiss: (id: string) => void;
  /** Start the exit animation for every toast. */
  dismissAll: () => void;
};

export const NotificationToastContext = createContext<NotificationToastContextValue | null>(null);

/**
 * No-op implementation used when no provider is mounted.
 *
 * This channel is AUXILIARY: a toast reports something that has already
 * happened, and the thing it reports is still true if the toast never appears.
 * Throwing here would mean any surface rendered outside the shell — a route host
 * in a unit test, a future embedded view — crashes the moment a background event
 * arrives. Degrading to "the notification simply does not float" is the correct
 * failure mode for a decoration.
 *
 * `toasts` stays a shared empty array so consumers that map over it get a stable
 * reference and do not re-render on every call.
 */
const NOOP_VALUE: NotificationToastContextValue = {
  toasts: [],
  push: () => "",
  dismiss: () => {},
  dismissAll: () => {},
};

export function useNotificationToasts(): NotificationToastContextValue {
  return useContext(NotificationToastContext) ?? NOOP_VALUE;
}

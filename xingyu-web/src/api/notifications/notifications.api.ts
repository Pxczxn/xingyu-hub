import { apiRequest } from "@/api/client";
import { toNotifications, type Notification } from "./notifications.types";

/*
 * Notification reads and read-state writes.
 *
 * Endpoint shapes are documented in notifications.types.ts — in particular that
 * the list is a BARE ARRAY (not PageResult) and that `read-all` answers 204, so
 * `apiRequest` resolves to `undefined`.
 */
export const notificationsApi = {
  /**
   * The signed-in user's notifications, newest first.
   *
   * 50 is the backend's own default ceiling (`NotificationService` clamps
   * non-positive limits to 50) and there is no cursor, so one window is fetched.
   */
  list: async (limit = 50): Promise<Notification[]> =>
    toNotifications(
      await apiRequest<Notification[]>(
        `/api/v1/notifications?limit=${encodeURIComponent(String(limit))}`,
      ),
    ),

  /**
   * Marks one notification read. Idempotent.
   * 404 when it does not exist or belongs to somebody else — surface it, do not
   * assume success.
   */
  markRead: (notificationId: string): Promise<Notification> =>
    apiRequest<Notification>(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: "PATCH" },
    ),

  /** Marks every unread notification read. Answers 204 -> resolves to undefined. */
  markAllRead: (): Promise<void> =>
    apiRequest<void>("/api/v1/notifications/read-all", { method: "POST" }),
};

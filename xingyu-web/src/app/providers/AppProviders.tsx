import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth.store";
import { NotificationToastProvider } from "@/features/notifications/toast/NotificationToastProvider";

/**
 * Root provider composition for Web V2.
 *
 * Phase 0 only needed auth. The toast provider landed with the floating
 * notification stack; it sits INSIDE AuthProvider because producers of toasts
 * (the chat socket bridge, future notification polling) need to know whether a
 * session exists before they can subscribe to anything.
 *
 * Still outstanding from the original note: a query client and a theme provider.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationToastProvider>{children}</NotificationToastProvider>
    </AuthProvider>
  );
}

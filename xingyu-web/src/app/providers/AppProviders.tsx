import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth.store";
import { ChatSocketProvider } from "@/features/chat/ChatSocketProvider";
import { NotificationToastProvider } from "@/features/notifications/toast/NotificationToastProvider";

/**
 * Root provider composition for Web V2.
 *
 * Order matters and is load-bearing:
 *   AuthProvider        — session state; the chat provider reads the token from it.
 *   ChatSocketProvider  — ONE community WebSocket per tab (2026-10-06), plus the
 *                         shared conversation list that the header badge, the mailbox
 *                         rows and the open thread all read. Previously each of those
 *                         three components opened its OWN socket while the server kept
 *                         only one session per user, so they fought every 3 seconds.
 *   NotificationToastProvider — the floating stack, mounted last so its live region is
 *                         the final thing in the tree.
 *
 * Still outstanding from the original note: a query client and a theme provider.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ChatSocketProvider>
        <NotificationToastProvider>{children}</NotificationToastProvider>
      </ChatSocketProvider>
    </AuthProvider>
  );
}

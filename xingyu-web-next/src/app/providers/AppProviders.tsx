import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth.store";

/**
 * Root provider composition for Web V2.
 * Phase 0 only needs auth; additional providers (query, theme, toast) land later.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

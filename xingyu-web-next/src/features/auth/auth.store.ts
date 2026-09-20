/*
 * Auth store (Phase 0 — infrastructure only; no register / forgot-password /
 * reset-password / force-change-password / verify-email yet).
 *
 * Responsibilities:
 *  - hold the current MeAccount and auth status
 *  - restore a session on boot if a token is already stored
 *  - expose login() / logout() that persist the sa-token via api/client.ts
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/api/auth/auth.api";
import type { LoginPayload, MeAccount } from "@/api/auth/auth.types";
import { getStoredToken, setStoredToken } from "@/lib/storage";

export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: MeAccount | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<MeAccount>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeAccount | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

  // Restore session if a token already exists.
  useEffect(() => {
    let active = true;
    if (!getStoredToken()) {
      setStatus("anonymous");
      return;
    }
    setStatus("loading");
    authApi
      .getMe()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setStoredToken(null);
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<MeAccount> => {
    await authApi.login(payload); // stores the sa-token via api/client.ts
    const me = await authApi.getMe();
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setStoredToken(null);
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated" && user !== null,
      login,
      logout,
    }),
    [user, status, login, logout],
  );

  // NOTE: this file stays .ts (per the agreed structure), so we use
  // createElement instead of JSX for the provider element.
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

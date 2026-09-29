/*
 * Auth store (Phase 1A) — the single auth infrastructure for Web V2.
 * Pages must read auth state from here, never from localStorage directly.
 *
 * Status model:
 *   initializing  — session restore still in flight
 *   authenticated — token present and /api/v1/me resolved
 *   unauthenticated — no token, or restore failed
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
import type { LoginPayload, LoginResult, MeAccount } from "@/api/auth/auth.types";
import { getStoredToken, setStoredToken } from "@/lib/storage";

export type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: MeAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<MeAccount | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeAccount | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [status, setStatus] = useState<AuthStatus>("initializing");

  // Restore session on boot when a token is already stored.
  useEffect(() => {
    let active = true;
    const stored = getStoredToken();
    if (!stored) {
      setToken(null);
      setStatus("unauthenticated");
      return;
    }
    setStatus("initializing");
    authApi
      .getMe()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setToken(getStoredToken());
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setStoredToken(null);
        setUser(null);
        setToken(null);
        setStatus("unauthenticated");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<LoginResult> => {
    // api/client.ts persists the sa-token from the response header or body.
    const result = await authApi.login(payload);
    const me = await authApi.getMe();
    setUser(me);
    setToken(getStoredToken());
    setStatus("authenticated");
    return result;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setStoredToken(null);
      setUser(null);
      setToken(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<MeAccount | null> => {
    try {
      const me = await authApi.getMe();
      setUser(me);
      setStatus("authenticated");
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      isAuthenticated: status === "authenticated" && user !== null,
      login,
      logout,
      refreshUser,
    }),
    [status, user, token, login, logout, refreshUser],
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

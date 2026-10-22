/*
 * Auth store (Phase 1A) — the single auth infrastructure for Web V2.
 * Pages must read auth state from here, never from localStorage directly.
 *
 * Status model:
 *   initializing  — session restore still in flight
 *   authenticated — token present and /api/v1/me resolved
 *   unauthenticated — no token, or restore failed
 *
 * 2026-10-22: the token store is the transport layer's property (api/client.ts
 * clears it on any 401). This provider subscribes to AUTH_CHANGED_EVENT and the
 * cross-tab `storage` event, so a dead session, a logout in another tab, or a
 * different account signing in elsewhere is reflected without a reload.
 *
 * 2026-10-22 (follow-up): every token change bumps a session epoch. A slow /me
 * for an older token must never overwrite the newer session — otherwise the UI
 * can show account A's identity while requests are already authenticated as B.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/api/auth/auth.api";
import type { LoginPayload, LoginResult, MeAccount } from "@/api/auth/auth.types";
import { getStoredToken, onAuthChanged, setStoredToken, TOKEN_KEY } from "@/lib/storage";

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

  // Mirrors of the current values for the storage listeners, which are
  // registered once and must not re-subscribe on every render.
  const tokenRef = useRef(token);
  const statusRef = useRef(status);
  tokenRef.current = token;
  statusRef.current = status;

  /** login() persists the token through the transport; it also sets the state itself. */
  const loggingInRef = useRef(false);
  /**
   * Monotonic session epoch. Bumped on every token change (including clearing),
   * so a /me response that belongs to a superseded token is discarded instead of
   * resurrecting an old account.
   */
  const epochRef = useRef(0);
  /** Token whose /me is currently in flight, to avoid duplicate requests. */
  const pendingTokenRef = useRef<string | null>(null);

  /** Resolve /me for exactly `expectedToken`; stale or superseded results are dropped. */
  const resolveSession = useCallback((expectedToken: string) => {
    const epoch = ++epochRef.current;
    pendingTokenRef.current = expectedToken;
    authApi
      .getMe()
      .then((me) => {
        if (epoch !== epochRef.current) return;
        if (getStoredToken() !== expectedToken) return;
        setUser(me);
        setToken(expectedToken);
        setStatus("authenticated");
      })
      .catch(() => {
        if (epoch !== epochRef.current) return;
        if (getStoredToken() !== expectedToken) return;
        // The token no longer authenticates: drop it and clear the session.
        setStoredToken(null);
        setUser(null);
        setToken(null);
        setStatus("unauthenticated");
      })
      .finally(() => {
        if (pendingTokenRef.current === expectedToken && epoch === epochRef.current) {
          pendingTokenRef.current = null;
        }
      });
  }, []);

  // Restore the session on boot.
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setStatus("unauthenticated");
      return;
    }
    resolveSession(stored);
  }, [resolveSession]);

  /**
   * Reconcile memory with the stored token.
   *
   * - empty token: clear everything (401, logout, another tab logging out);
   * - token changed: always re-resolve the profile. This is what replaces the
   *   previous account's identity when another tab signs in as someone else;
   * - same token while authenticated: nothing to do.
   */
  useEffect(() => {
    const sync = () => {
      const stored = getStoredToken();
      if (!stored) {
        // Invalidate any in-flight /me so it cannot bring the old user back.
        epochRef.current += 1;
        pendingTokenRef.current = null;
        setUser(null);
        setToken(null);
        setStatus("unauthenticated");
        return;
      }
      if (stored === tokenRef.current && statusRef.current === "authenticated") return;
      setToken(stored);
      // login() is already resolving /me for the token it just caused.
      if (loggingInRef.current) return;
      if (pendingTokenRef.current === stored) return;
      resolveSession(stored);
    };

    const unsubscribe = onAuthChanged(sync);
    const onStorage = (event: StorageEvent) => {
      // `key === null` is a full localStorage clear.
      if (event.key === TOKEN_KEY || event.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [resolveSession]);

  const login = useCallback(
    async (payload: LoginPayload): Promise<LoginResult> => {
      loggingInRef.current = true;
      const epochAtStart = epochRef.current;
      try {
        const result = await authApi.login(payload);
        const expected = getStoredToken();
        const me = await authApi.getMe();

        // A 401/logout in this or another tab happened while /me was in flight:
        // adopt the newer (already-cleared) state instead of signing back in.
        if (epochAtStart !== epochRef.current) return result;
        if (!expected || getStoredToken() !== expected) {
          // Another tab replaced the session meanwhile: adopt whatever is current.
          const current = getStoredToken();
          if (current) resolveSession(current);
          return result;
        }

        epochRef.current += 1;
        pendingTokenRef.current = null;
        setUser(me);
        setToken(expected);
        setStatus("authenticated");
        return result;
      } finally {
        loggingInRef.current = false;
      }
    },
    [resolveSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      epochRef.current += 1;
      pendingTokenRef.current = null;
      setStoredToken(null);
      setUser(null);
      setToken(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<MeAccount | null> => {
    const expected = getStoredToken();
    if (!expected) return null;
    const epoch = epochRef.current;
    try {
      const me = await authApi.getMe();
      if (epoch !== epochRef.current || getStoredToken() !== expected) return null;
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { AuthProvider, useAuth } from "@/features/auth/auth.store";
import { setStoredToken, getStoredToken, TOKEN_KEY } from "@/lib/storage";
import { RegisterPage } from "./pages/RegisterPage";

/*
 * Auth flow tests (Phase 1A): session restore, login success/failure,
 * token persistence, logout, and client-side register validation.
 * The network layer is mocked; production code never reads localStorage directly.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
    requestPasswordRecovery: vi.fn(),
    resetPassword: vi.fn(),
    forceChangePassword: vi.fn(),
    sendRegisterSms: vi.fn(),
  },
}));

const mocked = vi.mocked(authApi);

const ME = { email: "alice@example.com", emailVerified: true, username: "alice" };
const ME_B = { email: "bob@example.com", emailVerified: true, username: "bob" };
const ME_C = { email: "carol@example.com", emailVerified: true, username: "carol" };

/** A real "the server rejected this token" failure (as opposed to a network fault). */
function tokenRejected(status: 401 | 403 = 401) {
  return new ApiError({
    type: "about:blank",
    title: status === 401 ? "Unauthorized" : "Forbidden",
    status,
    detail: "登录状态已失效",
    code: "UNAUTHORIZED",
  });
}

/** Simulate another tab writing the token: no in-page custom event, only `storage`. */
function switchTokenFromAnotherTab(next: string | null) {
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: next }));
}

function Probe() {
  const { status, user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.username ?? ""}</span>
      <span data-testid="token">{token ?? ""}</span>
      <button
        type="button"
        onClick={() => void login({ login: "alice", password: "Passw0rd!" }).catch(() => undefined)}
      >
        login
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("auth store", () => {
  it("restores the session when a token is already stored", async () => {
    setStoredToken("existing-token");
    mocked.getMe.mockResolvedValue(ME);

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("alice");
    expect(mocked.getMe).toHaveBeenCalled();
  });

  /*
   * A2 regression (audit 2026-11-10): the restore `catch` used to treat EVERY
   * failure as "the token is dead" and call `setStoredToken(null)`. A dropped
   * connection, a 502 from the proxy or a timeout therefore signed the user out
   * of a session that was still perfectly valid — and told them nothing about
   * the fact that it was the network, not their password.
   * Only an explicit 401/403 (the backend rejecting THIS token) may clear it;
   * anything else keeps the token and leaves a retryable state.
   */
  it("clears the token when the restore is rejected with 401", async () => {
    setStoredToken("expired-token");
    mocked.getMe.mockRejectedValue(tokenRejected(401));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(getStoredToken()).toBeNull();
  });

  it("clears the token when the restore is rejected with 403", async () => {
    setStoredToken("expired-token");
    mocked.getMe.mockRejectedValue(tokenRejected(403));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(getStoredToken()).toBeNull();
  });

  it("keeps the stored token when the restore fails with a network error", async () => {
    setStoredToken("valid-token");
    // `fetch` rejects like this when the connection drops / the browser is offline.
    mocked.getMe.mockRejectedValue(new TypeError("Failed to fetch"));

    renderProbe();

    // The session is NOT signed out, and the state is distinguishable from it.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(getStoredToken()).toBe("valid-token");
    expect(screen.getByTestId("user")).toHaveTextContent("");
  });

  it("keeps the stored token when the restore fails with 502", async () => {
    setStoredToken("valid-token");
    mocked.getMe.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Bad Gateway",
        status: 502,
        detail: "网关不可用",
        code: "UPSTREAM_ERROR",
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(getStoredToken()).toBe("valid-token");
  });

  it("reports unauthenticated when there is no stored token", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(mocked.getMe).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  it("logs in, persists the token and loads the current user", async () => {
    mocked.login.mockImplementation(async () => {
      setStoredToken("tok-123"); // mirrors api/client.ts token persistence
      return { token: "tok-123" };
    });
    mocked.getMe.mockResolvedValue(ME);

    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("alice");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok-123");
    expect(mocked.login).toHaveBeenCalledWith({ login: "alice", password: "Passw0rd!" });
  });

  it("stays unauthenticated when the credentials are rejected", async () => {
    mocked.login.mockRejectedValue(new Error("invalid"));

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    // A failed login must never leave a usable session behind.
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(getStoredToken()).toBeNull();
    expect(mocked.getMe).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("clears the token and returns to unauthenticated", async () => {
    setStoredToken("tok-123");
    mocked.getMe.mockResolvedValue(ME);
    mocked.logout.mockResolvedValue(undefined);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(getStoredToken()).toBeNull();
    expect(mocked.logout).toHaveBeenCalled();
  });
});

describe("session invalidation sync", () => {
  it("signs the UI out when a 401 clears the stored token", async () => {
    setStoredToken("tok-123");
    mocked.getMe.mockResolvedValue(ME);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    // Mirrors api/client.ts: a 401 clears the token and broadcasts.
    setStoredToken(null);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
    expect(screen.getByTestId("token")).toHaveTextContent("");
  });

  it("handles several concurrent 401s without extra session calls", async () => {
    setStoredToken("tok-123");
    mocked.getMe.mockResolvedValue(ME);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    const callsAfterLogin = mocked.getMe.mock.calls.length;

    setStoredToken(null);
    setStoredToken(null);
    setStoredToken(null);

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(mocked.getMe.mock.calls.length).toBe(callsAfterLogin);
  });

  it("signs out when another tab clears the token", async () => {
    setStoredToken("tok-123");
    mocked.getMe.mockResolvedValue(ME);

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    // Another tab removed the key: no in-page event, only the native one.
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: null }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
  });

  it("adopts a session created in another tab", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    mocked.getMe.mockResolvedValue(ME);

    localStorage.setItem(TOKEN_KEY, "tab-token");
    window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: "tab-token" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("alice");
    expect(screen.getByTestId("token")).toHaveTextContent("tab-token");
  });
});

describe("cross-tab account switch", () => {
  it("replaces the previous account identity when another tab signs in as B", async () => {
    setStoredToken("token-a");
    mocked.getMe.mockResolvedValueOnce(ME);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"));

    mocked.getMe.mockResolvedValueOnce(ME_B);
    switchTokenFromAnotherTab("token-b");

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("bob"));
    expect(screen.getByTestId("token")).toHaveTextContent("token-b");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("clears the session when the switched account fails verification", async () => {
    setStoredToken("token-a");
    mocked.getMe.mockResolvedValueOnce(ME);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"));

    mocked.getMe.mockRejectedValueOnce(tokenRejected(401));
    switchTokenFromAnotherTab("token-b");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
    expect(getStoredToken()).toBeNull();
  });

  it("ignores a slow /me for an account that was already superseded", async () => {
    setStoredToken("token-a");
    mocked.getMe.mockResolvedValueOnce(ME);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"));

    let resolveB!: (me: typeof ME) => void;
    mocked.getMe.mockImplementationOnce(
      () =>
        new Promise<typeof ME>((resolve) => {
          resolveB = resolve;
        }),
    );
    switchTokenFromAnotherTab("token-b");
    await waitFor(() => expect(mocked.getMe).toHaveBeenCalledTimes(2));

    mocked.getMe.mockResolvedValueOnce(ME_C);
    switchTokenFromAnotherTab("token-c");
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("carol"));

    // The delayed response for B arrives last: it must not overwrite C.
    resolveB(ME_B);
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("carol"));
    expect(screen.getByTestId("token")).toHaveTextContent("token-c");
  });

  it("does not resurrect a session whose /me resolves after sign-out", async () => {
    setStoredToken("token-a");
    mocked.getMe.mockResolvedValueOnce(ME);
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"));

    let resolveB!: (me: typeof ME) => void;
    mocked.getMe.mockImplementationOnce(
      () =>
        new Promise<typeof ME>((resolve) => {
          resolveB = resolve;
        }),
    );
    switchTokenFromAnotherTab("token-b");
    await waitFor(() => expect(mocked.getMe).toHaveBeenCalledTimes(2));

    switchTokenFromAnotherTab(null);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    resolveB(ME_B);
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent(""));
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
  });
});

describe("register validation", () => {
  it("rejects an invalid username before calling the API", async () => {
    mocked.getPublicConfig.mockResolvedValue({
      registration: {
        enabled: true,
        verifyEmail: false,
        verifyPhone: false,
        needAudit: false,
        defaultRole: "USER",
        captchaEnabled: false,
      },
      password: {
        minLength: 8,
        maxLength: 32,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: true,
      },
      storage: { maxSize: 0, allowTypes: "" },
      login: { rememberMe: true, captchaEnabled: false, captchaType: "", maxRetryCount: 0 },
      sms: { enabled: false },
      siteName: "xingyu",
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await userEvent.type(await screen.findByLabelText("邮箱"), "a@b.com");
    await userEvent.type(screen.getByLabelText("用户名"), "AB"); // invalid: too short / uppercase
    await userEvent.type(screen.getByLabelText("密码"), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(screen.getByText("用户名不可用")).toBeInTheDocument();
    });
    expect(mocked.register).not.toHaveBeenCalled();
  });
});

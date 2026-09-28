import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

function Probe() {
  const { status, user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.username ?? ""}</span>
      <span data-testid="token">{token ?? ""}</span>
      <button
        type="button"
        onClick={() =>
          void login({ login: "alice", password: "Passw0rd!" }).catch(() => undefined)
        }
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

  it("falls back to unauthenticated when restore fails", async () => {
    setStoredToken("expired-token");
    mocked.getMe.mockRejectedValue(new Error("401"));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(getStoredToken()).toBeNull();
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

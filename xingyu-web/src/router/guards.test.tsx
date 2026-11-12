import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { ApiError } from "@/api/client";
import { AuthProvider } from "@/features/auth/auth.store";
import { RequireAuth } from "@/router/guards";
import { setStoredToken } from "@/lib/storage";

/**
 * Auth guard tests: anonymous visitors are sent to /login, authenticated ones
 * see the protected content.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockedGetMe = vi.mocked(authApi.getMe);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

function renderGuard(initialPath = "/studio") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <LocationProbe />
        <Routes>
          <Route
            path="/studio"
            element={
              <RequireAuth>
                <div data-testid="protected-content">创作中心</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">登录</div>} />
          <Route
            path="/force-change-password"
            element={<div data-testid="force-change-page">请修改密码</div>}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockedGetMe.mockReset();
});

describe("RequireAuth", () => {
  it("redirects anonymous visitors to /login", async () => {
    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders protected content for an authenticated user", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "alice@example.com",
      emailVerified: true,
      username: "alice",
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/studio");
  });

  /*
   * A2 (audit 2026-11-10): "restore failed" is not one thing. Only an explicit
   * 401/403 — the backend refusing THIS token — proves the session is dead. This
   * case pins that half of the contract: a real rejection still clears the token
   * and the guard falls back to anonymous.
   */
  it("clears the session and falls back to anonymous when the restore is rejected with 401", async () => {
    setStoredToken("expired-token");
    mockedGetMe.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "登录状态已失效",
        code: "UNAUTHORIZED",
      }),
    );

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(localStorage.getItem("xingyu-satoken")).toBeNull();
  });

  /*
   * The other half of A2: a dropped connection / 502 never proved the token is
   * dead, so it must stay stored — the user is not signed out, the state is a
   * retryable `error`. The guard may still keep the protected page hidden (it
   * has no identity to render), but that is a redirect, not a logout.
   */
  it("keeps the token when the restore fails for a network reason, but still guards the page", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockRejectedValue(new TypeError("Failed to fetch"));

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(localStorage.getItem("xingyu-satoken")).toBe("valid-token");
  });

  // 强制改密全局入口（2026-10-08）：后端在 mustChangePassword 期间对受保护接口一律 403，
  // 若守卫不拦，页面会正常渲染但数据全空且没有可恢复导航。
  it("redirects a must-change-password user away from a protected page", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "bob@example.com",
      emailVerified: true,
      username: "bob",
      mustChangePassword: true,
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/force-change-password");
    });
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("force-change-page")).toBeInTheDocument();
  });

  it("lets a must-change-password user through once the flag clears", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "bob@example.com",
      emailVerified: true,
      username: "bob",
      mustChangePassword: false,
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
    expect(screen.getByTestId("current-path")).toHaveTextContent("/studio");
  });

  it("redirects to /login when the session dies while on a protected page", async () => {
    setStoredToken("valid-token");
    mockedGetMe.mockResolvedValue({
      email: "alice@example.com",
      emailVerified: true,
      username: "alice",
    });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });

    // Any API 401 clears the token; the guard must react without a reload.
    setStoredToken(null);

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });
});

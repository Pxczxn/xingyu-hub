import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
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

  it("falls back to anonymous when restoring the session fails", async () => {
    setStoredToken("expired-token");
    mockedGetMe.mockRejectedValue(new Error("401"));

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent("/login");
    });
    expect(localStorage.getItem("xingyu-satoken")).toBeNull();
  });
});

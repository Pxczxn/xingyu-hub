import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { onboardingApi } from "@/api/onboarding/onboarding.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { clearPublicConfigCache } from "@/lib/public-config";

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("@/api/onboarding/onboarding.api", () => ({
  onboardingApi: { get: vi.fn(), update: vi.fn() },
}));

const mockedAuth = vi.mocked(authApi);
const mockedOnboarding = vi.mocked(onboardingApi);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-url">{`${location.pathname}${location.search}`}</div>;
}

function renderLogin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <LocationProbe />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<div>入门页</div>} />
          <Route path="/studio" element={<div>创作台</div>} />
          <Route path="/force-change-password" element={<div>改密</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  clearPublicConfigCache();
  vi.clearAllMocks();
  mockedAuth.getPublicConfig.mockResolvedValue({
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
      maxLength: 64,
      requireUppercase: false,
      requireLowercase: false,
      requireNumber: false,
      requireSpecial: false,
    },
    storage: { maxSize: 1, allowTypes: "" },
    login: { rememberMe: true, captchaEnabled: false, captchaType: "math", maxRetryCount: 5 },
    sms: { enabled: false },
    siteName: "星语",
  });
  mockedAuth.login.mockResolvedValue({ token: "session-token" });
  mockedAuth.getMe.mockResolvedValue({
    email: "alice@pxczxn.top",
    emailVerified: true,
    username: "alice",
  });
});

describe("login onboarding gate", () => {
  it("sends an incomplete user to /onboarding and keeps returnTo", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "WELCOME",
      interestsJson: null,
      completed: false,
    });
    const user = userEvent.setup();
    renderLogin("/login?returnTo=%2Fstudio");

    await user.type(await screen.findByLabelText("账号"), "alice");
    await user.type(screen.getByLabelText("密码"), "Passw0rd!");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/onboarding?returnTo=%2Fstudio");
    });
    expect(mockedOnboarding.get).toHaveBeenCalledTimes(1);
  });

  it("lets a completed user through to the original returnTo", async () => {
    mockedOnboarding.get.mockResolvedValue({
      step: "DONE",
      interestsJson: '["写作"]',
      completed: true,
    });
    const user = userEvent.setup();
    renderLogin("/login?returnTo=%2Fstudio");

    await user.type(await screen.findByLabelText("账号"), "alice");
    await user.type(screen.getByLabelText("密码"), "Passw0rd!");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/studio");
    });
  });

  it("falls through when onboarding GET fails", async () => {
    mockedOnboarding.get.mockRejectedValue(new Error("down"));
    const user = userEvent.setup();
    renderLogin("/login?returnTo=%2Fstudio");

    await user.type(await screen.findByLabelText("账号"), "alice");
    await user.type(screen.getByLabelText("密码"), "Passw0rd!");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/studio");
    });
  });

  it("still honours mustChangePassword before the onboarding gate", async () => {
    mockedAuth.login.mockResolvedValue({ token: "session-token", mustChangePassword: true });
    const user = userEvent.setup();
    renderLogin("/login?returnTo=%2Fstudio");

    await user.type(await screen.findByLabelText("账号"), "alice");
    await user.type(screen.getByLabelText("密码"), "Passw0rd!");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-url")).toHaveTextContent("/force-change-password");
    });
    expect(mockedOnboarding.get).not.toHaveBeenCalled();
  });
});

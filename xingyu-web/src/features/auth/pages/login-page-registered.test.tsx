import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import type { PublicConfig } from "@/api/auth/auth.types";
import { AuthProvider } from "@/features/auth/auth.store";
import { clearPublicConfigCache } from "@/lib/public-config";
import { LoginPage } from "./LoginPage";

/*
 * `?registered=1` — RegisterPage navigates here after a successful sign-up
 * (`RegisterPage.tsx:178`), but nothing read the flag, so the "account created"
 * confirmation could never be seen. These cases pin the hand-off:
 *
 *   1. the notice renders as a status (announced, not an error);
 *   2. it disappears once the reader starts typing (it is a one-time hand-off,
 *      not a permanent banner);
 *   3. it is absent when the flag is absent.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    register: vi.fn(),
  },
}));

const CONFIG = {
  registration: {
    enabled: true,
    verifyEmail: false,
    verifyPhone: false,
    needAudit: false,
    defaultRole: "USER",
    captchaEnabled: false,
  },
  login: { rememberMe: true, captchaEnabled: false, captchaType: "math", maxRetryCount: 5 },
  sms: { enabled: false },
  siteName: "星语",
} as unknown as PublicConfig;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  clearPublicConfigCache();
  vi.mocked(authApi.getPublicConfig).mockResolvedValue(CONFIG);
});

describe("LoginPage — registration hand-off", () => {
  it("shows the account-created notice when ?registered=1", async () => {
    renderAt("/login?registered=1");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/账号已创建/);
    expect(notice).toHaveTextContent(/请.*登录/);
  });

  it("hides the notice once the user starts typing", async () => {
    const user = userEvent.setup();
    renderAt("/login?registered=1");

    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.type(await screen.findByLabelText("账号"), "alice");

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("does not show the notice without the flag", async () => {
    renderAt("/login");

    expect(await screen.findByRole("heading", { name: "登录星语" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

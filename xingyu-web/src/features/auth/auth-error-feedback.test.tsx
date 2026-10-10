import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth/auth.api";
import { AuthProvider } from "@/features/auth/auth.store";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";

/*
 * Error feedback association (Stage 2, 2026-10-08).
 *
 * The audit found the auth screens reported the same failure three different
 * ways and never tied a failure back to the control that caused it. These tests
 * pin the two halves of the fix:
 *
 *   1. every form-wide failure renders through `AuthFormError` (the framed box),
 *   2. the input(s) the failure is about carry `aria-invalid` + `aria-describedby`
 *      pointing at the message, and the message itself takes focus.
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

const PUBLIC_CONFIG = {
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
} as never;

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.getPublicConfig.mockResolvedValue(PUBLIC_CONFIG);
  mocked.getCaptcha.mockRejectedValue(new Error("no captcha"));
});

describe("login error feedback", () => {
  it("associates a rejected credential with both inputs and focuses the alert", async () => {
    mocked.login.mockRejectedValue(
      new ApiError({
        status: 401,
        title: "Unauthorized",
        detail: "账号或密码错误",
      } as never),
    );

    renderLogin();

    const account = await screen.findByLabelText("账号");
    const password = screen.getByLabelText("密码");
    await userEvent.type(account, "alice");
    await userEvent.type(password, "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("账号或密码错误");

    // Both inputs the failure is about are flagged and described by the message.
    expect(account).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(account.getAttribute("aria-describedby")).toBe(
      password.getAttribute("aria-describedby"),
    );
    expect(document.getElementById(account.getAttribute("aria-describedby")!)).toBe(alert);

    // The alert is where the reader is put, so screen readers announce it.
    expect(alert).toHaveFocus();
  });

  it("renders the failure through the shared framed error surface", async () => {
    mocked.login.mockRejectedValue(new Error("network"));

    renderLogin();

    await userEvent.type(await screen.findByLabelText("账号"), "alice");
    await userEvent.type(screen.getByLabelText("密码"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));

    const alert = await screen.findByTestId("login-error");
    expect(alert.className).toContain("border-destructive/25");
    expect(alert.className).toContain("bg-destructive/5");
  });
});

describe("reset password error feedback", () => {
  it("flags the confirm field alone when the two passwords differ", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=tok"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    const password = screen.getByLabelText("新密码");
    const confirm = screen.getByLabelText("确认新密码");
    fireEvent.change(password, { target: { value: "Passw0rd!" } });
    fireEvent.change(confirm, { target: { value: "Passw0rd?" } });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));

    const confirmAlert = await screen.findByText("两次输入的密码不一致");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(confirm.getAttribute("aria-describedby")!)).toBe(confirmAlert);
    // The mismatch is NOT a form-wide failure — the other field stays clean, and
    // the sentence appears exactly once (no duplicate form-level alert).
    expect(password).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByTestId("reset-password-error")).not.toBeInTheDocument();
    expect(screen.getAllByText("两次输入的密码不一致")).toHaveLength(1);
    expect(mocked.resetPassword).not.toHaveBeenCalled();
  });
});

describe("forgot password error feedback", () => {
  it("keeps the request failure attached to the login field", async () => {
    mocked.requestPasswordRecovery.mockRejectedValue(
      new ApiError({ status: 500, title: "Server Error", detail: "服务暂时不可用" } as never),
    );

    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    const login = await screen.findByLabelText("邮箱或用户名");
    await userEvent.type(login, "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: "发送重置链接" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("服务暂时不可用");
    expect(login).toHaveAttribute("aria-invalid", "true");
    expect(alert).toHaveFocus();

    // A failure must not be dressed up as a successful send.
    await waitFor(() => expect(screen.queryByText("重置链接已发送")).not.toBeInTheDocument());
  });
});

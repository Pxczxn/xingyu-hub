import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import type { PublicConfig } from "@/api/auth/auth.types";
import { getPublicConfig } from "@/lib/public-config";
import {
  FALLBACK_PASSWORD_POLICY,
  PASSWORD_POLICY_FALLBACK_NOTICE,
} from "@/lib/password-rules";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ForceChangePasswordPage } from "./pages/ForceChangePasswordPage";

/*
 * 审计 A4 —— 密码 policy 拉不到时，前端不许 fail-open。
 *
 * 旧实现是两段合起来的静默失败：
 *   1. `password-rules.ts` 的 `if (!policy) return null`：没有 policy 就恒通过，
 *      `validatePasswordClient("a")` 返回 null；
 *   2. 三个认证页面的 `.catch(() => undefined)`：`/api/v1/public/config` 失败时
 *      既不提示，也不把「没拿到规则」这件事暴露给用户。
 * 用户看到的是一个「怎么填都放行」的表单，直到后端 400；强制改密页则更像死胡同。
 *
 * 这几条用例从**页面**这一层钉住修复：policy 请求 reject → 校验仍然生效（1 位密码
 * 被前端拦下，不发请求），并展示回退说明行；policy 正常 → 仍按服务端规则执行。
 * 回退阈值本身（以及「策略缺失 → 1 位密码被拒」）由 `lib/password-rules.test.ts` 覆盖。
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    register: vi.fn(),
    resetPassword: vi.fn(),
    forceChangePassword: vi.fn(),
    getMe: vi.fn(),
  },
}));

vi.mock("@/lib/public-config", () => ({
  getPublicConfig: vi.fn(),
}));

// 强制改密页只关心「已登录 + 必须改密」；两个重定向 effect 读的就是这两个字段。
vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      email: "alice@example.com",
      emailVerified: true,
      mustChangePassword: true,
    },
    refreshUser: vi.fn(),
  }),
}));

const mockedAuth = vi.mocked(authApi);
const mockedConfig = vi.mocked(getPublicConfig);

const FLOOR = FALLBACK_PASSWORD_POLICY.minLength;

const FULL_POLICY: PublicConfig = {
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
};

function renderRegister() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

function renderReset() {
  return render(
    <MemoryRouter initialEntries={["/reset-password?token=tok"]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

function renderForceChange() {
  return render(
    <MemoryRouter initialEntries={["/force-change-password"]}>
      <ForceChangePasswordPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("policy request fails (audit A4)", () => {
  it("registration still rejects a 1-character password and says it uses the default rules", async () => {
    mockedConfig.mockRejectedValue(new Error("network"));

    renderRegister();

    // catch 不再静默：提示位保留，并在其下追加一行内联说明。
    expect(await screen.findByText(PASSWORD_POLICY_FALLBACK_NOTICE)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("邮箱"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("用户名"), "alice");
    await userEvent.type(screen.getByLabelText("密码"), "a");
    await userEvent.click(screen.getByRole("button", { name: "注册" }));

    // 旧的 fail-open 会让这条 1 位密码通过并调用 register。
    expect(await screen.findByText(`密码长度不能少于 ${FLOOR} 位`)).toBeInTheDocument();
    expect(mockedAuth.register).not.toHaveBeenCalled();
  });

  it("reset still rejects a 1-character password when the policy request fails", async () => {
    mockedConfig.mockRejectedValue(new Error("network"));

    renderReset();

    expect(await screen.findByText(PASSWORD_POLICY_FALLBACK_NOTICE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));

    expect(await screen.findByTestId("reset-password-error")).toHaveTextContent(
      `密码长度不能少于 ${FLOOR} 位`,
    );
    expect(mockedAuth.resetPassword).not.toHaveBeenCalled();
  });

  it("the forced change flow rejects the weak password instead of dead-ending", async () => {
    mockedConfig.mockRejectedValue(new Error("network"));

    renderForceChange();

    expect(await screen.findByText(PASSWORD_POLICY_FALLBACK_NOTICE)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新密码" }));

    // 旧行为：前端零校验 → POST 被后端 400 → 页面只剩「修改失败，请稍后重试」。
    expect(await screen.findByTestId("force-change-error")).toHaveTextContent(
      `密码长度不能少于 ${FLOOR} 位`,
    );
    expect(mockedAuth.forceChangePassword).not.toHaveBeenCalled();
    // 仍在改密页：不是白屏、也没被重定向走。
    expect(screen.getByRole("heading", { name: "请修改密码" })).toBeInTheDocument();
  });
});

describe("policy request succeeds", () => {
  it("keeps enforcing the server policy and shows no fallback notice", async () => {
    mockedConfig.mockResolvedValue(FULL_POLICY);

    renderRegister();

    // 提示文案变成服务端规则，说明 policy 已经生效（之前的状态是 undefined）。
    expect(await screen.findByText(/密码需包含：8-32 位/)).toBeInTheDocument();
    expect(screen.queryByText(PASSWORD_POLICY_FALLBACK_NOTICE)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("邮箱"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("用户名"), "alice");
    await userEvent.type(screen.getByLabelText("密码"), "Abc123!"); // 7 位
    await userEvent.click(screen.getByRole("button", { name: "注册" }));

    expect(await screen.findByText("密码长度不能少于 8 位")).toBeInTheDocument();
    expect(mockedAuth.register).not.toHaveBeenCalled();
  });
});

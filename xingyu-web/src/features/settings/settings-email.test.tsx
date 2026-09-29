import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { accountApi } from "@/api/account/account.api";
import { authApi } from "@/api/auth/auth.api";
import { SettingsEmailPage } from "./pages/SettingsEmailPage";
import { setStoredRecentAuth, clearStoredRecentAuth } from "./recent-auth";

vi.mock("@/api/account/account.api", () => ({
  accountApi: {
    reAuthenticate: vi.fn(),
    changeEmail: vi.fn(),
    getDataExport: vi.fn(),
    requestAccountDeletion: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

const mockedAccount = vi.mocked(accountApi);
const mockedAuth = vi.mocked(authApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/security/email"]}>
      <Routes>
        <Route path="/settings/security/email" element={<SettingsEmailPage />} />
        <Route path="/settings/security/re-authenticate" element={<p>再验证页面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function grantValid() {
  setStoredRecentAuth("ra-1", new Date(Date.now() + 600_000).toISOString());
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  clearStoredRecentAuth();
  mockedAuth.getMe.mockResolvedValue({
    email: "old@pxczxn.top",
    emailVerified: true,
  });
});

describe("SettingsEmailPage", () => {
  it("shows the current email", async () => {
    renderPage();
    expect(await screen.findByTestId("email-current")).toHaveTextContent("old@pxczxn.top");
  });

  it("marks an unverified email", async () => {
    mockedAuth.getMe.mockResolvedValue({ email: "new@pxczxn.top", emailVerified: false });
    renderPage();
    expect(await screen.findByTestId("email-current")).toHaveTextContent("尚未验证");
  });

  it("shows a re-auth prompt when no grant is stored", async () => {
    renderPage();
    expect(await screen.findByTestId("email-need-reauth")).toBeInTheDocument();
  });

  it("hides the re-auth prompt once a grant exists", async () => {
    grantValid();
    renderPage();
    await screen.findByTestId("email-form");
    expect(screen.queryByTestId("email-need-reauth")).not.toBeInTheDocument();
  });

  it("refuses to submit without a grant and says why", async () => {
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    expect(await screen.findByTestId("email-error")).toHaveTextContent("身份验证已过期");
    expect(mockedAccount.changeEmail).not.toHaveBeenCalled();
  });

  it("validates the new email locally before calling the API", async () => {
    grantValid();
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    expect(await screen.findByText("邮箱格式不正确。")).toBeInTheDocument();
    expect(mockedAccount.changeEmail).not.toHaveBeenCalled();
  });

  it("rejects the address already in use without a round trip", async () => {
    grantValid();
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "old@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    expect(await screen.findByText("新邮箱不能与当前邮箱相同。")).toBeInTheDocument();
    expect(mockedAccount.changeEmail).not.toHaveBeenCalled();
  });

  it("requires the current password", async () => {
    grantValid();
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    expect(await screen.findByText("请输入当前密码。")).toBeInTheDocument();
    expect(mockedAccount.changeEmail).not.toHaveBeenCalled();
  });

  it("sends the grant id as the recent-auth header", async () => {
    grantValid();
    mockedAccount.changeEmail.mockResolvedValue({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: true,
    });
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    await waitFor(() =>
      expect(mockedAccount.changeEmail).toHaveBeenCalledWith(
        { newEmail: "new@pxczxn.top", password: "pw" },
        "ra-1",
      ),
    );
  });

  it("NEVER claims the email has changed — it says a confirmation mail was sent", async () => {
    grantValid();
    mockedAccount.changeEmail.mockResolvedValue({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: true,
    });
    const { container } = renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    const notice = await screen.findByTestId("email-notice-success");
    expect(notice).toHaveTextContent("完成确认后新邮箱才会生效");
    // Containment: the page must never assert the change is already done.
    expect(container.textContent).not.toContain("邮箱已修改");
    expect(container.textContent).not.toContain("修改成功");
  });

  it("treats mailPending:false as a WARNING, not a success", async () => {
    grantValid();
    mockedAccount.changeEmail.mockResolvedValue({
      currentEmail: "old@pxczxn.top",
      pendingEmail: "new@pxczxn.top",
      mailPending: false,
    });
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    const warning = await screen.findByTestId("email-notice-warning");
    expect(warning).toHaveTextContent("暂未成功投递");
    expect(screen.queryByTestId("email-notice-success")).not.toBeInTheDocument();
  });

  it("surfaces a backend rejection", async () => {
    grantValid();
    mockedAccount.changeEmail.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "禁止",
        status: 403,
        detail: "身份再认证已过期，请重新验证",
        code: "AUTH_FORBIDDEN",
      }),
    );
    renderPage();
    await screen.findByTestId("email-form");
    fireEvent.change(screen.getByLabelText("新邮箱"), { target: { value: "new@pxczxn.top" } });
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("email-form"));
    expect(await screen.findByTestId("email-error")).toHaveTextContent("身份再认证已过期");
  });

  it("links to the re-auth page with a returnTo back here", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "去验证身份" });
    expect(link).toHaveAttribute(
      "href",
      "/settings/security/re-authenticate?returnTo=/settings/security/email",
    );
  });

  it("shows an error state when the account cannot be read", async () => {
    mockedAuth.getMe.mockRejectedValue(new Error("nope"));
    renderPage();
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { accountApi } from "@/api/account/account.api";
import { SettingsReauthenticatePage, safeReturnTo } from "./pages/SettingsReauthenticatePage";
import { getStoredRecentAuth } from "./recent-auth";

vi.mock("@/api/account/account.api", () => ({
  accountApi: {
    reAuthenticate: vi.fn(),
    changeEmail: vi.fn(),
    getDataExport: vi.fn(),
    requestAccountDeletion: vi.fn(),
  },
}));

const mocked = vi.mocked(accountApi);

function renderPage(initialEntry = "/settings/security/re-authenticate") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/settings/security/re-authenticate" element={<SettingsReauthenticatePage />} />
        <Route path="/settings/security/email" element={<p>邮箱页面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("safeReturnTo", () => {
  it("accepts a relative /settings/ path", () => {
    expect(safeReturnTo("/settings/security/email")).toBe("/settings/security/email");
  });

  it("rejects an absolute URL", () => {
    expect(safeReturnTo("https://evil.example.com")).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeReturnTo("//evil.example.com")).toBeNull();
  });

  it("rejects a path outside /settings/", () => {
    expect(safeReturnTo("/studio/content")).toBeNull();
    expect(safeReturnTo("/admin")).toBeNull();
  });

  it("rejects a backslash-smuggled path", () => {
    expect(safeReturnTo("/settings/\\evil")).toBeNull();
  });

  it("returns null for null/empty", () => {
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo("")).toBeNull();
    expect(safeReturnTo("   ")).toBeNull();
  });
});

describe("SettingsReauthenticatePage", () => {
  it("requires a password before submitting", async () => {
    renderPage();
    fireEvent.submit(screen.getByTestId("reauth-form"));
    expect(await screen.findByText("请输入当前密码。")).toBeInTheDocument();
    expect(mocked.reAuthenticate).not.toHaveBeenCalled();
  });

  it("stores the grant in sessionStorage on success", async () => {
    mocked.reAuthenticate.mockResolvedValue({
      recentAuthId: "ra-1",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    await waitFor(() => expect(mocked.reAuthenticate).toHaveBeenCalledWith("pw"));
    expect(getStoredRecentAuth()?.id).toBe("ra-1");
  });

  it("falls back to a 15-minute window when expiresAt is absent", async () => {
    mocked.reAuthenticate.mockResolvedValue({ recentAuthId: "ra-2" });
    renderPage();
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    await waitFor(() => expect(getStoredRecentAuth()?.id).toBe("ra-2"));
    expect(getStoredRecentAuth()).not.toBeNull();
  });

  it("surfaces a wrong-password failure from the backend", async () => {
    mocked.reAuthenticate.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "凭据无效",
        status: 401,
        detail: "密码错误",
        code: "AUTH_INVALID_CREDENTIALS",
      }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "bad" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    expect(await screen.findByTestId("reauth-error")).toHaveTextContent("密码错误");
  });

  it("does not store a grant when authentication fails", async () => {
    mocked.reAuthenticate.mockRejectedValue(new Error("nope"));
    renderPage();
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "bad" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    await screen.findByTestId("reauth-error");
    expect(getStoredRecentAuth()).toBeNull();
  });

  it("navigates to returnTo after a successful verification", async () => {
    mocked.reAuthenticate.mockResolvedValue({
      recentAuthId: "ra-3",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    renderPage("/settings/security/re-authenticate?returnTo=/settings/security/email");
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    expect(await screen.findByText("邮箱页面")).toBeInTheDocument();
  });

  it("ignores a hostile returnTo instead of redirecting off-site", async () => {
    mocked.reAuthenticate.mockResolvedValue({
      recentAuthId: "ra-4",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    renderPage("/settings/security/re-authenticate?returnTo=https%3A%2F%2Fevil.example.com");
    fireEvent.change(screen.getByLabelText("当前密码"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByTestId("reauth-form"));
    expect(await screen.findByText("身份验证成功")).toBeInTheDocument();
    expect(screen.queryByText("邮箱页面")).not.toBeInTheDocument();
  });

  it("states the 15-minute window up front", () => {
    renderPage();
    expect(screen.getByText(/15 分钟/)).toBeInTheDocument();
  });
});

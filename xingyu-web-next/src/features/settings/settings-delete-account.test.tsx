import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { accountApi } from "@/api/account/account.api";
import { SettingsDeleteAccountPage } from "./pages/SettingsDeleteAccountPage";

vi.mock("@/api/account/account.api", () => ({
  accountApi: {
    reAuthenticate: vi.fn(),
    changeEmail: vi.fn(),
    getDataExport: vi.fn(),
    requestAccountDeletion: vi.fn(),
  },
}));

const mocked = vi.mocked(accountApi);

function renderPage() {
  return render(<SettingsDeleteAccountPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsDeleteAccountPage", () => {
  it("says 停用, never promising permanent deletion", () => {
    const { container } = renderPage();
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent("停用");
    // The backend only sets SUSPENDED — "永久删除" would be a lie.
    expect(container.textContent).not.toContain("永久删除");
    expect(container.textContent).not.toContain("彻底删除");
  });

  it("warns there is no self-service way back", () => {
    renderPage();
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent(
      "没有提供自助恢复入口",
    );
  });

  it("lists the concrete consequences, including that content is NOT removed", () => {
    renderPage();
    const facts = screen.getByTestId("delete-account-facts");
    expect(facts).toHaveTextContent("无法登录");
    expect(facts).toHaveTextContent("不会被自动删除");
    expect(facts).toHaveTextContent("不会向你发送确认邮件");
  });

  it("keeps the confirm button disabled until the exact phrase is typed", () => {
    renderPage();
    const button = screen.getByTestId("delete-account-confirm");
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用" },
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    expect(button).toBeEnabled();
  });

  it("does NOT call the API on a disabled submit", () => {
    renderPage();
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    expect(mocked.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("submits once the phrase matches and shows a terminal state", async () => {
    mocked.requestAccountDeletion.mockResolvedValue({ requested: true });
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    await waitFor(() => expect(mocked.requestAccountDeletion).toHaveBeenCalled());
    const done = await screen.findByTestId("delete-account-done");
    expect(done).toHaveTextContent("账号已停用");
  });

  it("surfaces a backend failure and stays on the form", async () => {
    mocked.requestAccountDeletion.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请先登录",
        status: 401,
        detail: "请先登录",
        code: "AUTH_REQUIRED",
      }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    expect(await screen.findByTestId("delete-account-error")).toHaveTextContent("请先登录");
    expect(screen.queryByTestId("delete-account-done")).not.toBeInTheDocument();
  });

  it("offers no cancel-deletion control — the backend has no such endpoint", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /撤销/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /取消停用/ })).not.toBeInTheDocument();
  });
});

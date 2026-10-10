import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/client";
import { accountApi } from "@/api/account/account.api";
import { clearStoredRecentAuth, setStoredRecentAuth } from "./recent-auth";
import { TOKEN_KEY } from "@/lib/storage";
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

/**
 * 2026-10-08 变化：页面新增了「需要先验证身份」的 Link，所以必须挂在 Router 下。
 * 之前的包装没有 Router —— 那不是 bug，是当时页面里确实一个链接都没有。
 */
function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsDeleteAccountPage />
    </MemoryRouter>,
  );
}

/** 一个尚未过期、因此可用的 grant。 */
function seedFreshGrant(id = "grant-fresh") {
  setStoredRecentAuth(id, new Date(Date.now() + 10 * 60_000).toISOString());
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("SettingsDeleteAccountPage — copy", () => {
  it("says 停用, never promising permanent deletion", () => {
    const { container } = renderPage();
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent("停用");
    // The backend only sets SUSPENDED — "永久删除" would be a lie.
    expect(container.textContent).not.toContain("永久删除");
    expect(container.textContent).not.toContain("彻底删除");
  });

  it("warns there is no self-service way back", () => {
    renderPage();
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent("没有提供自助恢复入口");
  });

  it("lists the concrete consequences, including that content is NOT removed", () => {
    renderPage();
    const facts = screen.getByTestId("delete-account-facts");
    expect(facts).toHaveTextContent("无法登录");
    expect(facts).toHaveTextContent("不会被自动删除");
    expect(facts).toHaveTextContent("不会向你发送确认邮件");
  });

  it("states that sessions and API Tokens die too, and that nothing is anonymised", () => {
    renderPage();
    const facts = screen.getByTestId("delete-account-facts");
    // 停用后鉴权按账号状态拒绝，会话与 API Token 都失效。
    expect(facts).toHaveTextContent("登录状态");
    expect(facts).toHaveTextContent("API Token");
    // 「停用」不是匿名化 —— 措辞必须留出这个区分。
    expect(facts).toHaveTextContent("不会被自动删除，也不会被匿名化");
  });

  it("offers no cancel-deletion control — the backend has no such endpoint", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /撤销/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /取消停用/ })).not.toBeInTheDocument();
  });
});

describe("SettingsDeleteAccountPage — re-auth is required (2026-10-08)", () => {
  it("asks for identity verification when no grant is stored, and never calls the API", () => {
    renderPage();
    expect(screen.getByTestId("delete-account-need-reauth")).toBeInTheDocument();
    // 打完确认短语也不能提交：没有凭证就没有"确认"的意义。
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    expect(screen.getByTestId("delete-account-confirm")).toBeDisabled();
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    expect(mocked.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("links to the re-auth page with a returnTo back here", () => {
    renderPage();
    const link = screen.getByRole("link", { name: "去验证身份" });
    expect(link).toHaveAttribute("href", "/settings/security/re-authenticate?returnTo=/settings/data/delete-account");
  });

  it("hides the re-auth prompt once a valid grant exists", () => {
    seedFreshGrant();
    renderPage();
    expect(screen.queryByTestId("delete-account-need-reauth")).not.toBeInTheDocument();
  });

  it("sends the grant id as X-Recent-Auth (via accountApi), not the password", async () => {
    seedFreshGrant("grant-abc");
    mocked.requestAccountDeletion.mockResolvedValue({ requested: true });
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    await waitFor(() =>
      expect(mocked.requestAccountDeletion).toHaveBeenCalledWith("grant-abc"),
    );
  });
});

describe("SettingsDeleteAccountPage — submit", () => {
  it("keeps the confirm button disabled until the exact phrase is typed", () => {
    seedFreshGrant();
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
    seedFreshGrant();
    renderPage();
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    expect(mocked.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("submits once the phrase matches and shows a terminal state", async () => {
    seedFreshGrant();
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

  it("clears the local session token on success — the server just revoked every session", async () => {
    seedFreshGrant();
    localStorage.setItem(TOKEN_KEY, "stale-token");
    mocked.requestAccountDeletion.mockResolvedValue({ requested: true });
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    await screen.findByTestId("delete-account-done");
    // 留着它只会让下一个请求拿到 401，看起来像"页面坏了"。
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem("xingyu-recent-auth")).toBeNull();
  });

  it("drops the grant and demands a NEW one after a failure", async () => {
    seedFreshGrant("grant-once");
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
    // 不管失败原因是什么（网络错误时 grant 其实还能用），本地一律作废并要求重新
    // 验证：多输一次密码的代价，远小于一个已被消费掉的凭证被反复重放。
    expect(sessionStorage.getItem("xingyu-recent-auth")).toBeNull();
    expect(screen.getByTestId("delete-account-need-reauth")).toBeInTheDocument();
  });

  it("keeps the session token when deactivation did NOT succeed", async () => {
    seedFreshGrant();
    localStorage.setItem(TOKEN_KEY, "still-valid-token");
    mocked.requestAccountDeletion.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请稍后再试",
        status: 500,
        detail: "请稍后再试",
        code: "INTERNAL",
      }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    await screen.findByTestId("delete-account-error");
    // 停用没发生，会话是好的 —— 清掉它会把一次普通失败变成强制登出。
    expect(localStorage.getItem(TOKEN_KEY)).toBe("still-valid-token");
  });

  it("explains a consumed grant distinctly from an expired one", async () => {
    setStoredRecentAuth("grant-used", new Date(Date.now() + 10 * 60_000).toISOString());
    mocked.requestAccountDeletion.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "身份再认证已被使用",
        status: 403,
        detail: "身份再认证已被使用，请重新验证身份后再试",
        code: "AUTH_FORBIDDEN",
      }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText(/请输入「停用账号」以确认/), {
      target: { value: "停用账号" },
    });
    fireEvent.submit(screen.getByTestId("delete-account-form"));
    expect(await screen.findByTestId("delete-account-error")).toHaveTextContent(
      "身份再认证已被使用",
    );
    clearStoredRecentAuth();
  });
});

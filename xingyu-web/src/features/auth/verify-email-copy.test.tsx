import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { authApi } from "@/api/auth/auth.api";
import { TOKEN_KEY } from "@/lib/storage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

/*
 * Email verification copy vs the real backend contract (2026-10-08).
 *
 * `sendVerificationMail()` returns false ONLY when the mail send did not throw;
 * on failure it returns true and the register response carries `mailPending`.
 * RegisterPage already forwards that as `?mailPending=1`. These tests pin the
 * receiving end: the page must NOT claim a delivery the backend never confirmed.
 *
 * `resendVerification()` additionally returns `mailPending:false` for three
 * short-circuit cases where nothing was sent at all (unknown email / already
 * verified / verification disabled) — indistinguishable from success by design
 * (anti-enumeration), so the resend copy must be conditional too.
 */

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
  },
}));

const mocked = vi.mocked(authApi);

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("VerifyEmailPage arrival copy", () => {
  it("states the link was sent when the register response reported no mail failure", () => {
    renderAt("?email=alice%40example.com&registered=1");

    expect(screen.getByRole("heading", { name: "验证你的邮箱" })).toBeInTheDocument();
    expect(screen.getByText(/验证链接已发往/)).toBeInTheDocument();
    // The not-sent branch must not appear.
    expect(screen.queryByText(/没有发出去/)).not.toBeInTheDocument();
  });

  it("says the mail was NOT sent when the backend reported mailPending", () => {
    // This is the case the page previously got wrong: it read nothing from the
    // URL and announced delivery anyway.
    renderAt("?email=alice%40example.com&registered=1&mailPending=1");

    expect(screen.getByRole("heading", { name: "验证邮件未发出" })).toBeInTheDocument();
    expect(screen.getByText(/没有发出去/)).toBeInTheDocument();
    expect(screen.queryByText(/验证链接已发往/)).not.toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("offers a retry exactly in the not-sent state", () => {
    renderAt("?email=alice%40example.com&registered=1&mailPending=1");

    // Retry is the whole point of this state, so the action must be present.
    expect(
      screen.getByRole("button", { name: "重新发送验证邮件" }),
    ).toBeEnabled();
  });
});

describe("VerifyEmailPage resend copy", () => {
  it("does not assert delivery when the backend reports mailPending", async () => {
    mocked.resendEmailVerification.mockResolvedValue({ acknowledged: true, mailPending: true });
    renderAt("?email=alice%40example.com&registered=1");

    await userEvent.click(screen.getByRole("button", { name: "重新发送验证邮件" }));

    expect(await screen.findByText("验证邮件发送失败，请稍后再试。")).toBeInTheDocument();
    expect(screen.queryByText(/请查收/)).not.toBeInTheDocument();
  });

  it("hedges the resend success because the backend cannot distinguish it", async () => {
    // mailPending:false means "either sent, or one of three short-circuits".
    mocked.resendEmailVerification.mockResolvedValue({ acknowledged: true, mailPending: false });
    renderAt("?email=alice%40example.com&registered=1");

    await userEvent.click(screen.getByRole("button", { name: "重新发送验证邮件" }));

    expect(await screen.findByText(/如该邮箱需要验证/)).toBeInTheDocument();
    // A bare "已发送" claim is what we are forbidding.
    expect(screen.queryByText(/^验证邮件已发送/)).not.toBeInTheDocument();
  });

  it("keeps retry available after a resend attempt", async () => {
    mocked.resendEmailVerification.mockResolvedValue({ acknowledged: true, mailPending: false });
    renderAt("?email=alice%40example.com&registered=1");

    await userEvent.click(screen.getByRole("button", { name: "重新发送验证邮件" }));
    await screen.findByText(/如该邮箱需要验证/);

    // The button used to latch to "已发送" and disable itself, which left a
    // reader whose mail never arrived with no way to try again.
    const again = screen.getByRole("button", { name: "重新发送验证邮件" });
    expect(again).toBeEnabled();
    await userEvent.click(again);
    expect(mocked.resendEmailVerification).toHaveBeenCalledTimes(2);
  });

  it("reports a thrown resend without claiming anything about delivery", async () => {
    mocked.resendEmailVerification.mockRejectedValue(new Error("network"));
    renderAt("?email=alice%40example.com&registered=1");

    await userEvent.click(screen.getByRole("button", { name: "重新发送验证邮件" }));

    expect(await screen.findByText("发送失败，请稍后再试。")).toBeInTheDocument();
    expect(screen.queryByText(/已发送/)).not.toBeInTheDocument();
  });
});

describe("VerifyEmailPage token states", () => {
  it("reports success once the backend confirms the token", async () => {
    mocked.verifyEmail.mockResolvedValue({ status: "VERIFIED" });
    renderAt("?token=good-token&email=alice%40example.com");

    expect(await screen.findByRole("heading", { name: "邮箱验证成功" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往登录" })).toBeInTheDocument();
  });

  it("reports an invalid token without asserting the mail went out", async () => {
    mocked.verifyEmail.mockRejectedValue(new Error("bad token"));
    renderAt("?token=stale-token&email=alice%40example.com");

    expect(await screen.findByRole("heading", { name: "验证未完成" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("验证失败，链接可能已过期");
    // A stale link is not evidence that any mail was delivered.
    expect(screen.queryByText(/验证链接已发往/)).not.toBeInTheDocument();
  });
});

/*
 * 2026-10-08 (Settings Contract Recovery, B1): the server now dispatches on the
 * token's purpose, so there are TWO success shapes. EMAIL_CHANGED is the one
 * that ends the session — the backend revoked every session on a successful
 * rebind — so the page has to both say so and drop the now-dead token.
 */
describe("VerifyEmailPage email-change confirmation", () => {
  it("announces the change with the new address and explains the logout", async () => {
    mocked.verifyEmail.mockResolvedValue({ status: "EMAIL_CHANGED", email: "new@example.com" });
    renderAt("?token=change-token&email=new%40example.com");

    expect(await screen.findByRole("heading", { name: "邮箱已更换" })).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    // "验证成功" would hide the fact that they are about to be logged out.
    expect(screen.queryByRole("heading", { name: "邮箱验证成功" })).not.toBeInTheDocument();
    expect(screen.getByText(/已退出你所有设备的登录状态/)).toBeInTheDocument();
    expect(screen.getByText(/原邮箱已不再用于登录/)).toBeInTheDocument();
  });

  it("clears the stale session token so the next request is not a confusing 401", async () => {
    localStorage.setItem(TOKEN_KEY, "old-session-token");
    sessionStorage.setItem("xingyu-recent-auth", JSON.stringify({ id: "g", expiresAt: "2999" }));
    mocked.verifyEmail.mockResolvedValue({ status: "EMAIL_CHANGED", email: "new@example.com" });
    renderAt("?token=change-token&email=new%40example.com");

    await screen.findByRole("heading", { name: "邮箱已更换" });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem("xingyu-recent-auth")).toBeNull();
  });

  it("keeps the plain verification success for a REGISTER token (no logout)", async () => {
    localStorage.setItem(TOKEN_KEY, "still-good-token");
    mocked.verifyEmail.mockResolvedValue({ status: "VERIFIED" });
    renderAt("?token=register-token&email=alice%40example.com");

    await screen.findByRole("heading", { name: "邮箱验证成功" });
    // A REGISTER token changes no credential, so the session must survive.
    expect(localStorage.getItem(TOKEN_KEY)).toBe("still-good-token");
  });

  it("falls back to the URL address when the server omits it", async () => {
    mocked.verifyEmail.mockResolvedValue({ status: "EMAIL_CHANGED" });
    renderAt("?token=change-token&email=from-url%40example.com");

    await screen.findByRole("heading", { name: "邮箱已更换" });
    expect(screen.getByText("from-url@example.com")).toBeInTheDocument();
  });

  it("offers a re-login link, not a continue-in-app link", async () => {
    mocked.verifyEmail.mockResolvedValue({ status: "EMAIL_CHANGED", email: "new@example.com" });
    renderAt("?token=change-token&email=new%40example.com");

    await screen.findByRole("heading", { name: "邮箱已更换" });
    expect(screen.getByRole("link", { name: "用新邮箱登录" })).toHaveAttribute("href", "/login");
  });
});

/*
 * 2026-10-09（Settings Static Design Final Fix，浏览器实测发现的缺陷）：
 * `main.tsx` 开着 StrictMode，dev 下每个组件 mount→unmount→mount，本页 effect 跑两遍。
 * `verifyEmail` 不是幂等端点 —— token 被第一个 POST 消费，第二个 POST 必得 400。
 * 修复前两遍各发一次请求：第一遍 200（后端真正改掉邮箱、撤销全部会话）但 cleanup 已把
 * 它的 active 置 false 被无视；第二遍 400 且是唯一 active 的一遍 → UI 显示「验证未完成」。
 * 实测 access log：10:22:46 一条 200 + 一条 400，DB 邮箱已改、会话已撤，UI 却报失败并
 * 诱导用户「重新发送」。修复：同一 token 的多遍 effect 共享同一个在途请求（单飞）。
 */
describe("VerifyEmailPage StrictMode double-mount guard", () => {
  it("fires exactly ONE verify request and keeps the success despite StrictMode", async () => {
    mocked.verifyEmail
      .mockResolvedValueOnce({ status: "EMAIL_CHANGED", email: "new@example.com" })
      .mockRejectedValueOnce(new Error("simulated consumed token: the 2nd POST always fails"));

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/verify-email?token=change-token&email=new%40example.com"]}>
          <VerifyEmailPage />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "邮箱已更换" })).toBeInTheDocument();
    expect(mocked.verifyEmail).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "验证未完成" })).not.toBeInTheDocument();
  });

  it("still reports a genuine invalid token under StrictMode", async () => {
    mocked.verifyEmail.mockRejectedValue(new Error("EMAIL_TOKEN_INVALID"));

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/verify-email?token=stale-token&email=alice%40example.com"]}>
          <VerifyEmailPage />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "验证未完成" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("验证失败，链接可能已过期");
  });
});
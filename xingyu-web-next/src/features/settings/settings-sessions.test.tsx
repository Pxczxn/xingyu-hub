import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sessionsApi } from "@/api/settings/sessions.api";
import type { SessionSummary } from "@/api/settings/sessions.types";
import { ApiError } from "@/api/client";
import { SettingsSessionsPage } from "./pages/SettingsSessionsPage";

/*
 * /settings/sessions behaviour: list, current-session marking, only-current,
 * load error, and the two destructive flows (revoke one / revoke others).
 *
 * The current session must never expose a revoke control: the backend accepts
 * revoking your own session id and immediately invalidates the calling token
 * (verified live 2026-09-22).
 */

vi.mock("@/api/settings/sessions.api", () => ({
  sessionsApi: {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeOthers: vi.fn(),
  },
}));

const mocked = vi.mocked(sessionsApi);

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "s-current",
    deviceLabel: "浏览器",
    lastActiveAt: "2026-09-22T11:49:38Z",
    expiresAt: "2026-09-23T11:49:38Z",
    revoked: false,
    current: false,
    ...overrides,
  };
}

const currentSession = session({ sessionId: "s-current", current: true, deviceLabel: "当前设备" });
const otherSession = session({ sessionId: "s-other", current: false, deviceLabel: "旧设备" });

beforeEach(() => {
  mocked.list.mockReset();
  mocked.revoke.mockReset();
  mocked.revokeOthers.mockReset();
});

describe("SettingsSessionsPage — list", () => {
  it("renders every session with its metadata", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);

    render(<SettingsSessionsPage />);

    expect(await screen.findByText("当前设备")).toBeInTheDocument();
    expect(screen.getByText("旧设备")).toBeInTheDocument();
    expect(screen.getAllByTestId("session-last-active")).toHaveLength(2);
    expect(screen.getAllByTestId("session-expires")).toHaveLength(2);
  });

  it("marks the current session exactly once", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);

    render(<SettingsSessionsPage />);

    await screen.findByText("当前设备");
    expect(screen.getAllByTestId("session-current-badge")).toHaveLength(1);
  });

  it("offers no revoke control on the current session", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);

    render(<SettingsSessionsPage />);

    await screen.findByText("当前设备");
    expect(screen.queryByTestId("session-revoke-s-current")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-revoke-s-other")).toBeInTheDocument();
  });

  it("shows an empty state when there are no sessions", async () => {
    mocked.list.mockResolvedValue([]);

    render(<SettingsSessionsPage />);

    expect(await screen.findByText("暂无登录会话")).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-list")).not.toBeInTheDocument();
  });

  it("hides the revoke-others action when the current session is the only one", async () => {
    mocked.list.mockResolvedValue([currentSession]);

    render(<SettingsSessionsPage />);

    await screen.findByText("当前设备");
    expect(screen.queryByTestId("sessions-revoke-others")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sessions-list")).toBeInTheDocument();
  });

  it("surfaces a load failure and offers a retry", async () => {
    mocked.list.mockRejectedValueOnce(
      new ApiError({ type: "about:blank", title: "x", status: 500, detail: "boom", code: "INTERNAL_ERROR" }),
    );

    render(<SettingsSessionsPage />);
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    mocked.list.mockResolvedValueOnce([currentSession]);
    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("当前设备")).toBeInTheDocument();
  });
});

describe("SettingsSessionsPage — revoke one", () => {
  it("requires confirmation before calling the backend", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);
    mocked.revoke.mockResolvedValue(undefined);

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("session-revoke-s-other"));

    // First click only reveals the confirmation — nothing has been sent yet.
    expect(mocked.revoke).not.toHaveBeenCalled();
    expect(screen.getByText("确认退出该会话？")).toBeInTheDocument();
  });

  it("revokes the confirmed session and reloads the list", async () => {
    mocked.list.mockResolvedValueOnce([currentSession, otherSession]);
    mocked.list.mockResolvedValueOnce([currentSession]);
    mocked.revoke.mockResolvedValue(undefined);

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("session-revoke-s-other"));
    await userEvent.click(screen.getByTestId("session-revoke-confirm-s-other"));

    await waitFor(() => expect(mocked.revoke).toHaveBeenCalledWith("s-other"));
    await waitFor(() => expect(mocked.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("旧设备")).not.toBeInTheDocument());
  });

  it("can be cancelled without calling the backend", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("session-revoke-s-other"));
    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(mocked.revoke).not.toHaveBeenCalled();
    expect(screen.queryByText("确认退出该会话？")).not.toBeInTheDocument();
  });

  it("reports a revoke failure and keeps the session listed", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);
    mocked.revoke.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "x", status: 404, detail: "会话不存在", code: "NOT_FOUND" }),
    );

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("session-revoke-s-other"));
    await userEvent.click(screen.getByTestId("session-revoke-confirm-s-other"));

    expect(await screen.findByTestId("sessions-action-error")).toHaveTextContent("会话不存在");
    expect(screen.getByText("旧设备")).toBeInTheDocument();
    // No reload happened, so the list still reflects the pre-action state.
    expect(mocked.list).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsSessionsPage — revoke others", () => {
  it("requires confirmation and reports how many will be signed out", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("sessions-revoke-others"));

    expect(mocked.revokeOthers).not.toHaveBeenCalled();
    expect(screen.getByText(/确认退出其它 1 个会话/)).toBeInTheDocument();
  });

  it("revokes the others and reloads", async () => {
    mocked.list.mockResolvedValueOnce([currentSession, otherSession]);
    mocked.list.mockResolvedValueOnce([currentSession]);
    mocked.revokeOthers.mockResolvedValue(undefined);

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("sessions-revoke-others"));
    await userEvent.click(screen.getByTestId("sessions-revoke-others-confirm"));

    await waitFor(() => expect(mocked.revokeOthers).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("旧设备")).not.toBeInTheDocument());
    // The current session survives.
    expect(screen.getByText("当前设备")).toBeInTheDocument();
  });

  it("reports a revoke-others failure", async () => {
    mocked.list.mockResolvedValue([currentSession, otherSession]);
    mocked.revokeOthers.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "x", status: 500, detail: "系统繁忙", code: "INTERNAL_ERROR" }),
    );

    render(<SettingsSessionsPage />);

    await userEvent.click(await screen.findByTestId("sessions-revoke-others"));
    await userEvent.click(screen.getByTestId("sessions-revoke-others-confirm"));

    expect(await screen.findByTestId("sessions-action-error")).toHaveTextContent("系统繁忙");
    expect(screen.getByText("旧设备")).toBeInTheDocument();
  });
});

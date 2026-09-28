import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/client";
import type { BlockedUser } from "@/api/users/users.types";
import { loadBlockedUsers, unblockUser } from "@/features/blocks/blocked-users.store";
import { SettingsBlocksPage } from "./pages/SettingsBlocksPage";

/*
 * /settings/blocks — blocked user list + unblock (Phase 2A-2a).
 *
 * The list comes from GET /me/blocks through the shared store (block state has no
 * dedicated endpoint). Unblocking needs no confirmation — it is not destructive
 * and the backend does not restore the follows blocking removed. A failure keeps
 * the row listed and surfaces the reason, never a fake success.
 */

vi.mock("@/features/blocks/blocked-users.store", () => ({
  loadBlockedUsers: vi.fn(),
  unblockUser: vi.fn(),
}));

const mockedLoad = vi.mocked(loadBlockedUsers);
const mockedUnblock = vi.mocked(unblockUser);

function blockedUser(overrides: Partial<BlockedUser> = {}): BlockedUser {
  return {
    userId: "u-1",
    username: "alice",
    displayName: "Alice",
    blockedAt: "2026-09-23T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockedLoad.mockReset();
  mockedUnblock.mockReset();
});

describe("SettingsBlocksPage — list", () => {
  it("renders each blocked user", async () => {
    mockedLoad.mockResolvedValue([
      blockedUser(),
      blockedUser({ userId: "u-2", username: "bob", displayName: null }),
    ]);

    render(<SettingsBlocksPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    // A user without a display name falls back to the username.
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByTestId("blocked-at-alice")).toBeInTheDocument();
    expect(screen.getByTestId("unblock-alice")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is blocked", async () => {
    mockedLoad.mockResolvedValue([]);

    render(<SettingsBlocksPage />);

    expect(await screen.findByText("还没有屏蔽任何用户")).toBeInTheDocument();
    expect(screen.queryByTestId("blocks-list")).not.toBeInTheDocument();
  });

  it("surfaces a load failure and offers a retry", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("500"));

    render(<SettingsBlocksPage />);
    expect(await screen.findByTestId("page-state-error")).toBeInTheDocument();

    mockedLoad.mockResolvedValueOnce([blockedUser()]);
    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });
});

describe("SettingsBlocksPage — unblock", () => {
  it("unblocks the user and reloads the list", async () => {
    mockedLoad.mockResolvedValueOnce([blockedUser()]);
    mockedLoad.mockResolvedValueOnce([]);
    mockedUnblock.mockResolvedValue(undefined);

    render(<SettingsBlocksPage />);

    await userEvent.click(await screen.findByTestId("unblock-alice"));

    await waitFor(() => expect(mockedUnblock).toHaveBeenCalledWith("alice"));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("还没有屏蔽任何用户")).toBeInTheDocument();
  });

  it("reports a failure and keeps the user listed", async () => {
    mockedLoad.mockResolvedValue([blockedUser()]);
    mockedUnblock.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );

    render(<SettingsBlocksPage />);

    await userEvent.click(await screen.findByTestId("unblock-alice"));

    expect(await screen.findByTestId("blocks-action-error")).toHaveTextContent("资源不存在");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    // No reload happened: the row still reflects the state the backend reports.
    expect(mockedLoad).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate click", async () => {
    mockedLoad.mockResolvedValue([blockedUser()]);
    let release: (() => void) | undefined;
    mockedUnblock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(<SettingsBlocksPage />);
    const button = await screen.findByTestId("unblock-alice");

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockedUnblock).toHaveBeenCalledTimes(1);

    release?.();
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledTimes(2));
  });
});

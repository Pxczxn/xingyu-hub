import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import { ApiError } from "@/api/client";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { UserProfilePage } from "@/features/profile/pages/UserProfilePage";
import {
  blockUser,
  isBlockedUsername,
  loadBlockedUsers,
  unblockUser,
} from "@/features/blocks/blocked-users.store";

/*
 * Phase 2A-2a — the block entry on /u/:username.
 *
 * Behaviour pinned here:
 *   - guests and your OWN profile get no block control (backend rejects self-block
 *     with 400, so exposing it would be a meaningless control)
 *   - blocking requires an explicit confirmation; cancelling sends nothing
 *   - a confirmed block re-syncs the real profile (blocking also drops follows
 *     both ways server-side, so the header must not keep a stale "已关注")
 *   - a failure keeps the previous relationship state and reports the reason
 *   - an already-blocked user shows "解除屏蔽"
 *   - a duplicate confirm click fires exactly one request
 */

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    getMyProfile: vi.fn(),
    listBlockedUsers: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

vi.mock("@/features/blocks/blocked-users.store", () => ({
  loadBlockedUsers: vi.fn(async () => []),
  isBlockedUsername: vi.fn(() => false),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true })),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockedGetProfile = vi.mocked(usersApi.getProfile);
const mockedGetUserWorks = vi.mocked(usersApi.getUserWorks);
const mockedLoad = vi.mocked(loadBlockedUsers);
const mockedIsBlocked = vi.mocked(isBlockedUsername);
const mockedBlockUser = vi.mocked(blockUser);
const mockedUnblockUser = vi.mocked(unblockUser);

const PROFILE = {
  username: "pxczxn",
  displayName: "破星辰",
  bio: "简介",
  followerCount: 1,
  followingCount: 0,
  articleCount: 4,
  following: false,
  owner: false,
};

function renderAt(username: string) {
  return render(
    <MemoryRouter initialEntries={[`/u/${username}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/u/:username" element={<UserProfilePage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockedGetProfile.mockResolvedValue(PROFILE);
  mockedGetUserWorks.mockResolvedValue({
    username: "pxczxn",
    spaceSlug: "default",
    owner: false,
    categories: [],
    works: [],
  });
  mockedLoad.mockResolvedValue([]);
  mockedIsBlocked.mockReturnValue(false);
});

describe("block entry visibility", () => {
  it("shows the block entry on someone else's profile", async () => {
    setStoredToken("tok");

    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-block")).toHaveTextContent("屏蔽此用户");
  });

  it("never offers to block yourself", async () => {
    setStoredToken("tok");
    mockedGetProfile.mockResolvedValue({ ...PROFILE, owner: true });

    renderAt("pxczxn");

    expect(await screen.findByText("这是你的主页")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-block")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-unblock")).not.toBeInTheDocument();
  });

  it("shows no block control to a guest", async () => {
    renderAt("pxczxn");

    expect(await screen.findByRole("heading", { name: "破星辰" })).toBeInTheDocument();
    expect(screen.queryByTestId("profile-block")).not.toBeInTheDocument();
  });

  it("hides the block control when block state cannot be read", async () => {
    setStoredToken("tok");
    mockedLoad.mockRejectedValue(new Error("500"));

    renderAt("pxczxn");

    expect(await screen.findByRole("heading", { name: "破星辰" })).toBeInTheDocument();
    await waitFor(() => expect(mockedLoad).toHaveBeenCalled());
    expect(screen.queryByTestId("profile-block")).not.toBeInTheDocument();
  });
});

describe("blocking", () => {
  it("requires confirmation before sending anything", async () => {
    setStoredToken("tok");

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-block"));

    expect(mockedBlockUser).not.toHaveBeenCalled();
    expect(screen.getByTestId("profile-block-confirm")).toBeInTheDocument();
  });

  it("can be cancelled without sending anything", async () => {
    setStoredToken("tok");

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-block"));
    await userEvent.click(screen.getByTestId("profile-block-cancel"));

    expect(mockedBlockUser).not.toHaveBeenCalled();
    expect(screen.getByTestId("profile-block")).toHaveTextContent("屏蔽此用户");
  });

  it("blocks after confirmation, then re-syncs the real profile state", async () => {
    setStoredToken("tok");
    mockedGetProfile
      .mockResolvedValueOnce({ ...PROFILE, following: true })
      .mockResolvedValue({ ...PROFILE, following: false });
    mockedBlockUser.mockResolvedValue(undefined);

    renderAt("pxczxn");
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();

    // The block control only appears once the block list has been read.
    await userEvent.click(await screen.findByTestId("profile-block"));
    await userEvent.click(screen.getByTestId("profile-block-confirm-button"));

    await waitFor(() => expect(mockedBlockUser).toHaveBeenCalledWith("pxczxn"));
    expect(await screen.findByTestId("profile-unblock")).toBeInTheDocument();
    // Blocking removes follows both ways, so the follow state must be re-read —
    // it must not keep showing a stale "已关注".
    await waitFor(() => expect(mockedGetProfile).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
  });

  it("reports a failure and keeps the original state", async () => {
    setStoredToken("tok");
    mockedBlockUser.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "请求参数无效",
        status: 400,
        detail: "username: 不能屏蔽自己",
        code: "VALIDATION_FAILED",
      }),
    );

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-block"));
    await userEvent.click(screen.getByTestId("profile-block-confirm-button"));

    expect(await screen.findByTestId("profile-block-error")).toHaveTextContent("不能屏蔽自己");
    expect(screen.getByTestId("profile-block")).toHaveTextContent("屏蔽此用户");
    expect(screen.queryByTestId("profile-unblock")).not.toBeInTheDocument();
    // No re-sync: nothing changed server-side.
    expect(mockedGetProfile).toHaveBeenCalledTimes(1);
  });

  it("ignores a duplicate confirm click", async () => {
    setStoredToken("tok");
    let release: (() => void) | undefined;
    mockedBlockUser.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-block"));
    const confirm = screen.getByTestId("profile-block-confirm-button");

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mockedBlockUser).toHaveBeenCalledTimes(1);

    release?.();
    expect(await screen.findByTestId("profile-unblock")).toBeInTheDocument();
  });
});

describe("unblocking", () => {
  it("shows unblock when the user is already blocked", async () => {
    setStoredToken("tok");
    mockedIsBlocked.mockReturnValue(true);

    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-unblock")).toHaveTextContent("解除屏蔽");
  });

  it("unblocks without a confirmation and returns to the block state", async () => {
    setStoredToken("tok");
    mockedIsBlocked.mockReturnValue(true);
    mockedUnblockUser.mockResolvedValue(undefined);

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-unblock"));

    await waitFor(() => expect(mockedUnblockUser).toHaveBeenCalledWith("pxczxn"));
    expect(await screen.findByTestId("profile-block")).toHaveTextContent("屏蔽此用户");
  });

  it("reports an unblock failure and stays blocked", async () => {
    setStoredToken("tok");
    mockedIsBlocked.mockReturnValue(true);
    mockedUnblockUser.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
    );

    renderAt("pxczxn");
    await userEvent.click(await screen.findByTestId("profile-unblock"));

    expect(await screen.findByTestId("profile-block-error")).toHaveTextContent("资源不存在");
    expect(screen.getByTestId("profile-unblock")).toBeInTheDocument();
  });
});

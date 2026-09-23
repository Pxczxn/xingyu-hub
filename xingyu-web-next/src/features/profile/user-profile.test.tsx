import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import { ApiError } from "@/api/client";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { UserProfilePage } from "./pages/UserProfilePage";

/*
 * Profile tests: username param, success, not found, works, empty works,
 * user follow / unfollow / failure rollback.
 * User follow is verified working on the real backend (204 both ways).
 */

vi.mock("@/api/users/users.api", () => ({
  usersApi: {
    getProfile: vi.fn(),
    getUserWorks: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    getMyProfile: vi.fn(),
    // Phase 2A-2a: the profile page reads block state through the shared store,
    // which calls listBlockedUsers. Block behaviour itself is covered by
    // profile-block.test.tsx.
    listBlockedUsers: vi.fn(async () => []),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
}));

vi.mock("@/api/auth/auth.api", () => ({
  authApi: {
    getMe: vi.fn(async () => ({ email: "a@b.c", emailVerified: true })),
    login: vi.fn(),
    logout: vi.fn(),
    getPublicConfig: vi.fn(),
    getCaptcha: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendEmailVerification: vi.fn(),
    requestPasswordRecovery: vi.fn(),
    resetPassword: vi.fn(),
    forceChangePassword: vi.fn(),
    sendRegisterSms: vi.fn(),
  },
}));

const mocked = vi.mocked(usersApi);

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
  mocked.getUserWorks.mockResolvedValue({
    username: "pxczxn",
    spaceSlug: "default",
    owner: false,
    categories: [],
    works: [{ id: "w1", title: "作品一" }],
  });
});

describe("user profile", () => {
  it("loads the profile for the :username param", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    renderAt("pxczxn");

    await waitFor(() => expect(mocked.getProfile).toHaveBeenCalledWith("pxczxn"));
    expect(await screen.findByRole("heading", { name: "破星辰" })).toBeInTheDocument();
    expect(screen.getByText("@pxczxn")).toBeInTheDocument();
  });

  it("renders stats and works", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-stats")).toBeInTheDocument();
    expect(screen.getByTestId("works-list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "作品一" })).toHaveAttribute("href", "/articles/w1");
  });

  it("shows an empty state for a user with no works", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue({
      username: "pxczxn",
      spaceSlug: "default",
      owner: false,
      categories: [],
      works: [],
    });
    renderAt("pxczxn");

    expect(await screen.findByTestId("works-empty")).toBeInTheDocument();
  });

  it("shows not-found for an unknown user", async () => {
    mocked.getProfile.mockRejectedValue(
      new ApiError({ type: "about:blank", title: "资源不存在", status: 404, detail: "资源不存在", code: "NOT_FOUND" }),
    );
    renderAt("ghost");

    expect(await screen.findByText("用户不存在")).toBeInTheDocument();
  });

  it("degrades only the works section when works fail", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockRejectedValue(new Error("500"));
    renderAt("pxczxn");

    expect(await screen.findByTestId("works-error")).toBeInTheDocument();
    // The profile itself still renders.
    expect(screen.getByRole("heading", { name: "破星辰" })).toBeInTheDocument();
  });
});

describe("user follow", () => {
  it("follows a user optimistically", async () => {
    setStoredToken("tok");
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.followUser.mockResolvedValue(undefined);

    renderAt("pxczxn");
    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.followUser).toHaveBeenCalledWith("pxczxn"));
    expect(await screen.findByRole("button", { name: "已关注" })).toBeInTheDocument();
  });

  it("unfollows a user", async () => {
    setStoredToken("tok");
    mocked.getProfile.mockResolvedValue({ ...PROFILE, following: true });
    mocked.unfollowUser.mockResolvedValue(undefined);

    renderAt("pxczxn");
    const button = await screen.findByRole("button", { name: "已关注" });
    await userEvent.click(button);

    await waitFor(() => expect(mocked.unfollowUser).toHaveBeenCalledWith("pxczxn"));
    expect(await screen.findByRole("button", { name: "关注" })).toBeInTheDocument();
  });

  it("rolls back when follow fails", async () => {
    setStoredToken("tok");
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.followUser.mockRejectedValue(new Error("500"));

    renderAt("pxczxn");
    const button = await screen.findByRole("button", { name: "关注" });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "关注" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "已关注" })).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("操作失败");
  });

  it("prompts guests to sign in instead of following", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    renderAt("pxczxn");
    expect(await screen.findByRole("link", { name: "登录后关注" })).toBeInTheDocument();
    expect(mocked.followUser).not.toHaveBeenCalled();
  });
});

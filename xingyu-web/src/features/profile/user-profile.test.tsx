import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import type { SpaceWorkItem, SpaceWorks } from "@/api/users/users.types";
import { ApiError } from "@/api/client";
import { setStoredToken } from "@/lib/storage";
import { AuthProvider } from "@/features/auth/auth.store";
import { UserProfilePage } from "./pages/UserProfilePage";

/*
 * Profile tests: username param, success, not found, works, empty works,
 * user follow / unfollow / failure rollback.
 * User follow is verified working on the real backend (204 both ways).
 *
 * 批次 06 (S4) adds the category-filter suite at the bottom. The plan's
 * 「作品流 tab（文章 / 系列 / 动态）」 cannot be built — the backend has no user-scoped
 * series or moments list — so the filter bar carries the one real second dimension.
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

const CATEGORIES: SpaceWorks["categories"] = [
  { id: "c1", name: "技术笔记", slug: "tech-notes" },
  { id: "c2", name: "随笔", slug: "essay" },
];

/**
 * `GET /users/{username}/works` response. `categories` is the FULL list even when a
 * category filter is applied — that is the backend's behaviour
 * (CreationSpaceService.getPublicWorks builds it independently of `categorySlug`),
 * and the reason the chips survive a filter change.
 */
function worksPage(
  works: SpaceWorkItem[],
  categories: SpaceWorks["categories"] = CATEGORIES,
): SpaceWorks {
  return { username: "pxczxn", spaceSlug: "default", owner: false, categories, works };
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
      new ApiError({
        type: "about:blank",
        title: "资源不存在",
        status: 404,
        detail: "资源不存在",
        code: "NOT_FOUND",
      }),
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

/*
 * 批次 06（S4）。方案 §4.3 的「作品流 tab（文章 / 系列 / 动态）」建不出来：用户维度端点
 * 里没有 series 也没有 moments，三个 tab 里两个没有数据源。承担这一维的是创作空间分类。
 *
 * 第三条用例锁的是整条设计的承重假设 —— 筛选后的响应仍然带全量 `categories`
 * （CreationSpaceService.getPublicWorks 独立构建它，与 `categorySlug` 无关），筛选条
 * 因此不会自我塌缩，「回到全部」的出口始终留在屏幕上。
 */
describe("user profile category filter", () => {
  it("renders the full chip list with 全部 active", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(worksPage([{ id: "w1", title: "作品一" }]));
    renderAt("pxczxn");

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    expect(within(group).getAllByRole("button")).toHaveLength(CATEGORIES.length + 1);
    expect(within(group).getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "技术笔记" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(group).getByRole("button", { name: "随笔" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("re-requests with the category param when a chip is clicked", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(worksPage([{ id: "w1", title: "作品一" }]));
    renderAt("pxczxn");

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    // Unfiltered first load: the param is absent, not an empty string.
    expect(mocked.getUserWorks).toHaveBeenCalledWith("pxczxn", undefined);

    await userEvent.click(within(group).getByRole("button", { name: "技术笔记" }));

    await waitFor(() => expect(mocked.getUserWorks).toHaveBeenCalledWith("pxczxn", "tech-notes"));
    expect(within(group).getByRole("button", { name: "技术笔记" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps the chips on screen after a filtered response", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks
      .mockResolvedValueOnce(worksPage([{ id: "w1", title: "作品一" }]))
      // Filtered response: no works, but the FULL category list.
      .mockResolvedValueOnce(worksPage([], CATEGORIES));
    renderAt("pxczxn");

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    await userEvent.click(within(group).getByRole("button", { name: "随笔" }));

    // The empty state names the category instead of claiming the author has no articles
    // at all -- an unfiltered 「还没有公开文章」 would be a lie here.
    expect(await screen.findByTestId("works-empty")).toHaveTextContent("「随笔」");
    // ...and 全部 is still on screen to get back out. This is what NOT clearing `works`
    // on a category change buys.
    expect(within(group).getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(group).getByRole("button", { name: "随笔" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("dims the previous list instead of collapsing it while a filter request is in flight", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    let release!: (value: SpaceWorks) => void;
    mocked.getUserWorks
      .mockResolvedValueOnce(worksPage([{ id: "w1", title: "作品一" }]))
      .mockImplementationOnce(() => new Promise<SpaceWorks>((resolve) => (release = resolve)));
    renderAt("pxczxn");

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    await userEvent.click(within(group).getByRole("button", { name: "技术笔记" }));

    // Old list still mounted, flagged busy and dimmed -- not replaced by a loading card.
    const list = screen.getByTestId("works-list");
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(list.className).toContain("opacity-60");
    expect(screen.getByRole("link", { name: "作品一" })).toBeInTheDocument();

    await act(async () => release(worksPage([{ id: "w2", title: "作品二" }])));

    await waitFor(() => expect(screen.getByTestId("works-list")).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("link", { name: "作品二" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "作品一" })).not.toBeInTheDocument();
  });

  it("does not re-request when the active chip is clicked again", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(worksPage([{ id: "w1", title: "作品一" }]));
    renderAt("pxczxn");

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    await userEvent.click(within(group).getByRole("button", { name: "全部" }));
    await act(async () => {}); // flush anything the click queued

    expect(mocked.getUserWorks).toHaveBeenCalledTimes(1);
  });

  it("renders no filter bar when the space has no categories", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    // beforeEach already resolves a works page with `categories: []`.
    renderAt("pxczxn");

    expect(await screen.findByTestId("works-list")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "按分类筛选文章" })).not.toBeInTheDocument();
  });

  it("does not carry the selected category to another profile", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(worksPage([{ id: "w1", title: "作品一" }]));

    // A switcher link, because React does NOT remount UserProfilePage when only the
    // :username param changes -- which is the whole reason the filter state carries the
    // username it was chosen on.
    render(
      <MemoryRouter initialEntries={["/u/pxczxn"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/u/:username"
              element={
                <>
                  <Link to="/u/other">换个主页</Link>
                  <UserProfilePage />
                </>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    const group = await screen.findByRole("group", { name: "按分类筛选文章" });
    await userEvent.click(within(group).getByRole("button", { name: "技术笔记" }));
    await waitFor(() => expect(mocked.getUserWorks).toHaveBeenCalledWith("pxczxn", "tech-notes"));

    await userEvent.click(screen.getByRole("link", { name: "换个主页" }));

    // Exactly one request for the new profile, and it must not carry the old category.
    await waitFor(() =>
      expect(mocked.getUserWorks.mock.calls.filter(([name]) => name === "other")).toHaveLength(1),
    );
    expect(mocked.getUserWorks.mock.calls.find(([name]) => name === "other")?.[1]).toBeUndefined();
  });
});

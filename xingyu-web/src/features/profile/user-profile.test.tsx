import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { usersApi } from "@/api/users/users.api";
import type { SpaceWorkItem, SpaceWorks } from "@/api/users/users.types";
import { momentsApi } from "@/api/moments/moments.api";
import { seriesApi } from "@/api/series/series.api";
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
 * 「作品流 tab（文章 / 系列 / 动态）」 could not be built at the time — the backend had no
 * user-scoped series or moments list — so the filter bar carries the one real second
 * dimension. 2026-10-30 added GET /users/{username}/moments; the profile now renders a
 * separate 公开动态 section, while series remains without a user-scoped endpoint.
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

vi.mock("@/api/moments/moments.api", () => ({
  momentsApi: { listByUsername: vi.fn() },
}));

vi.mock("@/api/series/series.api", () => ({
  seriesApi: { listByUsername: vi.fn() },
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
const mockedMoments = vi.mocked(momentsApi);
const mockedSeries = vi.mocked(seriesApi);

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

/** One row of `GET /users/{username}/series`. */
function seriesSummary(id: string, title: string) {
  return {
    id,
    title,
    slug: id,
    description: null,
    chapterCount: 3,
    author: { username: "pxczxn", displayName: "破星辰", avatar: null },
  };
}

/** One row of `GET /users/{username}/moments`. */
function momentView(id: string, body: string) {
  return {
    id,
    body,
    authorId: "u1",
    authorUsername: "pxczxn",
    authorDisplayName: "破星辰",
    createdAt: "2026-10-30T00:00:00Z",
    likeCount: 0,
    commentCount: 0,
    liked: null,
  };
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
  mockedMoments.listByUsername.mockResolvedValue({ items: [], nextCursor: null });
  mockedSeries.listByUsername.mockResolvedValue({ items: [], nextCursor: null });
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

  it("renders the public moment count and the moment list", async () => {
    mocked.getProfile.mockResolvedValue({ ...PROFILE, momentCount: 1 });
    mockedMoments.listByUsername.mockResolvedValue({
      items: [
        {
          id: "m1",
          body: "主页上的公开动态",
          authorId: "u1",
          authorUsername: "pxczxn",
          authorDisplayName: "破星辰",
          createdAt: "2026-10-30T00:00:00Z",
          likeCount: 2,
          commentCount: 1,
          liked: null,
        },
      ],
      nextCursor: null,
    });
    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-moments-list")).toBeInTheDocument();
    expect(screen.getByText("主页上的公开动态")).toBeInTheDocument();
    // 正文字宽与 feed/detail 共用同一个 MOMENT_MEASURE（46rem），不能拉满主栏。
    expect(screen.getByText("主页上的公开动态")).toHaveClass("max-w-[46rem]");
    expect(screen.getByRole("link", { name: /主页上的公开动态/ })).toHaveAttribute(
      "href",
      "/moments/m1",
    );
    expect(within(screen.getByTestId("profile-stats")).getByText("动态")).toBeInTheDocument();
  });

  it("degrades only the series section and retries it in place", async () => {
    mocked.getProfile.mockResolvedValue({ ...PROFILE, seriesCount: 1 });
    mockedSeries.listByUsername.mockRejectedValueOnce(new Error("offline"));
    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-series-error")).toBeInTheDocument();
    // 系列失败只降级这一块：公开文章与动态必须照常渲染。
    expect(await screen.findByRole("link", { name: "作品一" })).toBeInTheDocument();
    expect(mocked.getProfile).toHaveBeenCalledTimes(1);

    mockedSeries.listByUsername.mockResolvedValue({
      items: [seriesSummary("s1", "公开系列一")],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "重新加载系列" }));

    expect(await screen.findByText("公开系列一")).toBeInTheDocument();
    expect(mocked.getProfile).toHaveBeenCalledTimes(1);
  });

  it("pages the series section, de-duplicates rows, and hides the author line", async () => {
    mocked.getProfile.mockResolvedValue({ ...PROFILE, seriesCount: 2 });
    mockedSeries.listByUsername.mockResolvedValueOnce({
      items: [seriesSummary("s1", "系列一")],
      nextCursor: "series-page-2",
    });
    renderAt("pxczxn");

    const firstCard = await screen.findByRole("link", { name: /系列一/ });
    expect(firstCard).toHaveAttribute("href", "/series/s1");
    // 身份带已经写了作者名，卡片页脚不重复。
    expect(within(firstCard).queryByText("破星辰")).not.toBeInTheDocument();
    // 页脚左右各占一个锚点：章节数在左，查看系列在右。
    const seriesFooter = within(firstCard)
      .getByText(/查看系列/)
      .closest("div");
    expect(seriesFooter?.firstElementChild).toHaveTextContent("3 章");

    mockedSeries.listByUsername.mockResolvedValueOnce({
      items: [seriesSummary("s1", "系列一"), seriesSummary("s2", "系列二")],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "加载更多系列" }));

    expect(await screen.findByText("系列二")).toBeInTheDocument();
    expect(mockedSeries.listByUsername).toHaveBeenLastCalledWith("pxczxn", {
      cursor: "series-page-2",
    });
    expect(screen.getAllByText("系列一")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "加载更多系列" })).not.toBeInTheDocument();
  });

  it("retries only the moments block after a failure", async () => {
    mocked.getProfile.mockResolvedValue({ ...PROFILE, momentCount: 1 });
    mockedMoments.listByUsername.mockRejectedValueOnce(new Error("offline"));
    renderAt("pxczxn");

    expect(await screen.findByTestId("profile-moments-error")).toBeInTheDocument();
    // 动态失败只降级这一块：上面的公开文章必须还在。
    expect(await screen.findByRole("link", { name: "作品一" })).toBeInTheDocument();
    expect(mocked.getProfile).toHaveBeenCalledTimes(1);

    mockedMoments.listByUsername.mockResolvedValue({
      items: [momentView("m1", "重试后恢复的动态")],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "重新加载动态" }));

    expect(await screen.findByText("重试后恢复的动态")).toBeInTheDocument();
    expect(mockedMoments.listByUsername).toHaveBeenCalledTimes(2);
    // 区块重试不重放整页请求。
    expect(mocked.getProfile).toHaveBeenCalledTimes(1);
  });

  it("appends the next page of moments, de-duplicates it, and hides the control at the end", async () => {
    mocked.getProfile.mockResolvedValue({ ...PROFILE, momentCount: 3 });
    mockedMoments.listByUsername.mockResolvedValueOnce({
      items: [momentView("m1", "第一页动态")],
      nextCursor: "page-2",
    });
    renderAt("pxczxn");

    expect(await screen.findByText("第一页动态")).toBeInTheDocument();

    mockedMoments.listByUsername.mockResolvedValueOnce({
      // 服务端可能把边界行再返回一次：按 id 去重后不应出现两张一样的卡片。
      items: [momentView("m1", "第一页动态"), momentView("m2", "第二页动态")],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "加载更多动态" }));

    expect(await screen.findByText("第二页动态")).toBeInTheDocument();
    expect(mockedMoments.listByUsername).toHaveBeenLastCalledWith("pxczxn", { cursor: "page-2" });
    expect(screen.getAllByText("第一页动态")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "加载更多动态" })).not.toBeInTheDocument();
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
    const prompt = await screen.findByRole("link", { name: "登录后关注" });
    // 关注是读者在这个页面上想做的事，登录后必须回到这里。
    expect(prompt).toHaveAttribute("href", "/login?returnTo=%2Fu%2Fpxczxn");
    expect(mocked.followUser).not.toHaveBeenCalled();
  });
});

/*
 * 批次 06（S4）。方案 §4.3 的「作品流 tab（文章 / 系列 / 动态）」当时建不出来：用户维度端点
 * 里没有 series 也没有 moments，三个 tab 里两个没有数据源。承担这一维的是创作空间分类。
 *
 * 2026-10-30 补了 /users/{username}/moments，所以动态改为作品流下方的独立区块；
 * series 仍没有用户维度端点，分类筛选继续承担文章的第二维。
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

/*
 * 批次 09：无封面卡在混排时补视觉位。
 *
 * 批次 06 的原意是「无封面时宁可留白」，代码落成了「不渲染」——不渲染就不占位，
 * 于是同一行里无封面卡的标题会顶到卡片上沿，与邻卡差一个封面的高度。这里钉住的
 * 是**条件**：混排时补板、整片无封面时不补板。后者是批次 06 真正想避免的
 * 「一片占位符」，不能被这次修复顺手推翻。
 */
describe("user profile works cover placeholder", () => {
  it("draws a decorative plate for cover-less works when the list also has covers", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(
      worksPage([
        { id: "w1", title: "没有封面的作品" },
        { id: "w2", title: "有封面的作品", coverUrl: "https://example.test/cover.jpg" },
      ]),
    );
    renderAt("pxczxn");

    await screen.findByTestId("works-list");
    // 混排：无封面那张也要出装饰板，标题才与邻卡同基线。
    expect(screen.getAllByTestId("content-visual")).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="works-list"] img')).toHaveLength(1);
  });

  it("draws no plates at all when every work lacks a cover", async () => {
    mocked.getProfile.mockResolvedValue(PROFILE);
    mocked.getUserWorks.mockResolvedValue(
      worksPage([
        { id: "w1", title: "作品一" },
        { id: "w2", title: "作品二" },
      ]),
    );
    renderAt("pxczxn");

    await screen.findByTestId("works-list");
    // 整片无封面：所有卡本来就在同一基线上，补板只会制造一片占位符。
    expect(screen.queryAllByTestId("content-visual")).toHaveLength(0);
  });
});
